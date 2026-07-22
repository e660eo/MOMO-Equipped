import { readJson } from "./store";
import type {
  Product,
  Category,
  Brand,
  NewsItem,
  Bundle,
  ResolvedBundle,
  SiteConfig,
} from "./types";

/*
  Слой данных: JSON-файлы из папки данных (см. store.ts).

  Функции намеренно остались синхронными — их зовут страницы, sitemap и
  generateStaticParams, а чтение идёт из кэша в памяти. Модуль серверный:
  клиентским компонентам нужны только формат цены и путь к фото, они лежат
  в отдельном `format.ts`.
*/

export const getSiteConfig = (): SiteConfig => readJson<SiteConfig>("site.json");

/**
 * Конфиг сайта для серверных компонентов. Клиентские берут его из
 * `SiteConfigProvider` — статический импорт JSON в браузер больше не уходит.
 */
export const siteConfig: SiteConfig = new Proxy({} as SiteConfig, {
  get: (_t, prop: string) => getSiteConfig()[prop as keyof SiteConfig],
});

/** Все товары, включая скрытые от покупателей. Для админки. */
export function getAllProducts(): Product[] {
  return readJson<Product[]>("products.json");
}

/** Товары витрины: скрытые из админки сюда не попадают. */
export function getProducts(): Product[] {
  return getAllProducts().filter((p) => !p.hidden);
}

export function getProduct(slug: string): Product | undefined {
  return getProducts().find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return getProducts().filter((p) => p.category === category);
}

/** Уценённые товары — витрина распродажи. */
export function getClearanceProducts(): Product[] {
  return getProducts().filter((p) => p.isClearance);
}

/**
 * Готовые сборки с подтянутыми товарами и пакетной ценой.
 * Товары с несуществующим slug молча отбрасываются, чтобы правка данных
 * не роняла страницу.
 */
export function getBundles(): ResolvedBundle[] {
  return readJson<Bundle[]>("bundles.json").map((b) => {
    const products = b.items
      .map((slug) => getProduct(slug))
      .filter((p): p is Product => Boolean(p));
    const fullPrice = products.reduce((sum, p) => sum + p.price, 0);
    const price =
      Math.round((fullPrice * (100 - b.discountPercent)) / 100 / 10) * 10;
    return { ...b, products, fullPrice, price, saving: fullPrice - price };
  });
}

export function getRawBundles(): Bundle[] {
  return readJson<Bundle[]>("bundles.json");
}

/**
 * Категории со счётчиком, посчитанным по самому каталогу: поле `count` в JSON
 * расходилось с товарами при каждой правке данных.
 */
export function getCategories(): Category[] {
  const counts = new Map<string, number>();
  for (const p of getProducts()) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return readJson<Category[]>("categories.json").map((c) => ({
    ...c,
    count: counts.get(c.slug) ?? 0,
  }));
}

export function getCategory(slug: string): Category | undefined {
  return getCategories().find((c) => c.slug === slug);
}

export function getBrands(): Brand[] {
  return readJson<Brand[]>("brands.json");
}

export function getNews(): NewsItem[] {
  return readJson<NewsItem[]>("news.json");
}

export { productImageUrl, splitPayment, formatPrice } from "./format";
