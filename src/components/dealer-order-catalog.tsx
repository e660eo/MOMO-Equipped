"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileClock,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { submitDealerOrder, type DealerOrderState } from "@/app/(shop)/dealer/actions";
import {
  DEALER_ORDER_DRAFT_STORAGE_KEY,
  parseDealerOrderDraft,
  serializeDealerOrderDraft,
} from "@/lib/dealer-order-draft";
import { formatPrice } from "@/lib/format";
import { plural } from "@/lib/utils";

export type DealerCatalogItem = {
  slug: string;
  title: string;
  brand: string;
  category: string;
  image: string;
  price: number;
  retailPrice: number;
  stock: number | null;
  available: boolean;
  isNew: boolean;
  article?: string;
};

type AvailabilityFilter = "all" | "available" | "low";
type SortMode = "default" | "price-asc" | "price-desc" | "stock-desc" | "name";

function availableLimit(item: DealerCatalogItem): number {
  if (!item.available) return 0;
  return item.stock ?? 999;
}

export function DealerOrderCatalog({ products }: { products: DealerCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [state, action, pending] = useActionState<DealerOrderState, FormData>(submitDealerOrder, {});

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand))].sort(), [products]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const rows = products.filter((product) => {
      const haystack = `${product.title} ${product.brand} ${product.article ?? ""} ${product.slug}`.toLowerCase();
      const matchesAvailability = availability === "all"
        || (availability === "available" && product.available)
        || (availability === "low" && product.stock !== null && product.stock > 0 && product.stock <= 5);
      return (category === "all" || product.category === category)
        && (brand === "all" || product.brand === brand)
        && matchesAvailability
        && haystack.includes(needle);
    });
    return rows.sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "stock-desc") return (b.stock ?? -1) - (a.stock ?? -1);
      if (sort === "name") return a.title.localeCompare(b.title, "ru");
      return Number(b.isNew) - Number(a.isNew) || Number(b.available) - Number(a.available);
    });
  }, [products, deferredQuery, category, brand, availability, sort]);

  const selected = useMemo(
    () => products
      .map((product) => ({ product, qty: quantities[product.slug] ?? 0 }))
      .filter((row) => row.qty > 0),
    [products, quantities],
  );
  const total = selected.reduce((sum, row) => sum + row.product.price * row.qty, 0);
  const totalUnits = selected.reduce((sum, row) => sum + row.qty, 0);
  const hasFilters = Boolean(query) || category !== "all" || brand !== "all" || availability !== "all" || sort !== "default";

  useEffect(() => {
    const draft = parseDealerOrderDraft(localStorage.getItem(DEALER_ORDER_DRAFT_STORAGE_KEY));
    if (draft) {
      const safeQuantities: Record<string, number> = {};
      for (const [slug, rawQty] of Object.entries(draft.quantities)) {
        const product = productMap.get(slug);
        if (!product) continue;
        const qty = Math.min(rawQty, availableLimit(product));
        if (qty > 0) safeQuantities[slug] = qty;
      }
      setQuantities(safeQuantities);
      setComment(draft.comment);
    }
    setDraftLoaded(true);
  }, [productMap]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = window.setTimeout(() => {
      if (!selected.length && !comment.trim()) {
        localStorage.removeItem(DEALER_ORDER_DRAFT_STORAGE_KEY);
      } else {
        localStorage.setItem(
          DEALER_ORDER_DRAFT_STORAGE_KEY,
          serializeDealerOrderDraft(quantities, comment),
        );
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [comment, draftLoaded, quantities, selected.length]);

  useEffect(() => {
    if (!state.ok) return;
    setQuantities({});
    setComment("");
    localStorage.removeItem(DEALER_ORDER_DRAFT_STORAGE_KEY);
  }, [state.ok, state.orderId]);

  function setQty(item: DealerCatalogItem, next: number) {
    const qty = Math.max(0, Math.min(availableLimit(item), Math.round(next || 0)));
    setQuantities((current) => {
      const updated = { ...current };
      if (qty > 0) updated[item.slug] = qty;
      else delete updated[item.slug];
      return updated;
    });
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setBrand("all");
    setAvailability("all");
    setSort("default");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <section className="min-w-0 rounded-[24px] border border-black/8 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-black/7 pb-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff5500]">Закрытый каталог</p>
              <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-[-.03em] sm:text-3xl">Цены и остатки</h2>
            </div>
            <p className="text-sm text-black/45">Показано {filtered.length} из {products.length}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_1fr_1fr]">
            <label className="grid gap-1.5 text-xs font-semibold text-black/60">
              Поиск
              <span className="relative">
                <Search className="absolute left-4 top-3.5 text-black/35" size={18} aria-hidden />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 w-full rounded-xl border border-black/10 bg-[#f7f7f7] pl-11 pr-10 text-sm outline-none transition-colors focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/15" placeholder="Название или артикул" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск" className="absolute right-2 top-1 grid h-10 w-10 place-items-center text-black/35 hover:text-black"><X size={16} /></button>}
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-black/60">
              Категория
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-xl border border-black/10 bg-[#f7f7f7] px-4 text-sm outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/15">
                <option value="all">Все категории</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-black/60">
              Бренд
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-12 rounded-xl border border-black/10 bg-[#f7f7f7] px-4 text-sm outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/15">
                <option value="all">Все бренды</option>
                {brands.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="Наличие">
              {([[
                "all", "Все товары",
              ], [
                "available", "В наличии",
              ], [
                "low", "Мало на складе",
              ]] as Array<[AvailabilityFilter, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setAvailability(value)} className={`min-h-11 rounded-xl border px-3.5 text-xs font-bold transition-colors ${availability === value ? "border-[#ff5500] bg-[#fff4ed] text-[#d94700]" : "border-black/10 text-black/55 hover:border-black/25"}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="grid w-full min-w-0 gap-1.5 text-xs font-semibold text-black/60 sm:w-auto sm:min-w-[210px]">
              Сортировка
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-11 rounded-xl border border-black/10 bg-[#f7f7f7] px-3 text-sm outline-none focus:border-[#ff5500]">
                <option value="default">Сначала актуальные</option>
                <option value="price-asc">Цена: сначала ниже</option>
                <option value="price-desc">Цена: сначала выше</option>
                <option value="stock-desc">По остатку</option>
                <option value="name">По названию</option>
              </select>
            </label>
          </div>
        </div>

        <div className="divide-y divide-black/7">
          {filtered.map((product) => {
            const qty = quantities[product.slug] ?? 0;
            const difference = Math.max(0, product.retailPrice - product.price);
            const lowStock = product.stock !== null && product.stock > 0 && product.stock <= 5;
            return (
              <article key={product.slug} className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[72px_minmax(0,1fr)_170px_126px] sm:items-center">
                <div className="relative h-[68px] overflow-hidden rounded-xl bg-[#f3f3f3] sm:h-[72px]">
                  <Image src={product.image} alt={product.title} fill sizes="72px" className="object-contain p-1.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#d94700]">
                    <span>{product.brand} · {product.category}</span>
                    {product.isNew && <span className="rounded-full bg-[#ff5500] px-2 py-0.5 text-white">Новинка</span>}
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-bold">{product.title}</h3>
                  <p className={`mt-1 text-xs ${lowStock ? "font-semibold text-amber-700" : "text-black/45"}`}>
                    {product.stock !== null ? `${product.stock} шт. на складе` : product.available ? "В наличии" : "Под заказ"}
                    {product.article && <> · арт. {product.article}</>}
                  </p>
                  <Link href={product.image} download className="mt-1 inline-flex min-h-7 items-center gap-1 text-[11px] font-semibold text-black/45 hover:text-[#ff5500]"><Download size={12} aria-hidden /> Фото</Link>
                </div>
                <div className="col-start-2 sm:col-auto sm:text-right">
                  <p className="text-lg font-black">{formatPrice(product.price)}</p>
                  {difference > 0 && <p className="mt-0.5 text-[11px] text-black/40">РРЦ {formatPrice(product.retailPrice)} · выгода {formatPrice(difference)}</p>}
                </div>
                <div className="col-start-2 flex h-11 w-[126px] items-center rounded-xl border border-black/10 sm:col-auto">
                  <button type="button" onClick={() => setQty(product, qty - 1)} disabled={!qty} className="grid h-full w-11 place-items-center disabled:opacity-25" aria-label={`Уменьшить количество: ${product.title}`}><Minus size={15} /></button>
                  <input aria-label={`Количество: ${product.title}`} value={qty || ""} onChange={(event) => setQty(product, Number(event.target.value))} inputMode="numeric" className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold outline-none" placeholder="0" disabled={!product.available} />
                  <button type="button" onClick={() => setQty(product, qty + 1)} disabled={!product.available || qty >= availableLimit(product)} className="grid h-full w-11 place-items-center disabled:opacity-25" aria-label={`Увеличить количество: ${product.title}`}><Plus size={15} /></button>
                </div>
              </article>
            );
          })}
          {!filtered.length && (
            <div className="py-14 text-center">
              <SlidersHorizontal className="mx-auto text-black/20" size={28} aria-hidden />
              <p className="mt-3 font-bold">Подходящих товаров нет</p>
              <p className="mt-1 text-sm text-black/45">Измените запрос или сбросьте выбранные фильтры.</p>
              {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 min-h-11 rounded-xl border border-black/10 px-4 text-sm font-bold hover:border-[#ff5500] hover:text-[#ff5500]">Сбросить фильтры</button>}
            </div>
          )}
        </div>
      </section>

      <aside id="dealer-order-summary" className="scroll-mt-5 xl:sticky xl:top-5 xl:self-start">
        <form action={action} className="rounded-[24px] bg-[#111214] p-5 text-white shadow-2xl shadow-black/10 sm:p-6">
          <input type="hidden" name="items" value={JSON.stringify(selected.map(({ product, qty }) => ({ slug: product.slug, qty })))} />
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff5500]"><ShoppingCart size={19} aria-hidden /></span>
            <div><p className="text-xs uppercase tracking-[.16em] text-white/45">Дилерский заказ</p><p className="font-bold">{selected.length ? `${selected.length} ${plural(selected.length, "позиция", "позиции", "позиций")} · ${totalUnits} шт.` : "Корзина пуста"}</p></div>
          </div>
          <div className="mt-6 max-h-52 space-y-3 overflow-auto pr-1">
            {selected.map(({ product, qty }) => (
              <div key={product.slug} className="flex justify-between gap-4 text-xs">
                <span className="line-clamp-2 text-white/70">{product.title} × {qty}</span>
                <b className="shrink-0">{formatPrice(product.price * qty)}</b>
              </div>
            ))}
          </div>
          {!selected.length && <p className="mt-6 rounded-xl bg-white/5 px-4 py-5 text-center text-xs leading-5 text-white/40">Укажите количество напротив нужных товаров — они сразу появятся здесь.</p>}
          <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-5"><span className="text-xs uppercase tracking-[.14em] text-white/45">Итого</span><strong className="text-2xl">{formatPrice(total)}</strong></div>
          <label className="mt-5 grid gap-2 text-xs font-semibold text-white/60">
            Комментарий менеджеру
            <textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={700} className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-white/7 p-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20" placeholder="Например: позвонить перед отгрузкой" />
          </label>
          {draftLoaded && (selected.length > 0 || comment.trim()) && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40"><FileClock size={13} aria-hidden /> Черновик сохраняется автоматически</p>}
          {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2.5 text-xs text-red-200">{state.error}</p>}
          {state.ok && <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2.5 text-xs text-emerald-200"><CheckCircle2 size={16} aria-hidden /> Заказ {state.orderId} отправлен менеджеру.</p>}
          <button disabled={pending || !selected.length} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] text-sm font-bold transition-colors hover:bg-[#ff6a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-35">{pending && <LoaderCircle className="animate-spin" size={18} aria-hidden />}{pending ? "Отправляем…" : "Отправить заказ"}</button>
          <p className="mt-3 text-center text-[10px] leading-4 text-white/40">Менеджер проверит наличие и подтвердит условия отгрузки.</p>
        </form>
      </aside>

      {selected.length > 0 && (
        <a href="#dealer-order-summary" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)_+_5.25rem)] z-40 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-[#111214] px-4 text-white shadow-2xl shadow-black/25 sm:inset-x-4 xl:hidden">
          <span><b className="block text-sm">{selected.length} поз. · {totalUnits} шт.</b><span className="text-[0.68rem] text-white/45">Открыть заказ</span></span>
          <strong className="text-lg">{formatPrice(total)}</strong>
        </a>
      )}
    </div>
  );
}
