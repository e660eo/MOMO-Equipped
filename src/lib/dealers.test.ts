import { describe, expect, it } from "vitest";
import { dealerPriceFor } from "./dealers";
import type { DealerAccount, Product } from "./types";

const product: Product = {
  slug: "bd-1500-1",
  title: "BD-1500.1",
  brand: "MOMO",
  category: "Усилители",
  price: 9184,
  image: "bd-1500.jpg",
  isClearance: false,
};

const account: DealerAccount = {
  id: "account-1",
  dealerId: "dealer-1",
  contactName: "Тестовый дилер",
  email: "dealer@example.com",
  passwordHash: "hidden",
  discountPercent: 20,
  createdAt: "2026-08-13T00:00:00.000Z",
};

describe("dealerPriceFor", () => {
  it("calculates the private price from the dealer discount", () => {
    expect(dealerPriceFor(product, account)).toBe(7347);
  });

  it("uses a per-product override before the common discount", () => {
    expect(dealerPriceFor(product, { ...account, priceOverrides: { "bd-1500-1": 7000 } })).toBe(7000);
  });

  it("ignores invalid overrides", () => {
    expect(dealerPriceFor(product, { ...account, priceOverrides: { "bd-1500-1": 0 } })).toBe(7347);
  });
});
