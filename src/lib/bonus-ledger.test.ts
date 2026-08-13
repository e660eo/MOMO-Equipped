import { describe, expect, it } from "vitest";
import { calculateBonusSummary, maxRedeemableBonus } from "./bonus-ledger";
import type { BonusTransaction } from "./types";

function entry(
  id: string,
  amount: number,
  createdAt: string,
  expiresAt?: string,
): BonusTransaction {
  return {
    id,
    customerId: "customer",
    type: amount > 0 ? "admin_credit" : "order_spend",
    amount,
    createdAt,
    ...(expiresAt ? { expiresAt } : {}),
    reason: "Тест",
    actor: "Тест",
  };
}

describe("bonus ledger", () => {
  it("spends bonuses with the nearest expiry first", () => {
    const summary = calculateBonusSummary([
      entry("old", 100, "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z"),
      entry("fresh", 100, "2026-01-02T00:00:00.000Z", "2027-01-02T00:00:00.000Z"),
      entry("spend", -80, "2026-01-05T00:00:00.000Z"),
    ], new Date("2026-01-20T00:00:00.000Z"));
    expect(summary.balance).toBe(100);
    expect(summary.expiresAt).toBe("2027-01-02T00:00:00.000Z");
  });

  it("does not count expired or future credits", () => {
    const summary = calculateBonusSummary([
      entry("expired", 50, "2025-01-01T00:00:00.000Z", "2025-12-31T00:00:00.000Z"),
      entry("future", 70, "2027-01-01T00:00:00.000Z", "2028-01-01T00:00:00.000Z"),
    ], new Date("2026-06-01T00:00:00.000Z"));
    expect(summary.balance).toBe(0);
  });

  it("limits redemption to 30 percent and the available balance", () => {
    expect(maxRedeemableBonus(10_000, 5_000)).toBe(3_000);
    expect(maxRedeemableBonus(10_000, 800)).toBe(800);
  });
});
