import { describe, expect, it } from "vitest";
import {
  dealerDraftCounts,
  parseDealerOrderDraft,
  serializeDealerOrderDraft,
  dealerDraftStorageKey,
  applyDealerDraftMutation,
  emptyDealerDraft,
  validDealerDraftMutation,
} from "./dealer-order-draft";

describe("dealer order draft", () => {
  it("rejects malformed and outdated values", () => {
    expect(parseDealerOrderDraft("not json")).toBeNull();
    expect(parseDealerOrderDraft('{"version":2}')).toBeNull();
  });

  it("keeps only safe quantities", () => {
    const draft = parseDealerOrderDraft(JSON.stringify({
      version: 1,
      quantities: { amp: 2, sub: 0, cable: 1000, bad: "x" },
      comment: "Позвонить перед отгрузкой",
      updatedAt: "2026-08-19T10:00:00.000Z",
    }));
    expect(draft?.quantities).toEqual({ amp: 2 });
    expect(dealerDraftCounts(draft)).toEqual({ positions: 1, units: 2 });
  });

  it("serializes a reusable versioned draft", () => {
    const raw = serializeDealerOrderDraft({ amp: 2, sub: 1 }, "Комментарий", "fixed");
    expect(parseDealerOrderDraft(raw)).toEqual({
      version: 1,
      quantities: { amp: 2, sub: 1 },
      comment: "Комментарий",
      updatedAt: "fixed",
    });
  });

  it("uses separate account keys and never shares the legacy common key", () => {
    expect(dealerDraftStorageKey("alice")).not.toBe(dealerDraftStorageKey("bob"));
    expect(dealerDraftStorageKey("alice")).not.toBe("momo:dealer-order-draft:v1");
  });

  it("supports a full catalogue and bounds the result of simultaneous edits", () => {
    const mutation = { id: "12345678-1234-1234-1234-123456789abc", mode: "adjust" as const, lines: Array.from({ length: 106 }, (_, index) => ({ slug: `product-${index}`, qty: 999 })) };
    expect(validDealerDraftMutation(mutation)).toBe(true);
    const initial = applyDealerDraftMutation(emptyDealerDraft(), mutation);
    expect(applyDealerDraftMutation(initial, { ...mutation, id: "second-unique-operation" }).quantities["product-0"]).toBe(999);
    expect(applyDealerDraftMutation(initial, { ...mutation, id: "third-unique-operation", lines: [{ slug: "product-0", qty: -999 }] }).quantities["product-0"]).toBeUndefined();
  });
});
