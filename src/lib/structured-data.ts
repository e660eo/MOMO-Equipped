import { siteConfig, productImageUrl } from "./data";
import { isInStock } from "./format";
import { SITE_URL as BASE } from "./site-url";
import type { Product, Category } from "./types";

/*
  Разметка Schema.org (JSON-LD) для поисковиков. Принцип — утверждать только
  то, что есть в данных: наличие пишем лишь когда оно известно из прайса,
  описание — только если оно заполнено. Рейтинг и отзывы НЕ размечаем, пока
  они синтетические (см. src/lib/reviews.ts) — за фейковый aggregateRating
  поисковики снимают сниппет и накладывают санкции.

  Домен берём из src/lib/site-url.ts — там же его берут metadataBase, sitemap,
  robots и письма о заказах.
*/

/** Абсолютный URL: локальные пути дополняем доменом, внешние оставляем как есть. */
function absUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Организация-продавец. Ставится на всех страницах через layout. */
export function organizationSchema() {
  const { contacts, requisites } = siteConfig;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MOMO Equipped",
    legalName: requisites.fullName,
    alternateName: requisites.shortName,
    url: BASE,
    logo: `${BASE}/logo-3d.png`,
    image: `${BASE}/logo-3d.png`,
    email: contacts.email,
    telephone: contacts.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: "проспект Гамидова, 16",
      addressLocality: "Махачкала",
      addressRegion: "Республика Дагестан",
      postalCode: "367013",
      addressCountry: "RU",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: contacts.phone,
      contactType: "sales",
      areaServed: "RU",
      availableLanguage: "Russian",
    },
    sameAs: [requisites.website],
  };
}

/** Сайт + строка поиска: даёт шанс на sitelinks searchbox в выдаче. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MOMO Equipped",
    url: BASE,
    inLanguage: "ru-RU",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE}/catalog?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Карточка товара. Цена, валюта и — когда известно — наличие и описание. */
export function productSchema(product: Product, category?: Category) {
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url: `${BASE}/product/${product.slug}`,
    priceCurrency: "RUB",
    price: product.price,
    // Дата держится примерно на год вперёд от сборки — это ориентир для
    // поисковика, а не обязательство: рекомендуемое поле, без него Search
    // Console предупреждает.
    priceValidUntil: (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    })(),
    seller: { "@type": "Organization", name: "MOMO Equipped" },
  };

  // Наличие утверждаем только когда оно есть в прайсе. «Под заказ» → BackOrder.
  if (isInStock(product) === true)
    offer.availability = "https://schema.org/InStock";
  else if (isInStock(product) === false)
    offer.availability = "https://schema.org/BackOrder";

  // Состояние: обычный товар — новый. Уценённый «новым» не помечаем.
  if (!product.isClearance)
    offer.itemCondition = "https://schema.org/NewCondition";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: absUrl(productImageUrl(product.image)),
    brand: { "@type": "Brand", name: product.brand },
    offers: offer,
  };
  if (category) schema.category = category.title;
  if (product.description?.length)
    schema.description = product.description.join(" ");
  return schema;
}

/** Хлебные крошки для страницы товара. */
export function breadcrumbSchema(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absUrl(c.url),
    })),
  };
}
