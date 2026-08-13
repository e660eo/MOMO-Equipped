"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { submitDealerOrder, type DealerOrderState } from "@/app/(shop)/dealer/actions";
import { formatPrice } from "@/lib/format";

export type DealerCatalogItem = {
  slug: string;
  title: string;
  brand: string;
  category: string;
  image: string;
  price: number;
  stock: number | null;
  available: boolean;
};

export function DealerOrderCatalog({ products }: { products: DealerCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [state, action, pending] = useActionState<DealerOrderState, FormData>(submitDealerOrder, {});
  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);
  const filtered = useMemo(() => products.filter((product) => {
    const haystack = `${product.title} ${product.brand} ${product.slug}`.toLowerCase();
    return (category === "all" || product.category === category) && haystack.includes(query.trim().toLowerCase());
  }), [products, query, category]);
  const selected = useMemo(() => products.map((product) => ({ product, qty: quantities[product.slug] ?? 0 })).filter((row) => row.qty > 0), [products, quantities]);
  const total = selected.reduce((sum, row) => sum + row.product.price * row.qty, 0);

  useEffect(() => {
    if (state.ok) setQuantities({});
  }, [state.ok, state.orderId]);

  function setQty(item: DealerCatalogItem, next: number) {
    const max = item.stock ?? 999;
    const qty = Math.max(0, Math.min(max, Math.round(next || 0)));
    setQuantities((current) => ({ ...current, [item.slug]: qty }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 rounded-[24px] border border-black/8 bg-white p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative"><Search className="absolute left-4 top-3.5 text-black/35" size={18} /><span className="sr-only">Поиск</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 w-full rounded-xl border border-black/10 bg-[#f7f7f7] pl-11 pr-4 text-sm outline-none focus:border-[#ff5500]" placeholder="Название, бренд или артикул" /></label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-xl border border-black/10 bg-[#f7f7f7] px-4 text-sm outline-none focus:border-[#ff5500]"><option value="all">Все категории</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <div className="mt-5 divide-y divide-black/7">
          {filtered.map((product) => {
            const qty = quantities[product.slug] ?? 0;
            return <article key={product.slug} className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[72px_minmax(0,1fr)_145px_126px] sm:items-center">
              <div className="relative h-[68px] overflow-hidden rounded-xl bg-[#f3f3f3] sm:h-[72px]"><Image src={product.image} alt="" fill sizes="72px" className="object-contain p-1.5" /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ff5500]">{product.brand} · {product.category}</p><h3 className="mt-1 truncate text-sm font-bold">{product.title}</h3><p className="mt-1 text-xs text-black/40">{product.stock !== null ? `${product.stock} шт. на складе` : product.available ? "В наличии" : "Под заказ"}</p><Link href={product.image} download className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-black/45 hover:text-[#ff5500]"><Download size={12} /> Фото</Link></div>
              <div className="col-start-2 text-lg font-black sm:col-auto sm:text-right">{formatPrice(product.price)}</div>
              <div className="col-start-2 flex h-10 w-[126px] items-center rounded-xl border border-black/10 sm:col-auto"><button type="button" onClick={() => setQty(product, qty - 1)} disabled={!qty} className="grid h-full w-10 place-items-center disabled:opacity-25" aria-label="Уменьшить"><Minus size={15} /></button><input aria-label={`Количество ${product.title}`} value={qty || ""} onChange={(event) => setQty(product, Number(event.target.value))} inputMode="numeric" className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold outline-none" placeholder="0" disabled={!product.available} /><button type="button" onClick={() => setQty(product, qty + 1)} disabled={!product.available || (product.stock !== null && qty >= product.stock)} className="grid h-full w-10 place-items-center disabled:opacity-25" aria-label="Увеличить"><Plus size={15} /></button></div>
            </article>;
          })}
          {!filtered.length && <p className="py-14 text-center text-sm text-black/45">По этому запросу товаров нет.</p>}
        </div>
      </section>

      <aside className="xl:sticky xl:top-28 xl:self-start">
        <form action={action} className="rounded-[24px] bg-[#111214] p-6 text-white shadow-2xl shadow-black/10">
          <input type="hidden" name="items" value={JSON.stringify(selected.map(({ product, qty }) => ({ slug: product.slug, qty })))} />
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff5500]"><ShoppingCart size={19} /></span><div><p className="text-xs uppercase tracking-[.16em] text-white/45">Дилерский заказ</p><p className="font-bold">{selected.length ? `${selected.length} позиций` : "Корзина пуста"}</p></div></div>
          <div className="mt-6 max-h-52 space-y-3 overflow-auto pr-1">{selected.map(({ product, qty }) => <div key={product.slug} className="flex justify-between gap-4 text-xs"><span className="line-clamp-2 text-white/70">{product.title} × {qty}</span><b className="shrink-0">{formatPrice(product.price * qty)}</b></div>)}</div>
          <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-5"><span className="text-xs uppercase tracking-[.14em] text-white/45">Итого</span><strong className="text-2xl">{formatPrice(total)}</strong></div>
          <textarea name="comment" maxLength={700} className="mt-5 min-h-20 w-full resize-y rounded-xl border border-white/10 bg-white/7 p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#ff5500]" placeholder="Комментарий менеджеру" />
          {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2.5 text-xs text-red-200">{state.error}</p>}
          {state.ok && <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2.5 text-xs text-emerald-200"><CheckCircle2 size={16} /> Заказ {state.orderId} отправлен менеджеру.</p>}
          <button disabled={pending || !selected.length} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] text-sm font-bold transition hover:bg-[#e84d00] disabled:cursor-not-allowed disabled:opacity-35">{pending && <LoaderCircle className="animate-spin" size={18} />}Отправить заказ</button>
          <p className="mt-3 text-center text-[10px] leading-4 text-white/35">Менеджер подтвердит наличие, оплату и отгрузку.</p>
        </form>
      </aside>
    </div>
  );
}
