import { describe, expect, it } from "vitest";
import {
  dealerDraftCounts,
  parseDealerOrderDraft,
  serializeDealerOrderDraft,
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
});
