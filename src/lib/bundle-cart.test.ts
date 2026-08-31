import { describe, expect, it } from "vitest";
import {
  bundleCartSlug,
  bundleSlugFromCart,
  cartItemsForFulfillment,
  orderItemsForFulfillment,
} from "./bundle-cart";
import type { OrderItem } from "./types";

describe("bundle cart", () => {
  it("keeps a bundle as one cart slug", () => {
    expect(bundleCartSlug("pervyy-bas")).toBe("bundle:pervyy-bas");
    expect(bundleSlugFromCart("bundle:pervyy-bas")).toBe("pervyy-bas");
    expect(bundleSlugFromCart("ordinary-product")).toBeNull();
  });

  it("expands a bundle for stock and preserves its exact package price", () => {
    const items: OrderItem[] = [
      {
        slug: "bundle:pervyy-bas",
        title: "Комплект «Первый бас»",
        price: 9_300,
        qty: 2,
        bundle: {
          slug: "pervyy-bas",
          title: "Первый бас",
          discountPercent: 7,
          fullPrice: 10_000,
          saving: 700,
          items: [
            { slug: "sub", title: "Сабвуфер", price: 4_000, qty: 1 },
            { slug: "amp", title: "Усилитель", price: 6_000, qty: 1 },
          ],
        },
      },
      { slug: "sub", title: "Сабвуфер", price: 4_000, qty: 1 },
    ];

    const expanded = orderItemsForFulfillment(items);
    expect(expanded.map(({ slug, qty }) => ({ slug, qty }))).toEqual([
      { slug: "sub", qty: 3 },
      { slug: "amp", qty: 2 },
    ]);
    expect(
      expanded.reduce((sum, item) => sum + item.price * item.qty, 0),
    ).toBe(22_600);
  });

  it("expands the client bundle before requesting an Ozon route", () => {
    expect(
      cartItemsForFulfillment([
        {
          slug: "bundle:pervyy-bas",
          qty: 2,
          bundle: { items: [{ slug: "sub" }, { slug: "amp" }] },
        },
        { slug: "sub", qty: 1 },
      ]),
    ).toEqual([
      { slug: "sub", qty: 3 },
      { slug: "amp", qty: 2 },
    ]);
  });
});
