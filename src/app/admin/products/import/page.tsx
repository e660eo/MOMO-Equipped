import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { SpecsImport } from "@/components/admin/specs-import";

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
        Импорт характеристик
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Заливает характеристики сразу многим товарам из одного файла — чтобы не
        вбивать по одному.
      </p>

      <div className="mt-7">
        <SpecsImport />
      </div>
    </div>
  );
}
