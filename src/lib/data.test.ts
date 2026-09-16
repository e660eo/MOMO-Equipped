import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "./types";

const fixture = vi.hoisted(() => ({ products: [] as Product[], items: ["sub", "amp"] }));
vi.mock("./store", () => ({
  readJson: (name: string) => name === "products.json" ? fixture.products : [
    { slug: "kit", title: "Комплект", items: fixture.items, discountPercent: 10 },
  ],
}));
import { getBundles } from "./data";

describe("storefront bundle availability", () => {
  beforeEach(() => {
    fixture.items = ["sub", "amp"];
    fixture.products = [
      { slug: "sub", price: 4000, stock: 2 },
      { slug: "amp", price: 6000, inStock: true },
    ] as Product[];
  });
  it("prices a complete available kit", () => {
    expect(getBundles()[0]).toMatchObject({ price: 9000, fullPrice: 10000, saving: 1000 });
  });
  it.each(["hidden", "missing", "sold-out", "unknown"])("withholds a %s component without selling a partial kit", (state) => {
    const sub = fixture.products[0];
    if (state === "hidden") sub.hidden = true;
    if (state === "missing") fixture.products.shift();
    if (state === "sold-out") { sub.stock = 0; sub.inStock = true; }
    if (state === "unknown") delete sub.stock;
    expect(getBundles()).toEqual([]);
    expect(getBundles({ includeUnavailable: true })).toHaveLength(1);
  });
  it("withholds empty kits", () => {
    fixture.items = [];
    expect(getBundles()).toEqual([]);
  });
});
