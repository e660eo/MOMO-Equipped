import type { MetadataRoute } from "next";
import { getProducts, getCategories, getNews } from "@/lib/data";
import { SITE_URL as BASE } from "@/lib/site-url";

/*
  Карта сайта: статические страницы + все карточки товаров, категории и новости.
  Нужна при переезде домена — поисковики должны быстро переобойти каталог.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  // Даты изменения не выдумываем: каталог правится из панели без пересборки,
  // поэтому `new Date()` ложно сообщал роботу, будто все страницы обновились
  // прямо сейчас при каждом запросе sitemap.
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/builder`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/listening-stand`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/brand/momo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/brand/zeus`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/sale`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/news`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/contacts`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/dealers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/become-dealer`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/install`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/delivery`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/requisites`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/offer`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categories: MetadataRoute.Sitemap = getCategories().map((c) => ({
    url: `${BASE}/catalog/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const products: MetadataRoute.Sitemap = getProducts().map((p) => ({
    url: `${BASE}/product/${p.slug}`,
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
