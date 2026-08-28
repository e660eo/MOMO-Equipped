import Link from "next/link";
import { Headphones, Music2 } from "lucide-react";
import { getAllProducts } from "@/lib/data";
import {
  hasPublishedListeningAudio,
  isListeningStandProduct,
} from "@/lib/listening-stand";

export default function AdminListeningStandPage() {
  const products = getAllProducts().filter(isListeningStandProduct).sort((a, b) =>
    a.title.localeCompare(b.title, "ru"),
  );
  const published = products.filter(hasPublishedListeningAudio).length;
  const drafts = products.filter((product) => product.listening?.audio && !product.listening.published).length;

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-signal">Контент магазина</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold uppercase">Онлайн-стенд</h1>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            Записи и экспертные оценки динамиков MOMO/ZEUS.
          </p>
        </div>
        <Link href="/listening-stand" target="_blank" className="rounded-sm border border-border px-4 py-2.5 text-[0.82rem] font-semibold hover:border-signal hover:text-signal">
          Открыть стенд ↗
        </Link>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          ["Моделей", products.length, "в категории рупорных динамиков"],
          ["Опубликовано", published, "видно покупателям"],
          ["Черновиков", drafts, "запись загружена, но скрыта"],
        ].map(([label, value, note]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
            <p className="mt-1 text-[0.72rem] text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-3 md:hidden">
        {products.map((product) => {
          const ready = hasPublishedListeningAudio(product);
          const hasAudio = Boolean(product.listening?.audio);
          const scoreCount = [product.listening?.highs, product.listening?.mids, product.listening?.lows, product.listening?.volume].filter((value) => value !== undefined).length;
          return <article key={`mobile-${product.slug}`} className="rounded-xl border border-border bg-surface p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block font-semibold">{product.title}</b><span className="text-xs text-muted-foreground">{product.brand}</span></div><Link href={`/admin/products/${product.slug}`} className="inline-flex min-h-11 shrink-0 items-center font-semibold text-signal">Настроить</Link></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm"><span className={`inline-flex items-center gap-1.5 ${ready ? "text-signal" : "text-muted-foreground"}`}>{ready ? <Headphones size={14} /> : <Music2 size={14} />}{ready ? "Опубликована" : hasAudio ? "Черновик" : "Не загружена"}</span><span className="text-muted-foreground">Оценки {scoreCount}/4</span></div></article>;
        })}
      </div>
      <div className="mt-7 hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[0.8rem]">
            <thead className="border-b border-border bg-tile text-[0.68rem] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3">Модель</th><th className="px-4 py-3">Запись</th><th className="px-4 py-3">Оценки</th><th className="px-4 py-3 text-right">Действие</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const ready = hasPublishedListeningAudio(product);
                const hasAudio = Boolean(product.listening?.audio);
                const scoreCount = [product.listening?.highs, product.listening?.mids, product.listening?.lows, product.listening?.volume].filter((value) => value !== undefined).length;
                return (
                  <tr key={product.slug} className="admin-row">
                    <td className="px-4 py-3"><b className="font-semibold">{product.title}</b><span className="ml-2 text-[0.68rem] text-muted-foreground">{product.brand}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 ${ready ? "text-signal" : "text-muted-foreground"}`}>
                        {ready ? <Headphones size={14} /> : <Music2 size={14} />}
                        {ready ? "Опубликована" : hasAudio ? "Черновик" : "Не загружена"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{scoreCount}/4 заполнено</td>
                    <td className="px-4 py-3 text-right"><Link href={`/admin/products/${product.slug}`} className="font-semibold text-signal hover:underline">Настроить</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
