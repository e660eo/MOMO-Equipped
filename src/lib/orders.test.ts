import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addOrder, getOrder, setOrderArchived, setOrderPayment, updateOrder } from "./orders";
import { getPromos, reservePromo } from "./promos";
import type { OrderItem, Product, Promo } from "./types";

describe("order resource reservations", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;
  const item: OrderItem = { slug: "limited", title: "Ограниченный товар", price: 1000, qty: 1 };

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-orders-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;
    const products: Product[] = [{
      slug: "limited",
      title: "Ограниченный товар",
      brand: "MOMO",
      category: "aksessuary",
      price: 1000,
      image: "limited.webp",
      stock: 1,
      isClearance: false,
    }];
    const promos: Promo[] = [{
      code: "ONLYONE",
      percent: 10,
      limit: 1,
      used: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    }];
    fs.writeFileSync(path.join(tempDir, "products.json"), JSON.stringify(products));
    fs.writeFileSync(path.join(tempDir, "promos.json"), JSON.stringify(promos));
    fs.writeFileSync(path.join(tempDir, "orders.json"), "[]\n");
    fs.writeFileSync(path.join(tempDir, "bonus-ledger.json"), "[]\n");
    fs.writeFileSync(path.join(tempDir, "audit-log.json"), "[]\n");
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reserves stock with the order and releases stock and promo after failed payment", () => {
    reservePromo("ONLYONE", "redemption-1", { subtotal: 1000, customerKey: "buyer" });
    const order = addOrder({
      customer: { name: "Тест", phone: "+7 999 111-22-33", address: "Москва" },
      items: [item],
      total: 900,
      promo: {
        code: "ONLYONE",
        percent: 10,
        discount: 100,
        redemptionId: "redemption-1",
        customerKey: "buyer",
        redemptionActive: true,
      },
      paymentRequested: true,
    });

    const productsAfterOrder = JSON.parse(
      fs.readFileSync(path.join(tempDir, "products.json"), "utf8"),
    ) as Product[];
    expect(productsAfterOrder[0]?.stock).toBe(0);
    expect(getOrder(order.id)?.stockDeducted).toBe(true);
    expect(getPromos()[0]).toMatchObject({ used: 1, customerUses: { buyer: 1 } });

    setOrderPayment(order.id, {
      status: "FAILED",
      amount: 900,
      updatedAt: new Date().toISOString(),
      sandbox: true,
    });

    const productsAfterFailure = JSON.parse(
      fs.readFileSync(path.join(tempDir, "products.json"), "utf8"),
    ) as Product[];
    expect(productsAfterFailure[0]?.stock).toBe(1);
    expect(getOrder(order.id)?.stockDeducted).toBe(false);
    expect(getOrder(order.id)?.promo?.redemptionActive).toBe(false);
    expect(getPromos()[0]).toMatchObject({ used: 0 });
  });

  it("does not silently oversell and releases a reservation on cancellation", () => {
    const first = addOrder({
      customer: { name: "Первый", phone: "+7 999 111-22-34", address: "Москва" },
      items: [item],
      total: 1000,
    });
    expect(() => addOrder({
      customer: { name: "Второй", phone: "+7 999 111-22-35", address: "Москва" },
      items: [item],
      total: 1000,
    })).toThrow(/Недостаточно товара/);

    updateOrder(first.id, { status: "canceled" });
    const products = JSON.parse(
      fs.readFileSync(path.join(tempDir, "products.json"), "utf8"),
    ) as Product[];
    expect(products[0]?.stock).toBe(1);
  });

  it("archives and restores an order without changing its status or stock reservation", () => {
    const order = addOrder({
      customer: { name: "Архив", phone: "+7 999 111-22-36", address: "Москва" },
      items: [item],
      total: 1000,
    });
    const stockBefore = JSON.parse(
      fs.readFileSync(path.join(tempDir, "products.json"), "utf8"),
    ) as Product[];

    const archived = setOrderArchived(order.id, true);
    expect(archived?.archivedAt).toBeTruthy();
    expect(archived?.status).toBe("new");
    expect(archived?.stockDeducted).toBe(true);
    expect(archived?.history?.at(-1)?.detail).toBe("Заказ перемещён в архив");

    const restored = setOrderArchived(order.id, false);
    expect(restored?.archivedAt).toBeUndefined();
    expect(restored?.status).toBe("new");
    expect(restored?.history?.at(-1)?.detail).toBe("Заказ восстановлен из архива");

    const stockAfter = JSON.parse(
      fs.readFileSync(path.join(tempDir, "products.json"), "utf8"),
    ) as Product[];
    expect(stockAfter[0]?.stock).toBe(stockBefore[0]?.stock);
    updateOrder(order.id, { status: "canceled" });
  });
});
