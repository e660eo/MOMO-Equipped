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

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

/*
  Приведённые названия считаем один раз при загрузке модуля, а не на каждое
  нажатие клавиши. Раньше и searchProducts, и countMatches проходили по всем
  145 товарам и для каждого заново звали toLowerCase + replace + trim по
  названию и бренду — около 580 разборов строк на одну букву, дважды, плюс
  свежий RegExp на каждый товар. На быстрой печати это и был подтормаживающий
  выпадающий список.
*/
interface Indexed extends SearchHit {
  nTitle: string;
  nBrand: string;
}

const index: Indexed[] = (products as Product[]).map((p) => ({
  slug: p.slug,
  title: p.title,
  brand: p.brand,
  category: p.category,
  price: p.price,
  image: p.image,
  nTitle: norm(p.title),
  nBrand: norm(p.brand),
}));

/** Совпадение с начала слова — граница слова слева от позиции вхождения. */
function startsWord(haystack: string, needle: string) {
  const i = haystack.indexOf(needle);
  if (i <= 0) return i === 0;
  return !/[a-zа-я0-9]/.test(haystack[i - 1]);
}

export interface SearchResult {
  hits: SearchHit[];
  /** Сколько всего подошло — для строки «показать все». */
  total: number;
}

/**
 * Ищет по названию и бренду. Совпадение с начала слова весит больше,
 * чем совпадение в середине, — так наверху оказывается ожидаемое.
 *
 * Возвращает и верхушку, и общее число: раньше это были два вызова, каждый со
 * своим полным проходом по каталогу.
 */
export function searchCatalog(query: string, limit = 6): SearchResult {
  const q = norm(query);
  if (q.length < 2) return { hits: [], total: 0 };

  const words = q.split(/\s+/).filter(Boolean);

  const scored: { hit: SearchHit; score: number }[] = [];
  let total = 0;

  for (const item of index) {
    const { nTitle, nBrand } = item;

    // Все слова запроса должны найтись — иначе это не наш товар
    let ok = true;
    for (const w of words) {
      if (!nTitle.includes(w) && !nBrand.includes(w)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    total++;
    // Дальше считаем вес только для верхушки — остальным он не нужен
    let score = 0;
    if (nTitle.startsWith(q)) score += 100;
    else if (startsWord(nTitle, q)) score += 60;
    else score += 20;
    if (nBrand.startsWith(q)) score += 40;
    // Короткие названия чаще оказываются точнее по смыслу
    score -= Math.min(20, nTitle.length / 12);

    scored.push({ hit: item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return { hits: scored.slice(0, limit).map((s) => s.hit), total };
}
