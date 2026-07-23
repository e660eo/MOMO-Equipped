"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X, SlidersHorizontal } from "lucide-react";
import type { Product, Category, Brand } from "@/lib/types";
import { formatPrice, isInStock } from "@/lib/format";
import { useSiteConfig } from "@/components/site-config-provider";
import {
  parseTech,
  diameterBucket,
  powerBucket,
  DIAMETER_ORDER,
  POWER_ORDER,
} from "@/lib/specs";
import { ProductCard } from "./product-card";
import { cn, plural } from "@/lib/utils";
import { cleanQuery } from "@/lib/sanitize";

// «Популярное» намеренно нет: статистики продаж и просмотров у нас не собирается,
// а прежний пункт «Сначала популярные» просто отдавал порядок строк в JSON.
type Sort =
  | "sound_first"
  | "availability"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc";

/*
  Порядок по умолчанию: магазин про звук, поэтому витрина открывается
  сабвуферами и усилением, а провода, клеммы и лампы уходят в хвост —
  без этого каталог начинался с автомагнитол и ксеноновых ламп.
  Внутри раздела вперёд идёт то, что в наличии, затем — что дороже
  (старшие модели показательнее для первого экрана).
*/
const CATEGORY_ORDER = [
  "sabvufery",
  "usiliteli-monobloki",
  "dinamiki-rupora",
  "multimedia",
  "aksessuary",
  "avtosvet",
];
const categoryRank = (slug: string) => {
  const i = CATEGORY_ORDER.indexOf(slug);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

const selectCls =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";

const PAGE = 24;

const pluralItems = (n: number) => plural(n, "товар", "товара", "товаров");

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
  const { contacts } = useSiteConfig();

  const category = params.get("category") ?? "";
  const brand = params.get("brand") ?? "";

  const [sort, setSort] = useState<Sort>("sound_first");
  /*
    Начальный поиск может прийти из шапки: /catalog?search=…
    Через cleanQuery, потому что адрес страницы может составить кто угодно:
    ссылка с десятком тысяч символов в параметре ушла бы и в разметку, и в
    перебор товаров, и в Метрику.
  */
  const [query, setQuery] = useState(cleanQuery(params.get("search")));
  // Наличие известно не у всех товаров (у части статуса из прайса просто нет),
  // поэтому фильтр показывает только подтверждённо доступные, а не «прячет
  // распроданное»: неизвестный статус — не повод обещать наличие.
  const [inStockOnly, setInStockOnly] = useState(false);

  /*
    Фильтры по характеристикам. Значения распознаются из названия и описания
    (см. parseTech): характеристика есть не у каждого товара, поэтому активный
    фильтр сужает выдачу до товаров, где она распознана, — как в любом
    магазине. Счётчики в опциях показывают, сколько товаров за каждой.
  */
  const [diaFilter, setDiaFilter] = useState("");
  const [powFilter, setPowFilter] = useState("");
  const [impFilter, setImpFilter] = useState("");

  const techMap = useMemo(() => {
    const m = new Map<
      string,
      { dia: string | null; pow: string | null; imp: number | null }
    >();
    for (const p of products) {
      const t = parseTech(p.title, p.description);
      m.set(p.slug, {
        dia: t.diameterMm ? diameterBucket(t.diameterMm) : null,
        pow: t.powerMaxW ? powerBucket(t.powerMaxW) : null,
        imp: t.impedanceOhm ?? null,
      });
    }
    return m;
  }, [products]);

  // Опции с количеством товаров; пустые корзины не показываем
  const techOptions = useMemo(() => {
    const count = (f: (t: { dia: string | null; pow: string | null; imp: number | null }) => boolean) =>
      products.filter((p) => f(techMap.get(p.slug)!)).length;
    return {
      dia: DIAMETER_ORDER.map((b) => ({ v: b, n: count((t) => t.dia === b) })).filter((o) => o.n > 0),
      pow: POWER_ORDER.map((b) => ({ v: b, n: count((t) => t.pow === b) })).filter((o) => o.n > 0),
      imp: [1, 2, 4].map((v) => ({ v: String(v), n: count((t) => t.imp === v) })).filter((o) => o.n > 0),
    };
  }, [products, techMap]);

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
  }, [category, brand, query, sort, price, inStockOnly, diaFilter, powFilter, impFilter]);

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
    setInStockOnly(false);
    setDiaFilter("");
    setPowFilter("");
    setImpFilter("");
    router.push(pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const t = techMap.get(p.slug)!;
      return (
        (!category || p.category === category) &&
        (!brand || p.brand === brand) &&
        (!query || p.title.toLowerCase().includes(query.toLowerCase())) &&
        (!inStockOnly || isInStock(p) === true) &&
        (!diaFilter || t.dia === diaFilter) &&
        (!powFilter || t.pow === powFilter) &&
        (!impFilter || String(t.imp) === impFilter) &&
        p.price >= price[0] &&
        p.price <= price[1]
      );
    });
    // Известное наличие вперёд, неизвестное — в середину, «под заказ» — в хвост.
    const stockRank = (p: Product) =>
      isInStock(p) === true ? 0 : isInStock(p) === false ? 2 : 1;

    switch (sort) {
      case "sound_first":
        list = [...list].sort(
          (a, b) =>
            categoryRank(a.category) - categoryRank(b.category) ||
            stockRank(a) - stockRank(b) ||
            b.price - a.price,
        );
        break;
      case "availability":
        list = [...list].sort((a, b) => stockRank(a) - stockRank(b));
        break;
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
  }, [products, category, brand, query, price, sort, inStockOnly, diaFilter, powFilter, impFilter, techMap]);

  const shown = filtered.slice(0, visible);
  const activeCategory = categories.find((c) => c.slug === category);
  const hasFilters = Boolean(
    category || brand || query || priceActive || inStockOnly ||
    diaFilter || powFilter || impFilter,
  );

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
  if (inStockOnly)
    chips.push({
      key: "instock",
      label: "В наличии",
      clear: () => setInStockOnly(false),
    });
  if (diaFilter)
    chips.push({ key: "dia", label: diaFilter, clear: () => setDiaFilter("") });
  if (powFilter)
    chips.push({ key: "pow", label: powFilter, clear: () => setPowFilter("") });
  if (impFilter)
    chips.push({
      key: "imp",
      label: `${impFilter} Ом`,
      clear: () => setImpFilter(""),
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
              <option value="sound_first">Сначала акустика</option>
              <option value="availability">Сначала в наличии</option>
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

          {/* Характеристики: показываем select только если по нему есть данные */}
          {techOptions.dia.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
                Диаметр динамика
              </span>
              <select
                value={diaFilter}
                onChange={(e) => setDiaFilter(e.target.value)}
                className={selectCls}
              >
                <option value="">Любой</option>
                {techOptions.dia.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} · {o.n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {techOptions.pow.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
                Мощность (MAX)
              </span>
              <select
                value={powFilter}
                onChange={(e) => setPowFilter(e.target.value)}
                className={selectCls}
              >
                <option value="">Любая</option>
                {techOptions.pow.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} · {o.n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {techOptions.imp.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
                Сопротивление
              </span>
              <select
                value={impFilter}
                onChange={(e) => setImpFilter(e.target.value)}
                className={selectCls}
              >
                <option value="">Любое</option>
                {techOptions.imp.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} Ом · {o.n}
                  </option>
                ))}
              </select>
            </label>
          )}

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

          {/* Наличие */}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-[1.05rem] w-[1.05rem] shrink-0 cursor-pointer accent-[#FF5500]"
            />
            <span className="font-medium">Только в наличии</span>
          </label>

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
                  href={contacts.whatsapp}
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
