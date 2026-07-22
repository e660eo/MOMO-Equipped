import Link from "next/link";
import { getCategories, getBrands } from "@/lib/data";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function NewProductPage() {
  await requireAdminPage();

  return (
    <div>
      <Link
        href="/admin/products"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← К списку товаров
      </Link>
      <h1 className="mt-3 font-display text-xl font-extrabold uppercase">
        Новый товар
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Появится в каталоге сразу после сохранения.
      </p>

      <div className="mt-7">
        <ProductForm categories={getCategories()} brands={getBrands()} />
      </div>
    </div>
  );
}
