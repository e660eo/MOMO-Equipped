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
  beforeEach(() => useCart.setState({ items: [], ownerId: null, pending: [], accounts: {} }));

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

describe("account cart synchronization", () => {
  beforeEach(() => useCart.setState({ items: [], ownerId: null, pending: [], accounts: {} }));
  it("merges the guest cart once and never imports another account's items", () => {
    useCart.getState().add(sub);
    useCart.getState().bindAccount("alice");
    const mutation = useCart.getState().pending[0];
    expect(mutation.mode).toBe("merge");
    useCart.getState().bindAccount("alice");
    expect(useCart.getState().pending).toHaveLength(1);
    useCart.getState().acceptRemote("alice", [{ ...sub, qty: 3 }], mutation.id);
    expect(useCart.getState().items[0].qty).toBe(3);
    useCart.getState().bindAccount(null);
    expect(useCart.getState().items).toEqual([]);
    useCart.getState().bindAccount("bob");
    expect(useCart.getState().items).toEqual([]);
    expect(useCart.getState().pending).toEqual([]);
    useCart.getState().acceptRemote("alice", [{ ...sub, qty: 3 }]);
    expect(useCart.getState().items).toEqual([]);
  });
  it("retains edits made while a request is in flight", () => {
    useCart.getState().bindAccount("alice");
    useCart.getState().add(sub);
    const first = useCart.getState().pending[0];
    useCart.getState().setQty("sub", 2);
    useCart.getState().add(amp);
    useCart.getState().acceptRemote("alice", [{ ...sub, qty: 1 }], first.id);
    expect(useCart.getState().items.map(({ slug, qty }) => ({ slug, qty }))).toEqual([
      { slug: "sub", qty: 2 }, { slug: "amp", qty: 1 },
    ]);
    expect(useCart.getState().pending).toHaveLength(2);
  });
  it("adds to the server quantity when the initial load is still in flight", () => {
    useCart.getState().bindAccount("alice");
    useCart.getState().add(sub);
    useCart.getState().acceptRemote("alice", [{ ...sub, qty: 3 }]);
    expect(useCart.getState().items[0].qty).toBe(4);
    expect(useCart.getState().pending[0]).toMatchObject({ mode: "add", lines: [{ slug: "sub", qty: 1 }] });
  });
  it("does not resurrect remotely deleted items when logging in again", () => {
    useCart.getState().bindAccount("alice");
    useCart.getState().acceptRemote("alice", [{ ...sub, qty: 1 }]);
    useCart.getState().bindAccount(null);
    useCart.getState().bindAccount("alice");
    expect(useCart.getState().pending).toEqual([]);
    useCart.getState().acceptRemote("alice", []);
    expect(useCart.getState().items).toEqual([]);
  });
  it("retains unsent removals across account switches and clears purchased lines", () => {
    useCart.getState().bindAccount("alice");
    useCart.getState().acceptRemote("alice", [{ ...sub, qty: 1 }, { ...kit, qty: 1 }]);
    useCart.getState().clear();
    const pending = useCart.getState().pending;
    expect(pending[0].lines).toEqual([{ slug: "sub", qty: 0 }, { slug: "bundle:kit", qty: 0 }]);
    useCart.getState().bindAccount(null);
    useCart.getState().bindAccount("alice");
    expect(useCart.getState().pending).toEqual(pending);
    useCart.getState().acceptRemote("alice", [{ ...amp, qty: 1 }], pending[0].id);
    expect(useCart.getState().items.map((item) => item.slug)).toEqual(["amp"]);
  });
});
