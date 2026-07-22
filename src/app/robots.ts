import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Панель управления — не для поисковиков
      disallow: ["/admin", "/admin/"],
    },
    sitemap: "https://momo-eq.ru/sitemap.xml",
    host: "https://momo-eq.ru",
  };
}
