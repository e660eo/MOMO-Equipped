export const DEALER_ORDER_DRAFT_STORAGE_KEY = "momo:dealer-order-draft:v1";

// The old unscoped key is deliberately never imported into an authenticated
// draft: we cannot know which dealer created it on a shared computer.
export const dealerDraftStorageKey = (accountId: string) => `momo:dealer-draft:v2:${encodeURIComponent(accountId)}`;
export type DealerDraftMutation = {
  id: string;
  mode: "adjust" | "consume";
  lines: Array<{ slug: string; qty: number }>;
  comment?: string;
};
export type SyncedDealerDraft = DealerOrderDraft & { revision: number; applied: string[] };
export function emptyDealerDraft(): SyncedDealerDraft {
  return { version: 1, quantities: {}, comment: "", updatedAt: "", revision: 0, applied: [] };
}

export function validDealerDraftMutation(value: unknown): value is DealerDraftMutation {
  if (!value || typeof value !== "object") return false;
  const input = value as DealerDraftMutation;
  return typeof input.id === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(input.id)
    && (input.mode === "adjust" || input.mode === "consume")
    && Array.isArray(input.lines) && input.lines.length <= 500
    && input.lines.every((line) => line && typeof line.slug === "string"
      && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,249}$/.test(line.slug)
      && !["constructor", "prototype"].includes(line.slug)
      && Number.isSafeInteger(line.qty) && line.qty >= (input.mode === "adjust" ? -999 : 0) && line.qty <= 999)
    && new Set(input.lines.map((line) => line.slug)).size === input.lines.length
    && (input.comment === undefined || (typeof input.comment === "string" && input.comment.length <= 700));
}

export function applyDealerDraftMutation(draft: SyncedDealerDraft, mutation: DealerDraftMutation): SyncedDealerDraft {
  if (draft.applied.includes(mutation.id)) return draft;
  const quantities = { ...draft.quantities };
  for (const line of mutation.lines) {
    const qty = Math.max(0, Math.min(999, (quantities[line.slug] ?? 0) + (mutation.mode === "consume" ? -line.qty : line.qty)));
    if (qty) quantities[line.slug] = qty;
    else delete quantities[line.slug];
  }
  let comment = draft.comment;
  if (mutation.comment !== undefined) {
    if (mutation.mode === "adjust") comment = mutation.comment;
    else if (comment === mutation.comment) comment = "";
  }
  return { ...draft, quantities, comment, revision: draft.revision + 1, applied: [...draft.applied, mutation.id].slice(-512) };
}

export interface DealerOrderDraft {
  version: 1;
  quantities: Record<string, number>;
  comment: string;
  updatedAt: string;
}

function cleanQuantities(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [slug, rawQty] of Object.entries(value)) {
    const qty = Number(rawQty);
    if (!slug || !Number.isSafeInteger(qty) || qty < 1 || qty > 999) continue;
    result[slug] = qty;
  }
  return result;
}

export function parseDealerOrderDraft(raw: string | null | undefined): DealerOrderDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DealerOrderDraft>;
    if (!value || value.version !== 1) return null;
    return {
      version: 1,
      quantities: cleanQuantities(value.quantities),
      comment: typeof value.comment === "string" ? value.comment.slice(0, 700) : "",
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function serializeDealerOrderDraft(
  quantities: Record<string, number>,
  comment: string,
  updatedAt = new Date().toISOString(),
): string {
  return JSON.stringify({
    version: 1,
    quantities: cleanQuantities(quantities),
    comment: comment.slice(0, 700),
    updatedAt,
  } satisfies DealerOrderDraft);
}

export function dealerDraftCounts(draft: DealerOrderDraft | null): {
  positions: number;
  units: number;
} {
  const quantities = Object.values(draft?.quantities ?? {});
  return {
    positions: quantities.length,
    units: quantities.reduce((sum, qty) => sum + qty, 0),
  };
}
