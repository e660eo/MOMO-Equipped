import { describe, expect, it } from "vitest";
import { discountForPromo, promoAppliesToProduct, promoDiscountForItems } from "./promos";
import type { Promo } from "./types";

const base: Promo = { code: "TEST", percent: 20, limit: 0, used: 0, createdAt: "2026-01-01T00:00:00.000Z" };

describe("advanced promo rules", () => {
  it("caps the maximum discount", () => {
    expect(discountForPromo(10_000, { ...base, maxDiscount: 1_500 })).toBe(1_500);
  });

  it("matches selected products or categories", () => {
    const promo = { ...base, productSlugs: ["fr-500"], categories: ["sabvufery"] };
    expect(promoAppliesToProduct(promo, { slug: "fr-500", category: "usiliteli-monobloki" })).toBe(true);
    expect(promoAppliesToProduct(promo, { slug: "x", category: "sabvufery" })).toBe(true);
    expect(promoAppliesToProduct(promo, { slug: "x", category: "aksessuary" })).toBe(false);
  });

  it("calculates only eligible lines and applies the maximum cap", () => {
    const promo = { ...base, categories: ["sabvufery"], maxDiscount: 900 };
    const result = promoDiscountForItems(
      promo,
      [
        { slug: "sub", price: 5_000, qty: 2 },
        { slug: "amp", price: 20_000, qty: 1 },
      ],
      [
        { slug: "sub", category: "sabvufery" },
        { slug: "amp", category: "usiliteli-monobloki" },
      ],
    );
    expect(result).toEqual({ eligibleSubtotal: 10_000, discount: 900 });
  });
});
