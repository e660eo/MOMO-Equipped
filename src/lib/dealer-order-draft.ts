export const DEALER_ORDER_DRAFT_STORAGE_KEY = "momo:dealer-order-draft:v1";

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
