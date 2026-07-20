import products from "@data/products.json";
import type { Product } from "./types";

/*
  Индекс для мгновенного поиска в шапке.

  Каталог небольшой (145 позиций), поэтому индекс уезжает в браузер целиком
  (~33 КБ) и поиск работает без единого запроса к серверу — подсказки
  появляются мгновенно. Когда каталог вырастет, эту же функцию заменит
  запрос к API, сигнатура сохранится.
*/

export interface SearchHit {
  slug: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  image: string;
}

const index: SearchHit[] = (products as Product[]).map((p) => ({
  slug: p.slug,
  title: p.title,
  brand: p.brand,
  category: p.category,
  price: p.price,
  image: p.image,
}));

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

/**
 * Ищет по названию и бренду. Совпадение с начала слова весит больше,
 * чем совпадение в середине, — так наверху оказывается ожидаемое.
 */
export function searchProducts(query: string, limit = 6): SearchHit[] {
  const q = norm(query);
  if (q.length < 2) return [];

  const words = q.split(/\s+/).filter(Boolean);

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of index) {
    const title = norm(hit.title);
    const brand = norm(hit.brand);

    // Все слова запроса должны найтись — иначе это не наш товар
    if (!words.every((w) => title.includes(w) || brand.includes(w))) continue;

    let score = 0;
    if (title.startsWith(q)) score += 100;
    else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title))
      score += 60;
    else score += 20;
    if (brand.startsWith(q)) score += 40;
    // Короткие названия чаще оказываются точнее по смыслу
    score -= Math.min(20, title.length / 12);

    scored.push({ hit, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hit);
}

/** Сколько всего товаров подходит под запрос — для строки «показать все». */
export function countMatches(query: string): number {
  const q = norm(query);
  if (q.length < 2) return 0;
  const words = q.split(/\s+/).filter(Boolean);
  return index.filter((hit) => {
    const t = norm(hit.title);
    const b = norm(hit.brand);
    return words.every((w) => t.includes(w) || b.includes(w));
  }).length;
}
