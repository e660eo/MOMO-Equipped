import { readJson } from "./store";
import type { DealerPriceTier } from "./types";

const PRICE_BOOK_FILE = "b2b-prices.json";

export const DEALER_PRICE_TIER_LABELS: Record<DealerPriceTier, string> = {
  dealer: "Дилерский прайс",
  dagestan: "Дагестанский прайс",
  wholesale: "Оптовый прайс",
};

export const DEALER_PRICE_TIERS = Object.keys(DEALER_PRICE_TIER_LABELS) as DealerPriceTier[];

export interface B2BPriceBook {
  version: number;
  updatedAt: string;
  sources: Partial<Record<DealerPriceTier, string>>;
  prices: Record<string, Partial<Record<DealerPriceTier, number>>>;
}

const EMPTY_PRICE_BOOK: B2BPriceBook = {
  version: 1,
  updatedAt: "",
  sources: {},
  prices: {},
};

/**
 * Закрытые цены хранятся только в MOMO_DATA_DIR и не попадают в публичный Git.
 * Пустая книга допустима локально и до первой защищённой загрузки на сервер.
 */
export function getB2BPriceBook(): B2BPriceBook {
  try {
    const book = readJson<B2BPriceBook>(PRICE_BOOK_FILE);
    if (!book || book.version !== 1 || !book.prices || typeof book.prices !== "object") return EMPTY_PRICE_BOOK;
    return book;
  } catch {
    return EMPTY_PRICE_BOOK;
  }
}

export function b2bPriceForSlug(
  slug: string,
  tier: DealerPriceTier,
  book: B2BPriceBook = getB2BPriceBook(),
): number | undefined {
  const value = book.prices[slug]?.[tier];
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

export function b2bPriceCounts(book: B2BPriceBook = getB2BPriceBook()): Record<DealerPriceTier, number> {
  return DEALER_PRICE_TIERS.reduce((counts, tier) => {
    counts[tier] = Object.values(book.prices).filter((prices) => Number.isSafeInteger(prices[tier]) && Number(prices[tier]) > 0).length;
    return counts;
  }, { dealer: 0, dagestan: 0, wholesale: 0 });
}
