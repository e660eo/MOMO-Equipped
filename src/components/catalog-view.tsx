"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Product, Category, Brand } from "@/lib/types";
import { ProductCard } from "./product-card";

type Sort = "popular" | "price_asc" | "price_desc" | "title_asc" | "title_desc";

const selectCls =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";

export function CatalogView({
  products,
  categories,
  brands,
}: {
  products: Product[];
  categories: Category[];
  brands: Brand[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const category = params.get("category") ?? "";
  const brand = params.get("brand") ?? "";

  const [sort, setSort] = useState<Sort>("popular");
  // Начальный поиск может прийти из шапки: /catalog?search=…
  const [query, setQuery] = useState(params.get("search") ?? "");

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!brand || p.brand === brand) &&
        (!query || p.title.toLowerCase().includes(query.toLowerCase())),
    );
    switch (sort) {
      case "price_asc":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "title_asc":
        list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ru"));
        break;
      case "title_desc":
        list = [...list].sort((a, b) => b.title.localeCompare(a.title, "ru"));
        break;
    }
    return list;
  }, [products, category, brand, query, sort]);

  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-14">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold uppercase">
          {activeCategory ? activeCategory.title : brand ? brand : "Каталог"}
        </h1>
        <span className="font-mono text-sm text-muted-foreground">
          {filtered.length} товаров
        </span>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Фильтры */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:h-fit">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по товарам…"
            className={selectCls}
            aria-label="Поиск по товарам"
          />
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
              Сортировка
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className={selectCls}
            >
              <option value="popular">Сначала популярные</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="title_asc">Название: А‑Я</option>
              <option value="title_desc">Название: Я‑А</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
              Категория
            </span>
            <select
              value={category}
              onChange={(e) => setFilter("category", e.target.value)}
              className={selectCls}
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
              Бренд
            </span>
            <select
              value={brand}
              onChange={(e) => setFilter("brand", e.target.value)}
              className={selectCls}
            >
              <option value="">Все бренды</option>
              {brands.map((b) => (
                <option key={b.slug} value={b.title}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
          {(category || brand || query) && (
            <button
              onClick={() => {
                setQuery("");
                router.push(pathname, { scroll: false });
              }}
              className="rounded-sm border border-border py-2.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Сбросить фильтры
            </button>
          )}
        </aside>

        {/* Сетка */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
            Ничего не найдено. Измените фильтры или сбросьте их.
          </div>
        )}
      </div>
    </div>
  );
}
