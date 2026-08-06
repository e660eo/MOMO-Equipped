import { Suspense } from "react";
import type { Metadata } from "next";
import { getProducts, getCategories, getBrands } from "@/lib/data";
import { plural } from "@/lib/utils";
import { CatalogView } from "@/components/catalog-view";

// Фильтры нужны покупателю, но их комбинации не должны плодить в поиске
// дубли. Чистые страницы брендов и категорий индексируются отдельно, а URL
// с сортировкой, ценой и поиском закрываем от индексации.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const keys = Object.keys(params).filter((key) => params[key] !== undefined);
  const category = typeof params.category === "string" ? params.category : "";
  const brand = typeof params.brand === "string" ? params.brand : "";
  const knownCategory = getCategories().some((item) => item.slug === category);

  let canonical = "/catalog";
  if (keys.length === 1 && knownCategory) canonical = `/catalog/${category}`;
  if (keys.length === 1 && /^(MOMO|ZEUS)$/i.test(brand))
    canonical = `/brand/${brand.toLowerCase()}`;

  return {
    title: "Каталог",
    description: `Каталог автоакустики MOMO: сабвуферы, усилители, динамики, мультимедиа, автосвет и аксессуары. ${getProducts().length} ${plural(getProducts().length, "товар", "товара", "товаров")} с фильтрами по категориям и брендам.`,
    alternates: { canonical },
    robots: keys.length > 0 ? { index: false, follow: true } : undefined,
  };
}

export default function CatalogPage() {
  const products = getProducts();
  const categories = getCategories();
  const brands = getBrands();

  return (
    <main>
      <Suspense fallback={<div className="mx-auto max-w-[1200px] px-6 py-14" />}>
        <CatalogView products={products} categories={categories} brands={brands} />
      </Suspense>
    </main>
  );
}
