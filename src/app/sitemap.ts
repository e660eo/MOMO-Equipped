import type { MetadataRoute } from "next";
import { getProducts, getCategories, getNews } from "@/lib/data";
import { SITE_URL as BASE } from "@/lib/site-url";

/*
  Карта сайта: статические страницы + все карточки товаров, категории и новости.
  Нужна при переезде домена — поисковики должны быстро переобойти каталог.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // lastModified указываем сразу: промежуточный .map() расширил бы
  // литеральные типы changeFrequency до string и сломал типизацию.
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/sale`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/news`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/contacts`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/dealers`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/install`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/delivery`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/requisites`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categories: MetadataRoute.Sitemap = getCategories().map((c) => ({
    url: `${BASE}/catalog?category=${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const products: MetadataRoute.Sitemap = getProducts().map((p) => ({
    url: `${BASE}/product/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const news: MetadataRoute.Sitemap = getNews().map((n) => ({
    url: `${BASE}/news/${n.slug}`,
    lastModified: new Date(n.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticPages, ...categories, ...products, ...news];
}
