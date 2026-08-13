"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, MoreVertical } from "lucide-react";
import { productImageUrl, isInStock } from "@/lib/format";
import { plural, cn } from "@/lib/utils";
import {
  bulkUpdateProducts,
  toggleHidden,
  deleteProduct,
  createAsClearance,
} from "@/app/admin/products/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { QuickEdit } from "@/components/admin/quick-edit";
import type { Product, Category } from "@/lib/types";

const PAGE_SIZE = 25;
const CATEGORY_ORDER = [
  "sabvufery",
  "usiliteli-monobloki",
  "dinamiki-rupora",
  "multimedia",
  "aksessuary",
  "avtosvet",
];

type Availability = "" | "in" | "preorder" | "unknown" | "out" | "low";
type FlagFilter = "" | "new" | "hidden" | "clearance";
type Sort = "catalog" | "title" | "price_asc" | "price_desc" | "stock";

function isUnknown(product: Product): boolean {
  return typeof product.stock !== "number" && product.inStock === undefined;
}

function categoryRank(slug: string): number {
  const index = CATEGORY_ORDER.indexOf(slug);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function ProductsList({
  products,
  categories,
  bundleNames,
  saved,
  initialAvailability = "",
}: {
  products: Product[];
  categories: Category[];
  bundleNames: Record<string, string[]>;
  saved?: boolean;
  initialAvailability?: Availability;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState<Availability>(initialAvailability);
  const [flag, setFlag] = useState<FlagFilter>("");
  const [sort, setSort] = useState<Sort>("catalog");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<Product | null>(null);
  const [shown, setShown] = useState(false);

  const titleByCategory = useMemo(
    () => new Map(categories.map((item) => [item.slug, item.title])),
    [categories],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = products.filter((product) => {
      const haystack = [
        product.title,
        product.slug,
        product.brand,
        product.ozonSku ? String(product.ozonSku) : "",
        product.ozonOfferId ?? "",
      ].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (category && product.category !== category) return false;
      if (availability === "unknown" && !isUnknown(product)) return false;
      if (availability === "out" && product.stock !== 0) return false;
      if (availability === "low" && !(typeof product.stock === "number" && product.stock > 0 && product.stock <= 3)) return false;
      if (availability === "in" && isInStock(product) !== true) return false;
      if (availability === "preorder" && isInStock(product) !== false) return false;
      if (flag === "new" && !product.isNew) return false;
      if (flag === "hidden" && !product.hidden) return false;
      if (flag === "clearance" && !product.isClearance) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "stock") return (a.stock ?? -1) - (b.stock ?? -1);
      return categoryRank(a.category) - categoryRank(b.category);
    });
  }, [products, q, category, availability, flag, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(currentPage, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unknownCount = products.filter(isUnknown).length;
  const active = Boolean(q.trim() || category || availability || flag || sort !== "catalog");
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.slug));

  const resetPage = () => setCurrentPage(1);
  const toggleOne = (slug: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };
  const toggleVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      for (const product of visible) {
        if (allVisibleSelected) next.delete(product.slug);
        else next.add(product.slug);
      }
      return next;
    });
  };
  const openSheet = (product: Product) => {
    setSheet(product);
    requestAnimationFrame(() => setShown(true));
  };
  const closeSheet = () => {
    setShown(false);
    setTimeout(() => setSheet(null), 200);
  };
  const bundleNote = (slug: string) => {
    const names = bundleNames[slug];
    return names?.length
      ? ` Товар входит в ${names.length > 1 ? "сборки" : "сборку"} «${names.join("», «")}».`
      : "";
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase">Товары</h1>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            {filtered.length} {plural(filtered.length, "товар", "товара", "товаров")}
            {active && " по условиям"} · по {PAGE_SIZE} на странице
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/products/trash" className="inline-flex items-center gap-1.5 text-[0.85rem] text-muted-foreground hover:text-signal">
            <ArchiveRestore size={15} /> Корзина
          </Link>
          <Link href="/admin/products/import" className="text-[0.85rem] text-muted-foreground hover:text-signal">
            Импорт данных
          </Link>
          <Link href="/admin/products/new" className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95">
            Добавить товар
          </Link>
        </div>
      </div>

      {saved && <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">Сохранено. Изменения уже на сайте.</p>}

      {unknownCount > 0 && (
        <button
          type="button"
          onClick={() => { setAvailability("unknown"); resetPage(); }}
          className="mt-4 w-full rounded-sm border border-signal/60 bg-signal/5 px-4 py-3 text-left text-[0.85rem] text-[var(--signal-text)] hover:bg-signal/10"
        >
          Требуют внимания: у {unknownCount} товаров не указано наличие. Показать и исправить →
        </button>
      )}

      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); resetPage(); }}
          placeholder="Название, SKU, Ozon SKU…"
          className="rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none xl:col-span-2"
          aria-label="Поиск товара"
        />
        <select value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none">
          <option value="">Все категории</option>
          {categories.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
        </select>
        <select value={availability} onChange={(e) => { setAvailability(e.target.value as Availability); resetPage(); }} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none">
          <option value="">Любое наличие</option>
          <option value="in">В наличии</option>
          <option value="preorder">Под заказ</option>
          <option value="out">Нулевой остаток</option>
          <option value="low">Осталось 1–3 штуки</option>
          <option value="unknown">Статус не указан ({unknownCount})</option>
        </select>
        <select value={flag} onChange={(e) => { setFlag(e.target.value as FlagFilter); resetPage(); }} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none">
          <option value="">Все типы</option>
          <option value="new">Новинки</option>
          <option value="hidden">Скрытые</option>
          <option value="clearance">Уценка</option>
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); resetPage(); }} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none md:col-span-2 xl:col-span-1">
          <option value="catalog">Порядок каталога</option>
          <option value="title">По названию</option>
          <option value="price_asc">Цена: сначала ниже</option>
          <option value="price_desc">Цена: сначала выше</option>
          <option value="stock">По остатку</option>
        </select>
        {active && (
          <button type="button" onClick={() => { setQ(""); setCategory(""); setAvailability(""); setFlag(""); setSort("catalog"); resetPage(); }} className="rounded-sm border border-border px-4 py-2 text-sm font-medium hover:border-signal hover:text-signal">
            Сбросить фильтры
          </button>
        )}
      </div>

      <form id="bulk-products" action={bulkUpdateProducts} className="mt-4 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-surface px-4 py-3">
        <span className="text-[0.82rem] text-muted-foreground">Выбрано: {selected.size}</span>
        <select name="bulkAction" required disabled={!selected.size} className="rounded-sm border border-input bg-bg px-3 py-2 text-[0.82rem] disabled:opacity-50">
          <option value="">Массовое действие…</option>
          <option value="in_stock">Указать: в наличии</option>
          <option value="preorder">Указать: под заказ</option>
          <option value="show">Показать</option>
          <option value="hide">Скрыть</option>
          <option value="new_on">Добавить в новинки</option>
          <option value="new_off">Убрать из новинок</option>
          <option value="clearance_on">Пометить уценкой</option>
          <option value="clearance_off">Снять уценку</option>
        </select>
        <button type="submit" disabled={!selected.size} className="rounded-sm bg-foreground px-4 py-2 text-[0.82rem] font-semibold text-bg disabled:opacity-40">Применить</button>
        {selected.size > 0 && <button type="button" onClick={() => setSelected(new Set())} className="text-[0.8rem] text-muted-foreground hover:text-signal">Снять выбор</button>}
      </form>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] border-collapse text-[0.85rem]">
          <thead><tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
            <th className="w-10 py-2.5 pr-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Выбрать товары на странице" /></th>
            <th className="py-2.5 pr-3 font-medium">Товар</th><th className="py-2.5 pr-3 font-medium">Категория</th><th className="py-2.5 pr-3 text-right font-medium">Цена и остаток</th><th />
          </tr></thead>
          <tbody>{visible.map((product) => (
            <tr key={product.slug} className="admin-row border-b border-border align-middle">
              <td className="py-3 pr-3"><input form="bulk-products" type="checkbox" name="slugs" value={product.slug} checked={selected.has(product.slug)} onChange={() => toggleOne(product.slug)} aria-label={`Выбрать ${product.title}`} /></td>
              <td className="py-3 pr-3"><ProductIdentity product={product} bundleNames={bundleNames} /></td>
              <td className="py-3 pr-3 text-muted-foreground">{titleByCategory.get(product.category) ?? product.category}</td>
              <td className="py-3 pr-3"><QuickEdit product={product} /></td>
              <td className="py-3"><RowActions product={product} bundleNote={bundleNote(product.slug)} openSheet={() => openSheet(product)} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {visible.map((product) => (
          <article key={product.slug} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selected.has(product.slug)} onChange={() => toggleOne(product.slug)} aria-label={`Выбрать ${product.title}`} className="mt-3" />
              <div className="min-w-0 flex-1"><ProductIdentity product={product} bundleNames={bundleNames} /></div>
            </div>
            <p className="mt-3 text-[0.75rem] text-muted-foreground">{titleByCategory.get(product.category) ?? product.category}</p>
            <div className="mt-3 overflow-x-auto"><QuickEdit product={product} /></div>
            <div className="mt-4 border-t border-border pt-3"><RowActions product={product} bundleNote={bundleNote(product.slug)} openSheet={() => openSheet(product)} /></div>
          </article>
        ))}
      </div>

      {visible.length === 0 && <p className="py-12 text-center text-muted-foreground">Ничего не нашлось — измените условия поиска.</p>}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Страницы каталога">
          <button type="button" disabled={page === 1} onClick={() => setCurrentPage(page - 1)} className="rounded-sm border border-border px-4 py-2 text-sm disabled:opacity-35">← Назад</button>
          <span className="text-sm text-muted-foreground">Страница {page} из {pages}</span>
          <button type="button" disabled={page === pages} onClick={() => setCurrentPage(page + 1)} className="rounded-sm border border-border px-4 py-2 text-sm disabled:opacity-35">Дальше →</button>
        </nav>
      )}

      {sheet && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <button type="button" aria-label="Закрыть" onClick={closeSheet} className={cn("absolute inset-0 bg-black/40 transition-opacity", shown ? "opacity-100" : "opacity-0")} />
          <div className={cn("relative w-full max-w-[520px] rounded-t-2xl border border-border bg-surface p-5 pb-8 shadow-2xl transition-transform", shown ? "translate-y-0" : "translate-y-full")}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <p className="text-[0.72rem] uppercase tracking-wider text-muted-foreground">Товар</p>
            <p className="mt-0.5 truncate font-medium">{sheet.title}</p>
            <form action={createAsClearance} className="mt-5"><input type="hidden" name="slug" value={sheet.slug} /><button type="submit" className="w-full rounded-sm bg-signal px-4 py-3 text-[0.9rem] font-semibold text-white">Создать как уценку</button></form>
            <p className="mt-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">Создаст скрытую копию с остатком 1. Проверьте цену и фотографии перед публикацией.</p>
            <button type="button" onClick={closeSheet} className="mt-5 w-full rounded-sm border border-border px-4 py-2.5 text-[0.85rem] font-medium">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductIdentity({ product, bundleNames }: { product: Product; bundleNames: Record<string, string[]> }) {
  return <div className="flex min-w-0 items-center gap-3">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={productImageUrl(product.image)} alt="" className="h-11 w-11 shrink-0 rounded-sm border border-border bg-tile object-contain" />
    <span className="min-w-0"><Link href={`/admin/products/${product.slug}`} className="block truncate font-medium hover:text-signal">{product.title}</Link>
      <span className="mt-0.5 flex flex-wrap gap-x-2 text-[0.72rem] text-muted-foreground">
        <span>{product.brand}</span>
        {isUnknown(product) && <span className="text-signal">статус не указан</span>}
        {isInStock(product) === false && <span className="text-[var(--signal-text)]">под заказ</span>}
        {product.isNew && <span className="text-signal">новинка</span>}
        {product.isClearance && <span>уценка</span>}
        {product.hidden && <span className="text-[var(--signal-text)]">скрыт</span>}
        {bundleNames[product.slug]?.length ? <span title={bundleNames[product.slug].join(", ")}>в сборке</span> : null}
      </span>
    </span>
  </div>;
}

function RowActions({ product, bundleNote, openSheet }: { product: Product; bundleNote: string; openSheet: () => void }) {
  return <div className="flex items-center justify-end gap-3 whitespace-nowrap text-[0.82rem]">
    <form action={toggleHidden}><input type="hidden" name="slug" value={product.slug} />
      {!product.hidden && bundleNote ? <ConfirmButton label="Скрыть" tone="neutral" question={`Убрать «${product.title}» с витрины?${bundleNote}`} /> : <button type="submit" className="text-muted-foreground hover:text-signal">{product.hidden ? "Вернуть" : "Скрыть"}</button>}
    </form>
    <form action={deleteProduct}><input type="hidden" name="slug" value={product.slug} /><ConfirmButton label="В корзину" question={`Переместить «${product.title}» в корзину на 30 дней?${bundleNote}`} /></form>
    <button type="button" onClick={openSheet} aria-label="Ещё действия" className="text-muted-foreground hover:text-signal"><MoreVertical size={16} /></button>
  </div>;
}
