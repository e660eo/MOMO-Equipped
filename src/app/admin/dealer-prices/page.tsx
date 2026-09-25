import Link from "next/link";
import { requireSession } from "@/lib/admin-auth";
import { b2bPriceCounts, getB2BPriceBook } from "@/lib/b2b-prices";
import { DealerPriceImportForm } from "@/components/admin/dealer-price-import-form";

export default async function AdminDealerPricesPage() {
  await requireSession();
  const book = getB2BPriceBook();
  return <div className="max-w-6xl">
    <Link href="/admin/dealers" className="text-sm text-muted-foreground hover:text-signal">← Дилеры</Link>
    <h1 className="mt-4 font-display text-3xl font-extrabold uppercase">Обновить дилерский прайс</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Загрузите новый Excel, проверьте изменения и подтвердите замену. Цены применятся одновременно ко всем дилерам. Отрезки кабеля исключены; товары без цены будут скрыты из дилерского заказа.</p>
    <div className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm">
      <p className="font-semibold">Сейчас в прайсе: {b2bPriceCounts(book).dealer} позиций</p>
      <p className="mt-1 break-words text-muted-foreground">{book.sources.dealer || "Файл пока не загружен"}{book.updatedAt ? ` · обновлён ${new Date(book.updatedAt).toLocaleString("ru-RU")}` : ""}</p>
    </div>
    <DealerPriceImportForm />
  </div>;
}
