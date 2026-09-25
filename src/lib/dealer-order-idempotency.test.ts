import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDealerOrder, getDealerOrders, updateDealerOrderStatus } from "./dealers";
import type { DealerAccount } from "./types";

describe("durable dealer order creation", () => {
  let dir: string;
  const previous = process.env.MOMO_DATA_DIR;
  const account: DealerAccount = { id: "a", dealerId: "d", contactName: "Тест", email: "test@example.invalid", passwordHash: "test", discountPercent: 0, createdAt: "2026-09-25" };
  const input = { account, items: [{ slug: "sub", title: "Sub", qty: 3, price: 10.1 }], requestId: "request-one", requestFingerprint: "payload-one" };
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dealer-idempotency-"));
    process.env.MOMO_DATA_DIR = dir;
    fs.writeFileSync(path.join(dir, "dealer-orders.json"), "[]");
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.MOMO_DATA_DIR; else process.env.MOMO_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("saves one order and one durable created event for repeated requests", () => {
    const first = createDealerOrder(input);
    const retry = createDealerOrder(input);
    expect(retry).toEqual(first);
    expect(getDealerOrders("a")).toHaveLength(1);
    expect(first.total).toBe(30.3);
    expect(first.notificationEvents).toHaveLength(1);
  });
  it("rejects token reuse with another payload and isolates accounts", () => {
    expect(() => createDealerOrder({ ...input, requestFingerprint: "another-payload" })).toThrow("другим составом");
    const other = createDealerOrder({ ...input, account: { ...account, id: "b" } });
    expect(other.accountId).toBe("b");
    expect(getDealerOrders()).toHaveLength(2);
  });
  it("records each actual status transition once for recoverable delivery", () => {
    const order = getDealerOrders("a")[0];
    updateDealerOrderStatus(order.id, "confirmed");
    updateDealerOrderStatus(order.id, "confirmed");
    const updated = getDealerOrders("a")[0];
    expect(updated.notificationEvents?.map((event) => event.kind)).toEqual(["created", "status"]);
    expect(updated.history).toHaveLength(2);
  });
});
