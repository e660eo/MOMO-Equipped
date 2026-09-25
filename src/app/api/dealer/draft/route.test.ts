import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDealerDraft } from "@/lib/dealer-order-draft";
const state = vi.hoisted(() => ({ dealer: vi.fn(), change: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/dealer-auth", () => ({ currentDealer: state.dealer }));
vi.mock("@/lib/dealer-drafts", () => ({ changeDealerDraft: state.change, getDealerDraft: state.read }));
import { GET, POST } from "./route";

const mutation = { id: "12345678-1234-1234-1234-123456789abc", mode: "adjust", lines: [{ slug: "sub", qty: 2 }] };
function request(body: unknown, origin = "https://shop.test") {
  return new Request("https://shop.test/api/dealer/draft", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  state.dealer.mockResolvedValue({ account: { id: "alice" } });
  state.read.mockReturnValue(emptyDealerDraft());
  state.change.mockReturnValue({ ...emptyDealerDraft(), quantities: { sub: 2 } });
});
describe("authenticated dealer draft API", () => {
  it("requires authentication for reads and writes", async () => {
    state.dealer.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ accountId: "alice", mutation }))).status).toBe(401);
    expect(state.change).not.toHaveBeenCalled();
  });
  it("rejects cross-site writes and queued writes belonging to another account", async () => {
    expect((await POST(request({ accountId: "alice", mutation }, "https://other.test"))).status).toBe(403);
    expect((await POST(request({ accountId: "bob", mutation }))).status).toBe(409);
    expect(state.change).not.toHaveBeenCalled();
  });
  it("returns only the authenticated account draft and forbids caching", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.read).toHaveBeenCalledWith("alice");
    expect(await response.json()).toMatchObject({ accountId: "alice", draft: { quantities: {} } });
  });
  it("accepts the public Host header behind a reverse proxy", async () => {
    const response = await POST(new Request("http://localhost:3000/api/dealer/draft", {
      method: "POST", headers: { host: "shop.test", origin: "https://shop.test", "content-type": "application/json" },
      body: JSON.stringify({ accountId: "alice", mutation }),
    }));
    expect(response.status).toBe(200);
    expect(state.change).toHaveBeenCalledWith("alice", mutation);
  });
  it("rejects malformed operations, duplicate lines, and oversized comments", async () => {
    for (const bad of [
      { ...mutation, lines: [{ slug: "sub", qty: 1000 }] },
      { ...mutation, lines: [mutation.lines[0], mutation.lines[0]] },
      { ...mutation, comment: "x".repeat(701) },
      { ...mutation, lines: [{ slug: "__proto__", qty: 1 }] },
    ]) expect((await POST(request({ accountId: "alice", mutation: bad }))).status).toBe(400);
    expect(state.change).not.toHaveBeenCalled();
  });
  it("allows decrements without turning them into whole draft replacement", async () => {
    const decrement = { ...mutation, lines: [{ slug: "sub", qty: -1 }], comment: "Доставка" };
    expect((await POST(request({ accountId: "alice", mutation: decrement }))).status).toBe(200);
    expect(state.change).toHaveBeenCalledWith("alice", decrement);
  });
});
