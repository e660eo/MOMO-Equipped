import { describe, expect, it } from "vitest";
import { hasPreviousCustomerOrder } from "./first-order-promo";
import type { Order } from "./types";

const order = (overrides: Partial<Order> = {}): Pick<Order, "status" | "payment" | "customer"> => ({
  status: "done",
  customer: { name: "Покупатель", phone: "+7 (900) 123-45-67", email: "buyer@example.com", address: "" },
  ...overrides,
});

describe("first-order promo eligibility", () => {
  it("recognizes the same customer by normalized Russian phone or email", () => {
    expect(hasPreviousCustomerOrder([order()], { phone: "8 900 123 45 67" })).toBe(true);
    expect(hasPreviousCustomerOrder([order()], { email: " BUYER@example.com " })).toBe(true);
  });

  it("does not count canceled or failed payment attempts", () => {
    expect(hasPreviousCustomerOrder([order({ status: "canceled" })], { email: "buyer@example.com" })).toBe(false);
    expect(hasPreviousCustomerOrder([order({ status: "new", payment: { status: "FAILED", amount: 1000, updatedAt: "2026-11-01T00:00:00.000Z", sandbox: false } })], { phone: "89001234567" })).toBe(false);
  });

  it("allows a customer with no matching order", () => {
    expect(hasPreviousCustomerOrder([order()], { email: "new@example.com", phone: "89005550000" })).toBe(false);
  });
});
