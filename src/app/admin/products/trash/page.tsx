import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getDeletedProducts } from "@/lib/product-trash";
import { productImageUrl } from "@/lib/format";
import { purgeExpiredTrash, restoreProduct } from "../actions";

export default async function ProductTrashPage() {
  await requireAdminPage();
  const records = getDeletedProducts();
  return <div>
    <Link href="/admin/products" className="text-[0.82rem] text-muted-foreground hover:text-signal">← К товарам</Link>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-xl font-extrabold uppercase">Корзина товаров</h1><p className="mt-1 text-[0.85rem] text-muted-foreground">Товар и его фотографии хранятся 30 дней, затем удаляются окончательно.</p></div>
      <form action={purgeExpiredTrash}><button type="submit" className="rounded-sm border border-border px-4 py-2 text-[0.82rem] hover:border-signal hover:text-signal">Очистить просроченные</button></form>
    </div>
    {records.length === 0 ? <p className="py-14 text-center text-muted-foreground">Корзина пуста.</p> : <div className="mt-6 grid gap-3">
      {records.map(({ product, deletedAt, purgeAfter }) => <article key={product.slug} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={productImageUrl(product.image)} alt="" className="h-14 w-14 rounded-sm border border-border bg-tile object-contain" />
        <div className="min-w-0 flex-1"><p className="font-medium">{product.title}</p><p className="mt-1 text-[0.75rem] text-muted-foreground">Удалён {new Date(deletedAt).toLocaleString("ru-RU")} · хранится до {new Date(purgeAfter).toLocaleDateString("ru-RU")}</p></div>
        <form action={restoreProduct}><input type="hidden" name="slug" value={product.slug} /><button type="submit" className="rounded-sm bg-signal px-4 py-2 text-[0.82rem] font-semibold text-white">Восстановить</button></form>
      </article>)}
    </div>}
  </div>;
}
