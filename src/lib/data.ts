import products from "@data/products.json";
import categories from "@data/categories.json";
import brands from "@data/brands.json";
import news from "@data/news.json";
import site from "@data/site.json";
import type { Product, Category, Brand, NewsItem } from "./types";

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
  return `${site.imageBase}${image}`;
}

/** Платёж при оплате частями: 4 равных платежа, копейки округляются вверх. */
export function splitPayment(price: number): number {
  return Math.ceil(price / 4);
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}
