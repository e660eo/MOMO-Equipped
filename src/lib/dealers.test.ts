import { describe, expect, it } from "vitest";
import { dealerPriceFor } from "./dealers";
import type { B2BPriceBook } from "./b2b-prices";
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
  priceTier: "dealer",
  discountPercent: 20,
  createdAt: "2026-08-13T00:00:00.000Z",
};

const priceBook: B2BPriceBook = {
  version: 1,
  updatedAt: "2026-08-13T00:00:00.000Z",
  sources: { dealer: "dealer.xlsx", wholesale: "wholesale.xlsx" },
  prices: { "bd-1500-1": { dealer: 6001, wholesale: 6501 } },
};

describe("dealerPriceFor", () => {
  it("calculates the private price from the dealer discount", () => {
    expect(dealerPriceFor(product, account, { ...priceBook, prices: {} })).toBe(7347);
  });

  it("uses the assigned private price tier", () => {
    expect(dealerPriceFor(product, account, priceBook)).toBe(6001);
    expect(dealerPriceFor(product, { ...account, priceTier: "wholesale" }, priceBook)).toBe(6501);
  });

  it("uses a per-product override before the common discount", () => {
    expect(dealerPriceFor(product, { ...account, priceOverrides: { "bd-1500-1": 7000 } }, priceBook)).toBe(7000);
  });

  it("ignores invalid overrides", () => {
    expect(dealerPriceFor(product, { ...account, priceOverrides: { "bd-1500-1": 0 } }, priceBook)).toBe(6001);
  });

  it("uses the fallback discount when the selected tier has no product price", () => {
    expect(dealerPriceFor(product, { ...account, priceTier: "dagestan" }, priceBook)).toBe(7347);
  });
});
