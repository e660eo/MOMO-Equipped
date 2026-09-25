import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/types";

const mocks = vi.hoisted(() => ({ session: vi.fn(), products: vi.fn(), create: vi.fn(), notify: vi.fn(), orders: vi.fn(), process: vi.fn() }));
vi.mock("@/lib/dealer-auth", () => ({ currentDealer: mocks.session }));
vi.mock("@/lib/customer-auth", () => ({ endCustomerSession: vi.fn() }));
vi.mock("@/lib/data", () => ({ getProducts: mocks.products }));
vi.mock("@/lib/b2b-prices", async (original) => ({
  ...await original<typeof import("@/lib/b2b-prices")>(),
  getB2BPriceBook: () => ({ version: 1, updatedAt: "", sources: {}, prices: {
    priced: { dealer: 2550.25, wholesale: 3000 }, hidden: { dealer: 100 }, clearance: { dealer: 100 },
  } }),
}));
vi.mock("@/lib/dealers", async (original) => ({
  ...await original<typeof import("@/lib/dealers")>(), createDealerOrder: mocks.create, getDealerOrders: mocks.orders,
}));
vi.mock("@/lib/dealer-order-notifications", () => ({ ensureDealerOrderNotifications: mocks.notify, processDealerOrderNotifications: mocks.process }));
vi.mock("@/lib/audit-log", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { submitDealerOrder } from "./actions";
import { GET } from "./price.csv/route";

const product: Product = { slug: "priced", title: "Priced", brand: "MOMO", category: "sabvufery", price: 5000, image: "test.jpg", isClearance: false, stock: 5 };
function order(slug: string, qty = 2) {
  const data = new FormData();
  data.set("items", JSON.stringify([{ slug, qty, price: 1 }]));
  data.set("accountId", "dealer-test");
  data.set("requestId", "aaaaaaaa-bbbb-cccc-dddd-111111111111");
  data.set("quotedPrices", JSON.stringify({ [slug]: 2550.25 }));
  data.set("comment", "Согласовать доставку");
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ account: { id: "dealer-test", priceTier: "wholesale", discountPercent: 80, priceOverrides: { priced: 1, unpriced: 1 } }, dealer: { id: "location-test" } });
  mocks.products.mockReturnValue([
    product, { ...product, slug: "unpriced", title: "Unpriced" },
    { ...product, slug: "hidden", title: "Hidden", hidden: true },
    { ...product, slug: "clearance", title: "Clearance", isClearance: true },
  ]);
  mocks.create.mockImplementation((value) => ({ ...value, id: "TEST-ORDER" }));
  mocks.notify.mockResolvedValue(undefined);
  mocks.orders.mockReturnValue([]);
  mocks.process.mockResolvedValue(undefined);
});

describe("common dealer price at the order boundary", () => {
  it("requires authentication before creating an order or downloading prices", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await submitDealerOrder({}, order("priced"))).error).toContain("Войдите");
    expect((await GET()).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it.each(["unpriced", "hidden", "clearance", "removed-cut"])("rejects unavailable %s even from a saved or manipulated draft", async (slug) => {
    expect((await submitDealerOrder({}, order(slug))).error).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("uses server dealer prices and hands the request to the manager", async () => {
    expect(await submitDealerOrder({}, order("priced"))).toEqual({ ok: true, orderId: "TEST-ORDER" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ slug: "priced", title: "Priced", qty: 2, price: 2550.25 }], comment: "Согласовать доставку",
    }));
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
  it("still enforces stock limits", async () => {
    expect((await submitDealerOrder({}, order("priced", 6))).error).toContain("доступно 5");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("asks the dealer to review changed prices before creating an order", async () => {
    const form = order("priced");
    form.set("quotedPrices", JSON.stringify({ priced: 2500 }));
    const result = await submitDealerOrder({}, form);
    expect(result.priceChanges).toEqual([{ slug: "priced", title: "Priced", previousPrice: 2500, price: 2550.25 }]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("rejects submission from a tab belonging to a previous account", async () => {
    const form = order("priced"); form.set("accountId", "previous-account");
    expect((await submitDealerOrder({}, form)).error).toContain("Аккаунт изменился");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns the accepted order after a lost response even if the product is later removed", async () => {
    const { parseDealerOrderSubmission } = await import("@/lib/dealer-order-submission");
    const form = order("priced");
    const input = parseDealerOrderSubmission(form);
    mocks.orders.mockReturnValue([{ id: "ALREADY-SAVED", requestId: input.requestId, requestFingerprint: input.fingerprint }]);
    mocks.products.mockReturnValue([]);
    expect(await submitDealerOrder({}, form)).toEqual({ ok: true, orderId: "ALREADY-SAVED" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects reusing an accepted request token for another payload", async () => {
    mocks.orders.mockReturnValue([{ id: "SAVED", requestId: "aaaaaaaa-bbbb-cccc-dddd-111111111111", requestFingerprint: "another-body" }]);
    expect((await submitDealerOrder({}, order("priced"))).error).toContain("другим составом");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("exports the same eligible products and common prices with no caching", async () => {
    const response = await GET();
    const csv = await response.text();
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(csv).toContain("2550.25");
    expect(csv).not.toMatch(/Unpriced|Hidden|Clearance/);
    expect(csv.trim().split(/\r?\n/)).toHaveLength(2);
  });
});
