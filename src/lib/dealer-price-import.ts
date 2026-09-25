import crypto from "node:crypto";
import sourceMap from "./dealer-price-source-map.json";
import { normalizeDealerSource, type DealerWorkbookData, type DealerWorkbookRow } from "./dealer-workbook";
import type { B2BPriceBook } from "./b2b-prices";
import type { Product } from "./types";

export interface DealerPriceChange {
  slug: string;
  title: string;
  previous: number | null;
  next: number | null;
  kind: "changed" | "added" | "removed" | "unchanged";
  source?: { sheet: string; row: number; model: string; description: string; price: number; multiplier: number };
}

export interface DealerPriceImportPreview {
  id: string;
  fileName: string;
  createdAt: string;
  baseFingerprint: string;
  catalogFingerprint: string;
  changes: DealerPriceChange[];
  unmatched: DealerWorkbookRow[];
  conflicts: string[];
  ignoredCuts: number;
  nextBook: B2BPriceBook;
}

export type DealerPriceImportView = Omit<DealerPriceImportPreview, "baseFingerprint" | "catalogFingerprint" | "nextBook">;

export function dealerPriceFingerprint(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sourceKey(sheet: string, model: string, description: string): string {
  return JSON.stringify([sheet, model, description].map(normalizeDealerSource));
}

export function buildDealerPriceImport(
  workbook: DealerWorkbookData,
  products: Product[],
  current: B2BPriceBook,
  fileName: string,
  now = new Date(),
): DealerPriceImportPreview {
  const conflicts = [...workbook.errors];
  const grouped = new Map<string, DealerWorkbookRow[]>();
  for (const row of workbook.rows) {
    const key = sourceKey(row.sheet, row.model, row.description);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const cuts = new Set(sourceMap.excludedCuts);
  const bySlug = new Map(sourceMap.products.map((entry) => [entry.slug, entry]));
  const matchedRows = new Set<DealerWorkbookRow>();
  const prices: B2BPriceBook["prices"] = {};
  const changes: DealerPriceChange[] = [];
  for (const product of products) {
    const existing = current.prices[product.slug]?.dealer;
    const previous = Number.isFinite(existing) && Number(existing) > 0 ? Number(existing) : null;
    let next: number | null = null;
    let source: DealerPriceChange["source"];
    const mapping = bySlug.get(product.slug);
    if (!product.hidden && !product.isClearance && !cuts.has(product.slug) && mapping) {
      const candidates = grouped.get(sourceKey(mapping.sheet, mapping.model, mapping.description)) ?? [];
      candidates.forEach((row) => matchedRows.add(row));
      if (candidates.length > 1) {
        conflicts.push(`«${product.title}»: несколько одинаковых моделей и описаний на листе «${mapping.sheet}» (строки ${candidates.map((row) => row.row).join(", ")}). Оставьте одну строку.`);
      } else if (candidates.length === 1) {
        const row = candidates[0];
        if (row.sourcePrice === null) {
          conflicts.push(`«${product.title}», лист «${row.sheet}», строка ${row.row}: нет положительной числовой дилерской цены. Пересчитайте и сохраните формулы в Excel.`);
        } else {
          next = Math.round((row.sourcePrice * mapping.multiplier + Number.EPSILON) * 100) / 100;
          source = { sheet: row.sheet, row: row.row, model: row.model, description: row.description, price: row.sourcePrice, multiplier: mapping.multiplier };
          prices[product.slug] = { dealer: next };
        }
      }
    }
    if (previous === null && next === null) continue;
    const kind = previous === null ? "added" : next === null ? "removed" : previous === next ? "unchanged" : "changed";
    changes.push({ slug: product.slug, title: product.title, previous, next, kind, ...(source ? { source } : {}) });
  }
  // Unknown source rows are visible for review, never guessed or auto-created in the catalogue.
  const unmatched = workbook.rows.filter((row) => !matchedRows.has(row) && (row.sourcePrice !== null || row.description));
  if (!Object.keys(prices).length) conflicts.push("Ни одна позиция не сопоставлена с каталогом. Пустой прайс применять нельзя.");
  return {
    id: crypto.randomUUID(), fileName, createdAt: now.toISOString(),
    baseFingerprint: dealerPriceFingerprint(current), catalogFingerprint: dealerPriceFingerprint(products),
    changes, unmatched, conflicts, ignoredCuts: products.filter((product) => cuts.has(product.slug)).length,
    nextBook: { version: 1, updatedAt: now.toISOString(), sources: { dealer: fileName }, prices },
  };
}

export function dealerPriceImportView(preview: DealerPriceImportPreview): DealerPriceImportView {
  const { id, fileName, createdAt, changes, unmatched, conflicts, ignoredCuts } = preview;
  return { id, fileName, createdAt, changes, unmatched, conflicts, ignoredCuts };
}
