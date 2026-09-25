import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ customer: vi.fn(), change: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/customer-auth", () => ({ currentCustomer: state.customer }));
vi.mock("@/lib/customer-carts", () => ({ changeCustomerCart: state.change, getCustomerCart: state.read }));
vi.mock("@/lib/data", () => ({
  getProducts: () => [{ slug: "sub", title: "Sub", price: 2000, stock: 3, image: "/test.png" }],
  getBundles: () => [],
}));
import { GET, POST } from "./route";

const mutation = { id: "12345678-1234-1234-1234-123456789abc", mode: "patch", lines: [{ slug: "sub", qty: 2 }] };
function request(body: unknown, origin = "https://shop.test") {
  return new Request("https://shop.test/api/customer/cart", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  state.customer.mockResolvedValue({ id: "alice" });
  state.read.mockReturnValue([{ slug: "sub", qty: 2 }]);
  state.change.mockImplementation((_id, value) => value.lines);
});
describe("authenticated cart API", () => {
  it("requires authentication for reads and writes", async () => {
    state.customer.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ customerId: "alice", mutation }))).status).toBe(401);
    expect(state.change).not.toHaveBeenCalled();
  });
  it("rejects cross-site writes and queued writes for a previous account", async () => {
    expect((await POST(request({ customerId: "alice", mutation }, "https://other.test"))).status).toBe(403);
    expect((await POST(request({ customerId: "bob", mutation }))).status).toBe(409);
    expect(state.change).not.toHaveBeenCalled();
  });
  it("returns current catalogue data privately and only for the signed-in customer", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(state.read).toHaveBeenCalledWith("alice");
    expect(await response.json()).toMatchObject({ customerId: "alice", items: [{ slug: "sub", qty: 2, price: 2000 }] });
  });
  it("accepts the public host when Next runs behind a reverse proxy", async () => {
    const response = await POST(new Request("http://localhost:3000/api/customer/cart", {
      method: "POST", headers: { host: "shop.test", origin: "https://shop.test", "content-type": "application/json" },
      body: JSON.stringify({ customerId: "alice", mutation }),
    }));
    expect(response.status).toBe(200);
    expect(state.change).toHaveBeenCalledOnce();
  });
  it("validates quantities and uses catalogue stock instead of browser prices", async () => {
    expect((await POST(request({ customerId: "alice", mutation: { ...mutation, lines: [{ slug: "sub", qty: -1 }] } }))).status).toBe(400);
    const response = await POST(request({ customerId: "alice", mutation: { ...mutation, lines: [{ slug: "sub", qty: 99, price: 1 }] } }));
    expect(state.change).toHaveBeenCalledWith("alice", { ...mutation, lines: [{ slug: "sub", qty: 3 }] });
    expect(await response.json()).toMatchObject({ items: [{ slug: "sub", qty: 3, price: 2000 }] });
  });
});
