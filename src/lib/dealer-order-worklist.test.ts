import { describe, expect, it } from "vitest";
import { filterDealerOrders, matchesDealerView } from "./dealer-order-worklist";
import type { DealerOrder } from "./types";
import type { DealerOrderAgreement } from "./dealer-order-management";
const order = { id: "D-2509", dealerId: "d", accountId: "a", status: "confirmed", createdAt: "2026-09-24T21:10:00Z" } as DealerOrder;
const paid = { paymentStatus: "paid" } as DealerOrderAgreement;
describe("dealer worklist", () => {
  it("uses Moscow calendar dates at the UTC day boundary", () => {
    expect(filterDealerOrders([order], new Map(), [], [], { from: "2026-09-25", to: "2026-09-25" })).toHaveLength(1);
    expect(filterDealerOrders([order], new Map(), [], [], { to: "2026-09-24" })).toHaveLength(0);
  });
  it("does not mark canceled or shipped paid orders as ready", () => {
    expect(matchesDealerView(order, paid, "ready")).toBe(true);
    expect(matchesDealerView({ ...order, status: "canceled" }, paid, "ready")).toBe(false);
    expect(matchesDealerView({ ...order, status: "shipped" }, paid, "ready")).toBe(false);
    expect(matchesDealerView(order, { ...paid, paymentStatus: "partial" }, "awaiting-payment")).toBe(true);
    expect(matchesDealerView(order, undefined, "awaiting-payment")).toBe(false);
  });
  it("combines search with the selected status", () => {
    expect(filterDealerOrders([order], new Map([[order.id, paid]]), [], [], { q: "d-2509", view: "ready" })).toHaveLength(1);
    expect(filterDealerOrders([order], new Map([[order.id, paid]]), [], [], { q: "missing" })).toEqual([]);
  });
});
