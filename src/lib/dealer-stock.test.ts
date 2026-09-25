import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson, writeJson } from "./store";
import { getDealerOrderAgreement, saveDealerOrderAgreement, type DealerOrderAgreementInput } from "./dealer-order-management";
import { getDealerOrders, updateDealerOrderStatus } from "./dealers";
import { assertDealerReservedProducts, getDealerStockReservations } from "./dealer-stock";
import { addOrder } from "./orders";
import type { Product } from "./types";

let dir: string;
let previous: string | undefined;
const input: DealerOrderAgreementInput = { orderId: "D-stock", expectedRevision: 0, quantities: { speaker: 3, wire: 0 }, deliveryCost: 0, deliveryMethod: "", deliveryAddress: "", paymentTerms: "", paymentStatus: "unpaid", invoiceReference: "", trackingNumber: "", trackingUrl: "", managerMessage: "" };
const products = () => readJson<Product[]>("products.json");
const stock = () => products().find((item) => item.slug === "speaker")!.stock;
beforeEach(() => {
  previous = process.env.MOMO_DATA_DIR;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-dealer-stock-"));
  process.env.MOMO_DATA_DIR = dir;
  writeJson("products.json", [{ slug: "speaker", title: "Акустика", stock: 5 }, { slug: "wire", title: "Кабель", stock: 1 }]);
  writeJson("orders.json", []);
  writeJson("dealer-orders.json", [{ id: input.orderId, accountId: "a", dealerId: "d", status: "new", createdAt: "2026-09-25T10:00:00Z", total: 300, items: [{ slug: "speaker", title: "Акустика", price: 100, qty: 3 }, { slug: "wire", title: "Кабель", price: 10, qty: 1 }], history: [] }]);
});
afterEach(() => {
  if (previous === undefined) delete process.env.MOMO_DATA_DIR; else process.env.MOMO_DATA_DIR = previous;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("paid dealer inventory", () => {
  it("reserves only full payment, never mere confirmation or partial payment", () => {
    updateDealerOrderStatus(input.orderId, "confirmed", "new");
    saveDealerOrderAgreement({ ...input, paymentStatus: "partial" });
    expect(stock()).toBe(5);
    expect(getDealerStockReservations()).toEqual([]);
    saveDealerOrderAgreement({ ...input, expectedRevision: 1, paymentStatus: "paid" });
    expect(stock()).toBe(2);
    expect(getDealerStockReservations()[0].status).toBe("reserved");
    saveDealerOrderAgreement({ ...input, expectedRevision: 2, paymentStatus: "paid", managerMessage: "Повторная правка" });
    expect(stock()).toBe(2);
  });
  it("rolls back the whole agreement when any item is short", () => {
    expect(() => saveDealerOrderAgreement({ ...input, paymentStatus: "paid", quantities: { speaker: 3, wire: 2 } })).toThrow("Недостаточно");
    expect(stock()).toBe(5);
    expect(getDealerOrderAgreement(input.orderId)).toBeUndefined();
    expect(getDealerStockReservations()).toEqual([]);
  });
  it("releases on cancel and reserves again on reopening, only once", () => {
    saveDealerOrderAgreement({ ...input, paymentStatus: "paid" });
    updateDealerOrderStatus(input.orderId, "canceled", "new");
    expect(stock()).toBe(5);
    updateDealerOrderStatus(input.orderId, "canceled", "canceled");
    expect(stock()).toBe(5);
    updateDealerOrderStatus(input.orderId, "confirmed", "canceled");
    expect(stock()).toBe(2);
  });
  it("changes only the quantity delta and releases when payment is corrected", () => {
    saveDealerOrderAgreement({ ...input, paymentStatus: "paid" });
    saveDealerOrderAgreement({ ...input, expectedRevision: 1, paymentStatus: "paid", quantities: { speaker: 2, wire: 0 } });
    expect(stock()).toBe(3);
    saveDealerOrderAgreement({ ...input, expectedRevision: 2, paymentStatus: "partial" });
    expect(stock()).toBe(5);
  });
  it("ships held stock without deducting twice and prevents unsafe reversals", () => {
    saveDealerOrderAgreement({ ...input, paymentStatus: "paid" });
    updateDealerOrderStatus(input.orderId, "shipped", "new");
    updateDealerOrderStatus(input.orderId, "done", "shipped");
    expect(stock()).toBe(2);
    expect(getDealerStockReservations()[0].status).toBe("shipped");
    expect(() => updateDealerOrderStatus(input.orderId, "canceled", "done")).toThrow("уже отгружен");
    expect(() => saveDealerOrderAgreement({ ...input, expectedRevision: 1, paymentStatus: "unpaid" })).toThrow("уже отгружен");
    expect(getDealerOrders()[0].status).toBe("done");
    expect(getDealerOrderAgreement(input.orderId)?.revision).toBe(1);
  });
  it("blocks shipping before payment and requires a numeric balance", () => {
    expect(() => updateDealerOrderStatus(input.orderId, "shipped", "new")).toThrow("полную оплату");
    writeJson("products.json", [{ slug: "speaker", inStock: true }]);
    expect(() => saveDealerOrderAgreement({ ...input, paymentStatus: "paid" })).toThrow("числовой остаток");
    expect(getDealerOrders()[0].status).toBe("new");
  });
  it("keeps paid holds unavailable to retail and other dealer orders", () => {
    saveDealerOrderAgreement({ ...input, paymentStatus: "paid" });
    expect(() => addOrder({ items: [{ slug: "speaker", title: "Акустика", price: 100, qty: 3 }], total: 300, customer: { name: "Test", phone: "79999999999", address: "Test" } })).toThrow("Недостаточно");
    writeJson("dealer-orders.json", [...getDealerOrders(), { ...getDealerOrders()[0], id: "D-other" }]);
    expect(() => saveDealerOrderAgreement({ ...input, orderId: "D-other", paymentStatus: "paid" })).toThrow("Недостаточно");
    expect(stock()).toBe(2);
  });
  it("protects reserved products from deletion or disabling stock tracking", () => {
    saveDealerOrderAgreement({ ...input, paymentStatus: "paid" });
    expect(() => assertDealerReservedProducts(products().filter((p) => p.slug !== "speaker"))).toThrow("зарезервирован");
    expect(() => assertDealerReservedProducts(products().map((p) => ({ ...p, stock: undefined })))).toThrow("зарезервирован");
  });
  it("does not retrospectively debit historic completed orders", () => {
    writeJson("dealer-orders.json", getDealerOrders().map((order) => ({ ...order, status: "shipped" })));
    saveDealerOrderAgreement({ ...input, paymentStatus: "paid" });
    expect(stock()).toBe(5);
    expect(getDealerStockReservations()).toEqual([]);
  });
});
