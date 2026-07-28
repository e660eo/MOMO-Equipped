import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProducts, getCategories, getBrands } from "@/lib/data";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ copied?: string }>;
}) {
  await requireAdminPage();

  const { slug } = await params;
  const { copied } = await searchParams;
  const product = getAllProducts().find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <div>
      <Link
        href="/admin/products"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← К списку товаров
      </Link>
      <h1 className="mt-3 font-display text-xl font-extrabold uppercase">
        {product.title}
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Адрес карточки: /product/{product.slug} — он не меняется при
        переименовании, чтобы не терять ссылки и место в поиске.
      </p>

      {copied && (
        <p className="mt-4 rounded-sm border border-signal bg-surface px-4 py-3 text-[0.85rem] leading-relaxed">
          Создана копия в уценку. Поставьте цену уценки и остаток, при желании
          поправьте название, затем снимите галочку «Скрыть с витрины» — и товар
          появится на распродаже. Исходный товар не изменился.
        </p>
      )}

      <div className="mt-7">
        <ProductForm
          product={product}
          categories={getCategories()}
          brands={getBrands()}
        />
      </div>
    </div>
  );
}
