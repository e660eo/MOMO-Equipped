import { beforeEach, describe, expect, it, vi } from "vitest";
import { cartSnapshot } from "../lib/cart-review";

const state = vi.hoisted(() => ({
  products: [{ slug: "speaker", title: "Speaker", price: 1000, stock: 3, inStock: true }],
  addOrder: vi.fn(), createPayment: vi.fn(), enqueue: vi.fn(), reserveBonus: vi.fn(), consumeDelivery: vi.fn(),
  customer: vi.fn(), updateOrder: vi.fn(), ip: 0,
}));
vi.mock("@/lib/client-ip", () => ({ clientIp: async () => `cart-regression-test-${state.ip}` }));
vi.mock("@/lib/customer-auth", () => ({ currentCustomer: state.customer }));
vi.mock("@/lib/data", () => ({ getProducts: () => state.products, getBundles: () => [], getRawBundles: () => [], siteConfig: { trust: { freeShippingFrom: 5000 } } }));
vi.mock("@/lib/orders", () => ({ addOrder: state.addOrder, setOrderPayment: vi.fn(), updateOrder: state.updateOrder }));
vi.mock("@/lib/yandex-pay", () => ({ createPayment: state.createPayment, isPayConfigured: () => true }));
vi.mock("@/lib/job-queue", () => ({ enqueueIntegrationJob: state.enqueue, runIntegrationQueue: vi.fn() }));
vi.mock("@/lib/promos", () => ({ findValidPromo: () => undefined, promoDiscountForItems: vi.fn(), releasePromo: vi.fn(), reservePromo: vi.fn() }));
vi.mock("@/lib/place-search", () => ({ searchRussianPlaces: vi.fn() }));
vi.mock("@/lib/bonus-ledger", () => ({ attachBonusToOrder: vi.fn(), getBonusSummary: () => ({ balance: 0 }), maxRedeemableBonus: () => 0, releaseBonusReservation: vi.fn(), reserveOrderBonus: state.reserveBonus }));
vi.mock("@/lib/ozon-delivery", () => ({ consumeOzonSelection: state.consumeDelivery, getOzonMapArea: vi.fn(), quoteOzonPickup: vi.fn() }));
import { submitOrder } from "./order-actions";

const payload = () => ({ name: "Тестовый покупатель", phone: "+79990000000", address: "Тестовый адрес", items: [{ slug: "speaker", qty: 2 }], snapshot: cartSnapshot([{ slug: "speaker", price: 1000, qty: 2 }]), expectedTotal: 2000 });
beforeEach(() => {
  vi.resetAllMocks();
  state.ip += 1;
  state.customer.mockResolvedValue(null);
  state.products = [{ slug: "speaker", title: "Speaker", price: 1000, stock: 3, inStock: true }];
});

describe("payment and delivery recovery", () => {
  beforeEach(() => {
    state.customer.mockResolvedValue({ id: "customer", emailVerifiedAt: "2026-09-01", email: "test@example.com" });
    state.addOrder.mockImplementation((order) => ({ ...order, id: `order-${state.addOrder.mock.calls.length}` }));
    state.consumeDelivery.mockReturnValue({ provider: "ozon", customerPrice: 300 });
  });
  const online = () => ({ ...payload(), pay: true, expectedTotal: 2300, deliveryToken: "first-token" });

  it("requires a new pickup confirmation after payment failure and accepts a fresh token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const used = new Set<string>();
    state.consumeDelivery.mockImplementation((token: string) => {
      if (used.has(token)) throw new Error("Расчёт доставки устарел");
      used.add(token);
      return { provider: "ozon", customerPrice: 300 };
    });
    state.createPayment.mockRejectedValueOnce(new Error("payment unavailable"))
      .mockResolvedValueOnce({ url: "https://pay.example/order-2", token: "payment-2", amount: 2300 });
    try {
      expect(await submitOrder(online())).toMatchObject({ ok: false, requiresDeliveryRefresh: true });
      expect(state.updateOrder).toHaveBeenCalledWith("order-1", expect.objectContaining({ status: "canceled" }));
      expect(await submitOrder(online())).toMatchObject({ ok: false, requiresDeliveryRefresh: true });
      expect(state.createPayment).toHaveBeenCalledTimes(1);
      expect(await submitOrder({ ...online(), deliveryToken: "new-token" })).toMatchObject({ ok: true, paymentUrl: "https://pay.example/order-2" });
      expect(state.createPayment).toHaveBeenCalledTimes(2);
      expect(state.enqueue).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("requires pickup confirmation when a token is missing", async () => {
    expect(await submitOrder({ ...online(), deliveryToken: undefined })).toMatchObject({ ok: false, requiresDeliveryRefresh: true });
    expect(state.addOrder).not.toHaveBeenCalled();
  });

  it("requires pickup confirmation if saving fails after consuming the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.addOrder.mockImplementation(() => { throw new Error("disk unavailable"); });
    try {
      expect(await submitOrder(online())).toMatchObject({ ok: false, requiresDeliveryRefresh: true });
      expect(state.consumeDelivery).toHaveBeenCalledOnce();
      expect(state.createPayment).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it.each([false, true])("saves the displayed total for online=%s", async (pay) => {
    state.createPayment.mockResolvedValue({ url: "https://pay.example/order", token: "payment", amount: 2300 });
    const expectedTotal = pay ? 2300 : 2000;
    expect(await submitOrder({ ...online(), pay, expectedTotal })).toMatchObject({ ok: true });
    expect(state.addOrder).toHaveBeenCalledWith(expect.objectContaining({ total: expectedTotal }));
    if (!pay) {
      expect(state.consumeDelivery).not.toHaveBeenCalled();
      expect(state.createPayment).not.toHaveBeenCalled();
      expect(state.addOrder.mock.calls[0][0].delivery).toBeUndefined();
    }
  });
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
