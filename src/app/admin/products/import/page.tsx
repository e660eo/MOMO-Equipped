import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { ApplyBundledSpecs } from "@/components/admin/apply-bundled-specs";
import { SpecsImport } from "@/components/admin/specs-import";
import { CatalogDataImport } from "@/components/admin/catalog-data-import";

export default async function ImportSpecsPage() {
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
        Импорт данных каталога
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Массово обновляет цены, остатки и характеристики с предварительной проверкой.
      </p>

      <div className="mt-7"><CatalogDataImport /></div>

      <div className="mt-8">
        <ApplyBundledSpecs />
      </div>

      <details className="mt-8 max-w-[680px]">
        <summary className="cursor-pointer text-[0.85rem] text-muted-foreground transition-colors hover:text-signal">
          Загрузить свой файл JSON (для других наборов)
        </summary>
        <div className="mt-4">
          <SpecsImport />
        </div>
      </details>
    </div>
  );
}
