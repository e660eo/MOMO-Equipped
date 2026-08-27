import { Suspense } from "react";
import type { Metadata } from "next";
import { getProducts, getCategories, getBrands } from "@/lib/data";
import { plural } from "@/lib/utils";
import { CatalogView } from "@/components/catalog-view";
import { toCatalogProduct } from "@/lib/catalog-product";
import { publicPageMetadata } from "@/lib/seo-metadata";

// Filter/query state is read by CatalogView after hydration. The HTML shell and
// product projection are identical for every query, so cache them as one page.
export const dynamic = "force-static";

const productCount = getProducts().length;
export const metadata: Metadata = publicPageMetadata(
  "Каталог",
  `Каталог автоакустики MOMO: сабвуферы, усилители, динамики, мультимедиа, автосвет и аксессуары. ${productCount} ${plural(productCount, "товар", "товара", "товаров")} с фильтрами по категориям и брендам.`,
  "/catalog",
);

export default function CatalogPage() {
  const products = getProducts().map(toCatalogProduct);
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
