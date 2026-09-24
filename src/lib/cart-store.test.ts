import { beforeEach, describe, expect, it, vi } from "vitest";

// The regression concerns cart mutations, not browser persistence or toasts.
vi.mock("zustand/middleware", () => ({ persist: (initializer: unknown) => initializer }));
vi.mock("./toast-store", () => ({ useToast: { getState: () => ({ push: vi.fn() }) } }));
import { useCart, cartTotal } from "./cart-store";
import { cartItemsForFulfillment } from "./bundle-cart";

const sub = { slug: "sub", title: "Сабвуфер", price: 4000, image: "", stock: 10 };
const amp = { slug: "amp", title: "Усилитель", price: 6000, image: "", stock: 10 };
const kit = {
  slug: "bundle:kit", title: "Комплект", price: 9000, image: "", stock: 2,
  bundle: { slug: "kit", title: "Комплект", discountPercent: 10, fullPrice: 10000, saving: 1000, items: [sub, amp] },
};

describe("adding bundles to a customer cart", () => {
  beforeEach(() => useCart.setState({ items: [] }));

  it("keeps independently selected components and adds the whole kit", () => {
    useCart.getState().add(sub);
    useCart.getState().add(amp);
    useCart.getState().addBundle(kit);
    expect(useCart.getState().items.map(({ slug, qty }) => ({ slug, qty }))).toEqual([
      { slug: "sub", qty: 1 }, { slug: "amp", qty: 1 }, { slug: "bundle:kit", qty: 1 },
    ]);
    expect(cartTotal(useCart.getState().items)).toBe(19000);
    expect(cartItemsForFulfillment(useCart.getState().items)).toEqual([
      { slug: "sub", qty: 2 }, { slug: "amp", qty: 2 },
    ]);
  });

  it("caps repeated kits without consuming separately selected components", () => {
    useCart.getState().add(sub);
    useCart.getState().add(amp);
    useCart.getState().addBundle(kit);
    useCart.getState().addBundle(kit);
    useCart.getState().addBundle(kit);
    expect(useCart.getState().items.map(({ slug, qty }) => ({ slug, qty }))).toEqual([
      { slug: "sub", qty: 1 }, { slug: "amp", qty: 1 }, { slug: "bundle:kit", qty: 2 },
    ]);
    expect(cartTotal(useCart.getState().items)).toBe(28000);
  });
});
