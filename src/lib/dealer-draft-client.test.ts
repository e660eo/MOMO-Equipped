import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DealerDraftClient, dealerSubmissionId, finishDealerSubmission, getPendingDealerSubmission } from "./dealer-draft-client";
import { applyDealerDraftMutation, dealerDraftStorageKey, emptyDealerDraft, type SyncedDealerDraft } from "./dealer-order-draft";

describe("dealer draft browser recovery", () => {
  let data: Map<string, string>;
  let server: SyncedDealerDraft;
  let session: string;
  let loseResponse: boolean;
  const cleanups: Array<() => void> = [];
  beforeEach(() => {
    data = new Map();
    server = emptyDealerDraft();
    session = "alice";
    loseResponse = false;
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    vi.stubGlobal("localStorage", {
      get length() { return data.size; },
      key: (index: number) => [...data.keys()][index] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    });
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      if (options?.body) {
        const body = JSON.parse(options.body);
        if (body.accountId !== session) return new Response("{}", { status: 409 });
        server = applyDealerDraftMutation(server, body.mutation);
        if (loseResponse) { loseResponse = false; throw new Error("Response lost after commit"); }
      }
      return Response.json({ accountId: session, draft: server });
    }));
  });
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    finishDealerSubmission("alice");
    finishDealerSubmission("bob");
    vi.unstubAllGlobals();
  });
  function client(id = "alice") {
    const draft = new DealerDraftClient(id);
    cleanups.push(draft.subscribe(() => {}));
    return draft;
  }
  it("never attributes the old shared-browser draft to the logged-in dealer", async () => {
    data.set("momo:dealer-order-draft:v1", JSON.stringify({ version: 1, quantities: { sub: 7 }, comment: "Другой дилер" }));
    const draft = client();
    await draft.sync();
    expect(draft.getSnapshot()).toMatchObject({ draft: { quantities: {}, comment: "" }, status: "saved" });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("recovers a persisted mutation after a lost response and browser reload without doubling it", async () => {
    const first = client();
    await first.sync();
    loseResponse = true;
    first.setQuantity("sub", 2);
    await first.sync();
    expect(first.getSnapshot().status).toBe("offline");
    expect(server.quantities).toEqual({ sub: 2 });
    expect([...data.keys()].some((key) => key.includes(":pending:"))).toBe(true);
    const reloaded = client();
    await reloaded.sync();
    expect(reloaded.getSnapshot()).toMatchObject({ draft: { quantities: { sub: 2 } }, status: "saved" });
    expect([...data.keys()].some((key) => key.includes(":pending:"))).toBe(false);
    expect(server.quantities).toEqual({ sub: 2 });
  });
  it("refuses old-account writes after a session changes and does not leak them to the next dealer", async () => {
    const old = client();
    await old.sync();
    session = "bob";
    old.setQuantity("sub", 3);
    await old.sync();
    expect(old.getSnapshot().status).toBe("auth");
    expect(server.quantities).toEqual({});
    const next = client("bob");
    await next.sync();
    expect(next.getSnapshot().draft.quantities).toEqual({});
    expect([...data.keys()].some((key) => key.startsWith(`${dealerDraftStorageKey("alice")}:pending:`))).toBe(true);
  });
  it("consumes an accepted order while preserving additions and notes from another device", async () => {
    const draft = client();
    await draft.sync();
    draft.setQuantity("sub", 2);
    await draft.sync();
    server = applyDealerDraftMutation(server, { id: "other-device-changes", mode: "adjust", lines: [{ slug: "sub", qty: 1 }, { slug: "amp", qty: 2 }], comment: "Новая заметка" });
    draft.consume("12345678-1234-1234-1234-123456789abc", [{ slug: "sub", qty: 2 }], "");
    await draft.sync();
    expect(server).toMatchObject({ quantities: { sub: 1, amp: 2 }, comment: "Новая заметка" });
  });
  it("retains the original submission even when a reloaded page has new prices", () => {
    const id = dealerSubmissionId("alice", '[["sub",2],"",100]');
    expect(dealerSubmissionId("alice", '[["sub",2],"",100]')).toBe(id);
    expect(() => dealerSubmissionId("alice", '[["sub",2],"",120]')).toThrow();
    expect(getPendingDealerSubmission("alice")).toEqual({ id, payload: '[["sub",2],"",100]' });
    expect(getPendingDealerSubmission("bob")).toBeNull();
    finishDealerSubmission("alice");
    expect(dealerSubmissionId("alice", '[["sub",2],"",120]')).not.toBe(id);
  });
  it("continues syncing when local browser storage is full", async () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Full"); }, removeItem() { throw new Error("Denied"); }, get length() { throw new Error("Denied"); } });
    const draft = client();
    await draft.sync();
    draft.setQuantity("sub", 1);
    await draft.sync();
    expect(draft.getSnapshot().status).toBe("saved");
    expect(server.quantities).toEqual({ sub: 1 });
    expect(dealerSubmissionId("alice", "same")).toBe(dealerSubmissionId("alice", "same"));
  });
  it("does not clear a newer submission when a slow response from another tab arrives", () => {
    const oldId = dealerSubmissionId("alice", "original");
    finishDealerSubmission("alice", oldId);
    const nextId = dealerSubmissionId("alice", "new order");
    finishDealerSubmission("alice", oldId);
    expect(getPendingDealerSubmission("alice")?.id).toBe(nextId);
    // A different tab clears storage; this tab must not resurrect its old cache.
    data.delete(`${dealerDraftStorageKey("alice")}:submission`);
    expect(getPendingDealerSubmission("alice")).toBeNull();
  });
});
