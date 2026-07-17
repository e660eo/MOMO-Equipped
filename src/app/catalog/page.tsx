import { Suspense } from "react";
import type { Metadata } from "next";
import { getProducts, getCategories, getBrands } from "@/lib/data";
import { CatalogView } from "@/components/catalog-view";

export const metadata: Metadata = {
  title: "Каталог",
  description:
    "Каталог автоакустики MOMO: сабвуферы, усилители, динамики, мультимедиа, автосвет и аксессуары. 145 товаров с фильтрами по категориям и брендам.",
};

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
