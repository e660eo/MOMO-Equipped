import Link from "next/link";
import { getProducts, getCategories } from "@/lib/data";
import { BundleForm } from "@/components/admin/bundle-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function NewBundlePage() {
  await requireAdminPage();

  return (
    <div>
      <Link
        href="/admin/bundles"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← К сборкам
      </Link>
      <h1 className="mt-3 font-display text-xl font-extrabold uppercase">
        Новая сборка
      </h1>
      <div className="mt-7">
        <BundleForm products={getProducts()} categories={getCategories()} />
      </div>
    </div>
  );
}
