import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/data";
import { isInStock } from "@/lib/format";
import { CATEGORY_LANDINGS } from "@/lib/seo-landings";
import { SeoCatalogLanding } from "@/components/seo-catalog-landing";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategory(slug);
  const landing = CATEGORY_LANDINGS[slug];
  if (!category || !landing) return { title: "Раздел не найден" };

  return {
    title: { absolute: landing.metaTitle },
    description: landing.metaDescription,
    alternates: { canonical: `/catalog/${slug}` },
    openGraph: {
      title: landing.metaTitle,
      description: landing.metaDescription,
      type: "website",
      url: `/catalog/${slug}`,
    },
  };
}

export default async function CategoryLandingPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  const landing = CATEGORY_LANDINGS[slug];
  if (!category || !landing) notFound();

  const products = getProductsByCategory(slug).sort((a, b) => {
    const stock = Number(isInStock(b) === true) - Number(isInStock(a) === true);
    return stock || b.price - a.price;
  });

  const relatedLinks = [
    { href: "/brand/momo", label: "Автоакустика MOMO" },
    { href: "/brand/zeus", label: "Автоакустика ZEUS" },
    ...getCategories()
      .filter((item) => item.slug !== slug)
      .slice(0, 4)
      .map((item) => ({
        href: `/catalog/${item.slug}`,
        label: item.title,
      })),
  ];

  return (
    <SeoCatalogLanding
      {...landing}
      products={products}
      total={products.length}
      catalogHref={`/catalog?category=${encodeURIComponent(slug)}`}
      relatedLinks={relatedLinks}
      crumbs={[
        { name: "Главная", url: "/" },
        { name: "Каталог", url: "/catalog" },
        { name: category.title, url: `/catalog/${slug}` },
      ]}
    />
  );
}
