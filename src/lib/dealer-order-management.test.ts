import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDealerOrders } from "./dealers";
import { getDealerOrderAgreement, getDealerOrderAgreementVersions, saveDealerOrderAgreement, type DealerOrderAgreementInput } from "./dealer-order-management";

let temporary = "";
let previousDir: string | undefined;
const input: DealerOrderAgreementInput = {
  orderId: "D-test", expectedRevision: 0, quantities: { speaker: 2, wire: 0 },
  deliveryCost: 299.99, deliveryMethod: "СДЭК", deliveryAddress: "Москва, пункт выдачи", paymentTerms: "После подтверждения", paymentStatus: "unpaid", invoiceReference: "123", trackingNumber: "", trackingUrl: "", managerMessage: "Кабель исключён по согласованию.",
};

beforeEach(() => {
  previousDir = process.env.MOMO_DATA_DIR;
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "momo-agreement-"));
  process.env.MOMO_DATA_DIR = temporary;
  fs.writeFileSync(path.join(temporary, "dealer-orders.json"), JSON.stringify([{ id: "D-test", dealerId: "dealer", accountId: "account", createdAt: "2026-09-25", status: "new", items: [{ slug: "speaker", title: "Акустика", price: 1200.11, qty: 3 }, { slug: "wire", title: "Кабель", price: 100.12, qty: 1 }], total: 3700.45, history: [] }]));
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.MOMO_DATA_DIR;
  else process.env.MOMO_DATA_DIR = previousDir;
  fs.rmSync(temporary, { recursive: true, force: true });
});

describe("dealer order agreements", () => {
  it("keeps the submitted snapshot and original prices, calculates agreed total in kopecks", () => {
    const before = getDealerOrders()[0];
    const agreement = saveDealerOrderAgreement(input);
    expect(agreement).toMatchObject({ revision: 1, subtotal: 2400.22, deliveryCost: 299.99, total: 2700.21, items: [{ slug: "speaker", price: 1200.11, qty: 2 }] });
    expect(getDealerOrders()[0]).toEqual(before);
    expect(getDealerOrderAgreement("D-test")).toEqual(agreement);
  });

  it("rejects stale edits and preserves every saved version", () => {
    saveDealerOrderAgreement(input);
    expect(() => saveDealerOrderAgreement({ ...input, managerMessage: "stale" })).toThrow("Другой менеджер");
    saveDealerOrderAgreement({ ...input, expectedRevision: 1, paymentStatus: "paid" });
    expect(getDealerOrderAgreementVersions()).toHaveLength(2);
    expect(getDealerOrderAgreement("D-test")?.paymentStatus).toBe("paid");
  });

  it("rejects foreign products, fractional quantities, negative delivery and unsafe links", () => {
    expect(() => saveDealerOrderAgreement({ ...input, quantities: { ...input.quantities, foreign: 1 } })).toThrow("нет в заявке");
    expect(() => saveDealerOrderAgreement({ ...input, quantities: { speaker: 0.5, wire: 0 } })).toThrow("количество");
    expect(() => saveDealerOrderAgreement({ ...input, deliveryCost: -1 })).toThrow("Стоимость доставки");
    expect(() => saveDealerOrderAgreement({ ...input, trackingUrl: "javascript:alert(1)" })).toThrow("Ссылка отслеживания");
    expect(() => saveDealerOrderAgreement({ ...input, quantities: { speaker: 0, wire: 0 } })).toThrow("хотя бы один");
    expect(getDealerOrderAgreement("D-test")).toBeUndefined();
  });
});
