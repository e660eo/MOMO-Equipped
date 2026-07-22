import Link from "next/link";
import { getBundles, formatPrice } from "@/lib/data";
import { plural } from "@/lib/utils";
import { deleteBundle } from "./actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function AdminBundlesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();

  const { saved } = await searchParams;
  const bundles = getBundles();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase">Сборки</h1>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            Готовые комплекты на главной. Цена считается по составу и скидке.
          </p>
        </div>
        <Link
          href="/admin/bundles/new"
          className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Собрать комплект
        </Link>
      </div>

      {saved && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже на сайте.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((b) => (
          <div key={b.slug} className="rounded-xl border border-border bg-surface p-5">
            <p className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {b.tagline || "комплект"} · −{b.discountPercent}%
            </p>
            <Link
              href={`/admin/bundles/${b.slug}`}
              className="mt-1.5 block font-display text-[1.05rem] font-semibold transition-colors hover:text-signal"
            >
              {b.title}
            </Link>
            <p className="mt-2 text-[0.8rem] text-muted-foreground">
              {b.products.length}{" "}
              {plural(b.products.length, "товар", "товара", "товаров")} ·{" "}
              {formatPrice(b.price)}
            </p>
            <div className="mt-4 flex items-center gap-4 text-[0.8rem]">
              <Link href={`/admin/bundles/${b.slug}`} className="text-signal">
                Изменить
              </Link>
              <form action={deleteBundle}>
                <input type="hidden" name="slug" value={b.slug} />
                <ConfirmButton
                  label="Удалить"
                  question={`Удалить сборку «${b.title}»? Товары останутся в каталоге.`}
                />
              </form>
            </div>
          </div>
        ))}
      </div>

      {bundles.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">Сборок пока нет.</p>
      )}
    </div>
  );
}
