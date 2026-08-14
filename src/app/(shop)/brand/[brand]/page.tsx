import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBrands, getCategories, getProducts } from "@/lib/data";
import { isInStock } from "@/lib/format";
import { BRAND_LANDINGS } from "@/lib/seo-landings";
import { SeoCatalogLanding } from "@/components/seo-catalog-landing";

const SEO_BRANDS = ["momo", "zeus"] as const;

export function generateStaticParams() {
  return SEO_BRANDS.map((brand) => ({ brand }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>;
}): Promise<Metadata> {
  const { brand: slug } = await params;
  const landing = BRAND_LANDINGS[slug];
  if (!landing) return { title: "Бренд не найден" };

  return {
    title: { absolute: landing.metaTitle },
    description: landing.metaDescription,
    alternates: { canonical: `/brand/${slug}` },
    openGraph: {
      title: landing.metaTitle,
      description: landing.metaDescription,
      type: "website",
      url: `/brand/${slug}`,
    },
  };
}

export default async function BrandLandingPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand: slug } = await params;
  const landing = BRAND_LANDINGS[slug];
  const brand = getBrands().find((item) => item.slug === slug);
  if (!brand || !landing) notFound();

  const products = getProducts()
    .filter((product) => product.brand === brand.title)
    .sort((a, b) => {
      const stock = Number(isInStock(b) === true) - Number(isInStock(a) === true);
      return stock || b.price - a.price;
    });

  const categorySlugs = new Set(products.map((product) => product.category));
  const relatedLinks = getCategories()
    .filter((category) => categorySlugs.has(category.slug))
    .map((category) => ({
      href: `/catalog/${category.slug}`,
      label: category.title,
    }));

  return (
    <SeoCatalogLanding
      {...landing}
      products={products}
      total={products.length}
      catalogHref={`/catalog?brand=${encodeURIComponent(brand.title)}`}
      relatedLinks={relatedLinks}
      crumbs={[
        { name: "Главная", url: "/" },
        { name: "Бренды", url: "/about#brands" },
        { name: brand.title, url: `/brand/${slug}` },
      ]}
    />
  );
}
