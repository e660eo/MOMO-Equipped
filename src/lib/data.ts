import products from "@data/products.json";
import categories from "@data/categories.json";
import brands from "@data/brands.json";
import news from "@data/news.json";
import site from "@data/site.json";
import bundlesData from "@data/bundles.json";
import type {
  Product,
  Category,
  Brand,
  NewsItem,
  Bundle,
  ResolvedBundle,
} from "./types";

/*
  Слой данных v1: локальные JSON-файлы, собранные с momo-eq.ru.
  В фазе CMS эти функции сохранят сигнатуры, но начнут читать из Sanity —
  страницы переписывать не придётся.
*/

export const siteConfig = site;

export function getProducts(): Product[] {
  return products as Product[];
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
  return (bundlesData as Bundle[]).map((b) => {
    const products = b.items
      .map((slug) => getProduct(slug))
      .filter((p): p is Product => Boolean(p));
    const fullPrice = products.reduce((sum, p) => sum + p.price, 0);
    const price =
      Math.round((fullPrice * (100 - b.discountPercent)) / 100 / 10) * 10;
    return { ...b, products, fullPrice, price, saving: fullPrice - price };
  });
}

export function getCategories(): Category[] {
  return categories as Category[];
}

export function getCategory(slug: string): Category | undefined {
  return getCategories().find((c) => c.slug === slug);
}

export function getBrands(): Brand[] {
  return brands as Brand[];
}

export function getNews(): NewsItem[] {
  return news as NewsItem[];
}

export function productImageUrl(image: string): string {
  // Фото, выгруженные из прайса, лежат в public/ и уже абсолютны —
  // им база со старого сайта не нужна.
  if (image.startsWith("/")) return image;
  return `${site.imageBase}${image}`;
}

/** Платёж при оплате частями: 4 равных платежа, копейки округляются вверх. */
export function splitPayment(price: number): number {
  return Math.ceil(price / 4);
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}
