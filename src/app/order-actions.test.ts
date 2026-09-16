import { beforeEach, describe, expect, it, vi } from "vitest";
import { cartSnapshot } from "../lib/cart-review";

const state = vi.hoisted(() => ({
  products: [{ slug: "speaker", title: "Speaker", price: 1000, stock: 3, inStock: true }],
  addOrder: vi.fn(), createPayment: vi.fn(), enqueue: vi.fn(), reserveBonus: vi.fn(), consumeDelivery: vi.fn(),
}));
vi.mock("@/lib/client-ip", () => ({ clientIp: async () => "cart-regression-test" }));
vi.mock("@/lib/customer-auth", () => ({ currentCustomer: async () => null }));
vi.mock("@/lib/data", () => ({ getProducts: () => state.products, getBundles: () => [], getRawBundles: () => [], siteConfig: { trust: { freeShippingFrom: 5000 } } }));
vi.mock("@/lib/orders", () => ({ addOrder: state.addOrder, setOrderPayment: vi.fn(), updateOrder: vi.fn() }));
vi.mock("@/lib/yandex-pay", () => ({ createPayment: state.createPayment, isPayConfigured: () => true }));
vi.mock("@/lib/job-queue", () => ({ enqueueIntegrationJob: state.enqueue, runIntegrationQueue: vi.fn() }));
vi.mock("@/lib/promos", () => ({ findValidPromo: () => undefined, promoDiscountForItems: vi.fn(), releasePromo: vi.fn(), reservePromo: vi.fn() }));
vi.mock("@/lib/place-search", () => ({ searchRussianPlaces: vi.fn() }));
vi.mock("@/lib/bonus-ledger", () => ({ attachBonusToOrder: vi.fn(), getBonusSummary: () => ({ balance: 0 }), maxRedeemableBonus: () => 0, releaseBonusReservation: vi.fn(), reserveOrderBonus: state.reserveBonus }));
vi.mock("@/lib/ozon-delivery", () => ({ consumeOzonSelection: state.consumeDelivery, getOzonMapArea: vi.fn(), quoteOzonPickup: vi.fn() }));
import { submitOrder } from "./order-actions";

const payload = () => ({ name: "Тестовый покупатель", phone: "+79990000000", address: "Тестовый адрес", items: [{ slug: "speaker", qty: 2 }], snapshot: cartSnapshot([{ slug: "speaker", price: 1000, qty: 2 }]), expectedTotal: 2000 });
beforeEach(() => {
  vi.clearAllMocks();
  state.products = [{ slug: "speaker", title: "Speaker", price: 1000, stock: 3, inStock: true }];
});
describe("checkout rejects changed terms before any external side effect", () => {
  it.each(["price", "stock", "missing"])("requires review after %s changes", async (change) => {
    if (change === "price") state.products[0].price = 1100;
    if (change === "stock") state.products[0].stock = 1;
    if (change === "missing") state.products = [];
    expect(await submitOrder(payload())).toMatchObject({ ok: false, cartChanged: true });
    expect(state.addOrder).not.toHaveBeenCalled();
    expect(state.createPayment).not.toHaveBeenCalled();
    expect(state.enqueue).not.toHaveBeenCalled();
    expect(state.reserveBonus).not.toHaveBeenCalled();
    expect(state.consumeDelivery).not.toHaveBeenCalled();
  });
  it("requires review when displayed discount/total no longer matches", async () => {
    expect(await submitOrder({ ...payload(), expectedTotal: 1700, promoCode: "EXPIRED" })).toMatchObject({ ok: false, cartChanged: true });
    expect(state.addOrder).not.toHaveBeenCalled();
    expect(state.enqueue).not.toHaveBeenCalled();
  });
});
