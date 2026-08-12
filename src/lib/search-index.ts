import type { Product } from "./types";

/*
  Поиск по каталогу для живых подсказок в шапке.

  Раньше модуль импортировал data/products.json на этапе сборки и вшивал
  прайс в клиентский бандл: подсказки показывали цены на момент последнего
  коммита данных, а не то, что владелец правит в /admin (карточки и каталог
  читают живую папку в рантайме — отсюда расходилась цена). Теперь данные
  приходят из рантайма через /api/search. В HTML и клиентский бандл полный
  индекс больше не попадает. Здесь остаётся чистая серверная логика ранжирования.
*/

export interface SearchHit {
  slug: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  image: string;
}

/**
 * Облегчённая карточка для браузера — только поля, видимые в подсказке.
 * Отсекает всё лишнее из Product, чтобы в бандл не уезжали характеристики,
 * описания и прочее, чего поиску знать незачем.
 */
export function toSearchHits(products: Product[]): SearchHit[] {
  return products.map((p) => ({
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    category: p.category,
    price: p.price,
    image: p.image,
  }));
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

interface Indexed extends SearchHit {
  nTitle: string;
  nBrand: string;
}

/** Готовый к поиску индекс. Строится серверным поисковым endpoint. */
export type SearchIndex = Indexed[];

/**
 * Приводит названия к нижнему регистру один раз, а не на каждое нажатие
 * клавиши. Раньше это делалось при загрузке модуля над вшитым прайсом; теперь
 * над живыми данными, но так же однократно — при построении индекса.
 */
export function buildSearchIndex(hits: SearchHit[]): SearchIndex {
  return hits.map((h) => ({
    ...h,
    nTitle: norm(h.title),
    nBrand: norm(h.brand),
  }));
}

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
 * Ищет по названию и бренду в готовом индексе. Совпадение с начала слова весит
 * больше, чем в середине, — так наверху оказывается ожидаемое. Возвращает и
 * верхушку, и общее число: строке «показать все» нужен полный счёт.
 */
export function searchIndex(
  index: SearchIndex,
  query: string,
  limit = 6,
): SearchResult {
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
