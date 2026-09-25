import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMailWithRetry } from "./mailer";
import { getDealerOrders } from "./dealers";
import { saveDealerOrderAgreement } from "./dealer-order-management";
import { ensureDealerOrderNotifications, getDealerOrderNotifications, processDealerOrderNotifications, retryDealerOrderNotifications, type DealerOrderNotification } from "./dealer-order-notifications";
import { readJson, writeJson } from "./store";
import type { DealerOrder } from "./types";

vi.mock("./mailer", () => ({ sendMailWithRetry: vi.fn() }));
const mail = vi.mocked(sendMailWithRetry);
const file = "dealer-order-notifications.json";
let temporary = "";
let previousDir: string | undefined;
const order: DealerOrder = {
  id: "D-mail", dealerId: "dealer", accountId: "account", createdAt: "2026-09-25T10:00:00Z", status: "new",
  items: [{ slug: "speaker", title: "Акустика", price: 1200.11, qty: 2 }], total: 2400.22, history: [{ at: "2026-09-25T10:00:00Z", actor: "Дилер", to: "new" }],
  notificationEvents: [{ id: "event-created", at: "2026-09-25T10:00:00Z", status: "new", kind: "created" }],
};

beforeEach(() => {
  previousDir = process.env.MOMO_DATA_DIR;
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "momo-dealer-mail-"));
  process.env.MOMO_DATA_DIR = temporary;
  fs.writeFileSync(path.join(temporary, "dealer-orders.json"), JSON.stringify([order]));
  fs.writeFileSync(path.join(temporary, "dealer-accounts.json"), JSON.stringify([{ id: "account", dealerId: "dealer", email: "dealer@example.test", contactName: "Дилер", passwordHash: "not-used", createdAt: "2026-09-25", discountPercent: 0 }]));
  fs.writeFileSync(path.join(temporary, "dealers.json"), JSON.stringify([{ id: "dealer", name: "Компания", city: "Москва", address: "Тест", phone: "000", active: true, createdAt: "2026-09-25" }]));
  mail.mockReset();
  mail.mockResolvedValue({ ok: true, at: new Date().toISOString(), to: ["test@example.test"], messageId: "test", response: "accepted" });
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.MOMO_DATA_DIR;
  else process.env.MOMO_DATA_DIR = previousDir;
  fs.rmSync(temporary, { recursive: true, force: true });
});

describe("durable dealer notification outbox", () => {
  it("recovers enqueue after restart and deduplicates sent events", async () => {
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(2);
    expect(getDealerOrderNotifications(order.id).every((job) => job.status === "sent")).toBe(true);
    ensureDealerOrderNotifications(getDealerOrders()[0]);
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(2);
    expect(getDealerOrderNotifications(order.id)).toHaveLength(2);
  });

  it("persists SMTP failures, backs off, and permits a manual retry", async () => {
    mail.mockResolvedValueOnce({ ok: false, at: new Date().toISOString(), error: "SMTP временно недоступен" });
    await processDealerOrderNotifications();
    const failed = getDealerOrderNotifications(order.id).find((job) => job.recipient === "manager");
    expect(failed).toMatchObject({ status: "pending", attempts: 1, error: "SMTP временно недоступен" });
    expect(Date.parse(failed!.runAt)).toBeGreaterThan(Date.now());
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(2);
    retryDealerOrderNotifications(order.id);
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(3);
    expect(getDealerOrderNotifications(order.id).every((job) => job.status === "sent")).toBe(true);
  });

  it("does not send historical orders on startup", async () => {
    writeJson("dealer-orders.json", [{ ...order, notificationEvents: undefined }]);
    await processDealerOrderNotifications();
    expect(mail).not.toHaveBeenCalled();
    expect(getDealerOrderNotifications(order.id)).toEqual([]);
  });

  it("reclaims expired leases but leaves a live worker alone", async () => {
    ensureDealerOrderNotifications(order);
    writeJson(file, readJson<DealerOrderNotification[]>(file).map((job, index) => ({ ...job, status: "sending", leaseToken: `worker-${index}`, leaseUntil: new Date(Date.now() + (index ? -1000 : 60_000)).toISOString() })));
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(1);
    expect(getDealerOrderNotifications(order.id).filter((job) => job.status === "sending")).toHaveLength(1);
  });

  it("allows two independent worker instances without claiming the same live message", async () => {
    let completeFirst!: (value: Awaited<ReturnType<typeof sendMailWithRetry>>) => void;
    mail.mockImplementationOnce(() => new Promise((resolve) => { completeFirst = resolve; }));
    const first = processDealerOrderNotifications();
    vi.resetModules();
    const secondWorker = await import("./dealer-order-notifications");
    await secondWorker.processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(2);
    expect(getDealerOrderNotifications(order.id).filter((job) => job.status === "sending")).toHaveLength(1);
    completeFirst({ ok: true, at: new Date().toISOString(), to: ["test@example.test"], messageId: "first", response: "accepted" });
    await first;
    expect(getDealerOrderNotifications(order.id).every((job) => job.status === "sent")).toBe(true);
    expect(mail).toHaveBeenCalledTimes(2);
  });

  it("recovers an agreement notification after a save without enqueue", async () => {
    writeJson("dealer-orders.json", [{ ...order, notificationEvents: undefined }]);
    saveDealerOrderAgreement({ orderId: order.id, expectedRevision: 0, quantities: { speaker: 1 }, deliveryCost: 100, deliveryMethod: "Самовывоз", deliveryAddress: "", paymentTerms: "Предоплата", paymentStatus: "unpaid", invoiceReference: "Счёт 100", trackingNumber: "", trackingUrl: "", managerMessage: "Одна штука подтверждена" });
    await processDealerOrderNotifications();
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0][0]).toMatchObject({ to: ["dealer@example.test"] });
    expect(mail.mock.calls[0][0].text).toContain("Итого: 1300.11 ₽");
    expect(getDealerOrderNotifications(order.id)[0]).toMatchObject({ kind: "agreement", status: "sent" });
  });

  it("sends each status event once and never sends the current status in place of its snapshot", async () => {
    writeJson("dealer-orders.json", [{ ...order, status: "shipped", notificationEvents: [{ id: "confirmed", at: "2026-09-25", kind: "status", status: "confirmed" }, { id: "shipped", at: "2026-09-25", kind: "status", status: "shipped" }] }]);
    await processDealerOrderNotifications();
    expect(mail).toHaveBeenCalledTimes(2);
    expect(mail.mock.calls[0][0].subject).toContain("Подтверждён");
    expect(mail.mock.calls[1][0].subject).toContain("Отгружен");
  });
});
