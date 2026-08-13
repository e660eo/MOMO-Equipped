import { describe, expect, it } from "vitest";
import { discountForPromo, promoAppliesToProduct } from "./promos";
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
});
