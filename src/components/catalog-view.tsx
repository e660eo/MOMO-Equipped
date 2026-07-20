"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X, SlidersHorizontal } from "lucide-react";
import type { Product, Category, Brand } from "@/lib/types";
import { formatPrice, siteConfig } from "@/lib/data";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

type Sort = "popular" | "price_asc" | "price_desc" | "title_asc" | "title_desc";

const selectCls =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";

const PAGE = 24;

// Склонение существительного «товар» под число.
function pluralItems(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "товар";
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "товара";
  return "товаров";
}

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

  // Границы цены по всему каталогу (округляем до сотен).
  const priceBounds = useMemo(() => {
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices) / 100) * 100,
      max: Math.ceil(Math.max(...prices) / 100) * 100,
    };
  }, [products]);

  const [price, setPrice] = useState<[number, number]>([
    priceBounds.min,
    priceBounds.max,
  ]);
  const priceActive =
    price[0] > priceBounds.min || price[1] < priceBounds.max;

  // Сколько карточек показываем (пагинация «Показать ещё»).
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => {
    setVisible(PAGE);
  }, [category, brand, query, sort, price]);

  /*
    На узком экране фильтры занимали весь первый экран — до первой карточки
    приходилось листать 855px. Поэтому там они уезжают в шторку, а на десктопе
    остаются обычной колонкой слева: разметка одна, меняется только обёртка.
  */
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFiltersOpen(false);
    // Фон под шторкой не должен прокручиваться вместе с ней
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function resetAll() {
    setQuery("");
    setPrice([priceBounds.min, priceBounds.max]);
    router.push(pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!brand || p.brand === brand) &&
        (!query || p.title.toLowerCase().includes(query.toLowerCase())) &&
        p.price >= price[0] &&
        p.price <= price[1],
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
  }, [products, category, brand, query, price, sort]);

  const shown = filtered.slice(0, visible);
  const activeCategory = categories.find((c) => c.slug === category);
  const hasFilters = Boolean(category || brand || query || priceActive);

  // Чипы активных фильтров.
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (activeCategory)
    chips.push({
      key: "category",
      label: activeCategory.title,
      clear: () => setFilter("category", ""),
    });
  if (brand)
    chips.push({ key: "brand", label: brand, clear: () => setFilter("brand", "") });
  if (query)
    chips.push({ key: "query", label: `«${query}»`, clear: () => setQuery("") });
  if (priceActive)
    chips.push({
      key: "price",
      label: `${formatPrice(price[0])} – ${formatPrice(price[1])}`,
      clear: () => setPrice([priceBounds.min, priceBounds.max]),
    });

  // Счётчик на кнопке «Фильтры»: в свёрнутом виде иначе не видно, что они активны
  const chipCount = chips.length;

  const range = priceBounds.max - priceBounds.min || 1;
  const fillLeft = ((price[0] - priceBounds.min) / range) * 100;
  const fillRight = ((priceBounds.max - price[1]) / range) * 100;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold uppercase">
          {activeCategory ? activeCategory.title : brand ? brand : "Каталог"}
        </h1>
        <span className="font-mono text-sm text-muted-foreground">
          Найдено{" "}
          <b className="font-medium text-foreground">{filtered.length}</b>{" "}
          {pluralItems(filtered.length)}
        </span>
      </div>

      {/* Вызов шторки фильтров — только на узком экране */}
      <button
        onClick={() => setFiltersOpen(true)}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-surface py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal lg:hidden"
      >
        <SlidersHorizontal size={15} />
        Фильтры и сортировка
        {chipCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1.5 text-[0.68rem] font-bold text-white">
            {chipCount}
          </span>
        )}
      </button>

      <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-[240px_1fr]">
        {/* Затемнение под шторкой */}
        <div
          onClick={() => setFiltersOpen(false)}
          className={cn(
            "fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
            filtersOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        {/* Фильтры: шторка снизу на мобильном, колонка слева на десктопе */}
        <aside
          aria-label="Фильтры каталога"
          className={cn(
            "flex flex-col gap-4",
            "fixed inset-x-0 bottom-0 z-[101] max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 pb-8 transition-transform duration-300",
            "lg:static lg:z-auto lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:transition-none",
            "lg:sticky lg:top-24 lg:h-fit",
            filtersOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          {/* Шапка шторки */}
          <div className="mb-1 flex items-center justify-between lg:hidden">
            <span className="font-display text-base font-semibold uppercase">
              Фильтры
            </span>
            <button
              onClick={() => setFiltersOpen(false)}
              aria-label="Закрыть фильтры"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
            >
              <X size={15} />
            </button>
          </div>
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

          {/* Цена — двойной ползунок */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
              Цена, ₽
            </span>
            <div className="range-dual">
              <div className="range-dual__track" />
              <div
                className="range-dual__fill"
                style={{ left: `${fillLeft}%`, right: `${fillRight}%` }}
              />
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={100}
                value={price[0]}
                aria-label="Минимальная цена"
                onChange={(e) =>
                  setPrice([
                    Math.min(Number(e.target.value), price[1] - 100),
                    price[1],
                  ])
                }
              />
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={100}
                value={price[1]}
                aria-label="Максимальная цена"
                onChange={(e) =>
                  setPrice([
                    price[0],
                    Math.max(Number(e.target.value), price[0] + 100),
                  ])
                }
              />
            </div>
            <div className="flex justify-between font-mono text-[0.72rem] text-muted-foreground">
              <span>{formatPrice(price[0])}</span>
              <span>{formatPrice(price[1])}</span>
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={resetAll}
              className="rounded-sm border border-border py-2.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Сбросить фильтры
            </button>
          )}

          {/* Итог шторки: сколько нашлось и выход к товарам */}
          <button
            onClick={() => setFiltersOpen(false)}
            className="mt-1 rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] lg:hidden"
          >
            Показать {filtered.length} {pluralItems(filtered.length)}
          </button>
        </aside>

        {/* Сетка */}
        <div>
          {/* Чипы активных фильтров */}
          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.clear}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface py-1.5 pl-3.5 pr-2.5 text-[0.8rem] font-medium transition-colors hover:border-signal hover:text-signal"
                >
                  {chip.label}
                  <X
                    size={13}
                    className="text-muted-foreground transition-colors group-hover:text-signal"
                  />
                </button>
              ))}
              <button
                onClick={resetAll}
                className="ml-1 font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground underline-offset-4 transition-colors hover:text-signal hover:underline"
              >
                Сбросить всё
              </button>
            </div>
          )}

          {filtered.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
                {shown.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>

              {visible < filtered.length && (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <button
                    onClick={() => setVisible((v) => v + PAGE)}
                    className="inline-flex rounded-sm border border-border px-8 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
                  >
                    Показать ещё
                  </button>
                  <span className="font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                    Показано {shown.length} из {filtered.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface p-14 text-center">
              <p className="font-display text-lg font-semibold">
                Ничего не нашлось
              </p>
              <p className="max-w-[44ch] text-sm text-muted-foreground">
                Под такие условия товаров нет. Сбросьте фильтры или напишите нам —
                подберём под задачу и бюджет.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={resetAll}
                  className="inline-flex rounded-sm border border-border px-6 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
                >
                  Сбросить фильтры
                </button>
                <a
                  href={siteConfig.contacts.whatsapp}
                  className="inline-flex rounded-sm bg-signal px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
                >
                  Написать в WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
