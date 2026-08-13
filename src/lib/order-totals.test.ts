import { describe, expect, it } from "vitest";
import { allocatedGoodsLineTotals, orderGoodsFactor, orderGoodsPayable } from "./order-totals";
import type { Order } from "./types";

const order = {
  items: [
    { slug: "one", title: "One", price: 1_000, qty: 1 },
    { slug: "two", title: "Two", price: 2_000, qty: 2 },
  ],
  promo: { code: "TEST", percent: 20, discount: 700 },
  bonus: { spent: 900, transactionId: "tx" },
} satisfies Pick<Order, "items" | "promo" | "bonus">;

describe("order totals with bonuses", () => {
  it("subtracts the exact promo discount and spent bonuses", () => {
    expect(orderGoodsPayable(order)).toBe(3_400);
    expect(orderGoodsFactor(order)).toBeCloseTo(0.68);
  });

  it("allocates the exact payable amount between receipt lines", () => {
    expect(allocatedGoodsLineTotals(order).reduce((sum, value) => sum + value, 0)).toBe(3_400);
  });
});
