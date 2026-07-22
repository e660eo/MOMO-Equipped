import Link from "next/link";
import { notFound } from "next/navigation";
import { getRawBundles, getProducts } from "@/lib/data";
import { BundleForm } from "@/components/admin/bundle-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function EditBundlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdminPage();

  const { slug } = await params;
  const bundle = getRawBundles().find((b) => b.slug === slug);
  if (!bundle) notFound();

  return (
    <div>
      <Link
        href="/admin/bundles"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← К сборкам
      </Link>
      <h1 className="mt-3 font-display text-xl font-extrabold uppercase">
        {bundle.title}
      </h1>
      <div className="mt-7">
        <BundleForm bundle={bundle} products={getProducts()} />
      </div>
    </div>
  );
}
