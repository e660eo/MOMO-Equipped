"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { productImageUrl, isInStock } from "@/lib/format";
import { plural, cn } from "@/lib/utils";
import {
  toggleHidden,
  deleteProduct,
  createAsClearance,
} from "@/app/admin/products/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { QuickEdit } from "@/components/admin/quick-edit";
import type { Product, Category } from "@/lib/types";

/*
  Список товаров с ЖИВЫМ поиском.

  Раньше поиск был серверной формой: впиши название целиком, нажми «Показать»,
  дождись перезагрузки. Все товары и так приезжают на страницу, поэтому фильтр
  по названию и категории считаем прямо в браузере — список сужается по мере
  ввода буквы за буквой.

  Действия строки (скрыть/удалить/быстрая правка) остались серверными: форма с
  server action работает и из клиентского компонента.
*/

/*
  Порядок разделов — как в каталоге на сайте (CATEGORY_ORDER в catalog-view.tsx):
  основной автозвук сверху, аксессуары и свет — в конце. Держим копию здесь, а
  не тянем клиентский компонент витрины в панель.
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

export function ProductsList({
  products,
  categories,
  bundleNames,
  saved,
}: {
  products: Product[];
  categories: Category[];
  bundleNames: Record<string, string[]>;
  saved?: boolean;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  // Показывать только товары с нулевым остатком — включается кликом по счётчику.
  const [onlyOut, setOnlyOut] = useState(false);

  // Нижняя шторка «ещё» для конкретной строки. shown отдельно от sheet, чтобы
  // при закрытии успел проиграться выезд вниз, а потом узел убрался.
  const [sheet, setSheet] = useState<Product | null>(null);
  const [shown, setShown] = useState(false);

  const openSheet = (p: Product) => {
    setSheet(p);
    requestAnimationFrame(() => setShown(true));
  };
  const closeSheet = () => {
    setShown(false);
    setTimeout(() => setSheet(null), 200);
  };

  const titleByCategory = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.title])),
    [categories],
  );

  const bundleNote = (slug: string) => {
    const names = bundleNames[slug];
    return names?.length
      ? ` Товар входит в ${names.length > 1 ? "сборки" : "сборку"} «${names.join("», «")}» — ${names.length > 1 ? "они пересчитаются" : "она пересчитается"} без него.`
      : "";
  };

  // База: фильтр по названию и категории, без учёта «только без остатка» —
  // чтобы счётчик показывал стабильное число, не зависящее от своего же клика.
  const base = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!query || p.title.toLowerCase().includes(query)),
    );
  }, [products, q, category]);

  const soldOut = useMemo(() => base.filter((p) => p.stock === 0).length, [base]);

  const filtered = useMemo(() => {
    const list = onlyOut ? base.filter((p) => p.stock === 0) : base;
    // Стабильная сортировка по разделам: основной звук выше, свет/аксессуары
    // ниже. Внутри раздела порядок сохраняется как в данных.
    return [...list].sort(
      (a, b) => categoryRank(a.category) - categoryRank(b.category),
    );
  }, [base, onlyOut]);

  const active = Boolean(q.trim() || category || onlyOut);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase">Товары</h1>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            {filtered.length}{" "}
            {plural(filtered.length, "товар", "товара", "товаров")}
            {active && " по запросу"}
            {(soldOut > 0 || onlyOut) && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setOnlyOut((v) => !v)}
                  className={cn(
                    "underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80",
                    onlyOut
                      ? "font-semibold text-[var(--signal-text)]"
                      : "text-[var(--signal-text)]",
                  )}
                  title={
                    onlyOut
                      ? "Показать все товары"
                      : "Показать только товары без остатка"
                  }
                >
                  {soldOut} без остатка{onlyOut ? " — показаны" : ""}
                </button>
              </>
            )}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_20px_-6px_rgba(255,85,0,0.6)] active:scale-95"
        >
          Добавить товар
        </Link>
      </div>

      {saved && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже на сайте.
        </p>
      )}

      {/* Живой поиск: фильтрует по мере ввода, кнопка «Показать» больше не нужна */}
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию…"
          className="min-w-[220px] flex-1 rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
          aria-label="Поиск товара по названию"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        {active && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setCategory("");
              setOnlyOut(false);
            }}
            className="rounded-sm border border-border px-4 py-2 text-sm font-medium transition-all hover:border-signal hover:text-signal active:scale-95"
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[0.85rem]">
          <thead>
            <tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
              <th className="py-2.5 pr-3 font-medium">Товар</th>
              <th className="py-2.5 pr-3 font-medium">Категория</th>
              <th className="py-2.5 pr-3 text-right font-medium">
                Цена и остаток
              </th>
              <th className="py-2.5 pr-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.slug}
                className="admin-row border-b border-border align-middle"
              >
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImageUrl(p.image)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-sm border border-border bg-tile object-contain"
                    />
                    <span className="flex flex-col">
                      <Link
                        href={`/admin/products/${p.slug}`}
                        className="font-medium transition-colors hover:text-signal"
                      >
                        {p.title}
                      </Link>
                      <span className="flex gap-2 text-[0.72rem] text-muted-foreground">
                        {p.brand}
                        {isInStock(p) === false && (
                          <span className="text-[var(--signal-text)]">
                            · нет на складе
                          </span>
                        )}
                        {p.isClearance && <span>· уценка</span>}
                        {p.hidden && (
                          <span className="text-[var(--signal-text)]">
                            · скрыт
                          </span>
                        )}
                        {bundleNames[p.slug]?.length ? (
                          <span title={bundleNames[p.slug].join(", ")}>
                            · в сборке
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {titleByCategory.get(p.category) ?? p.category}
                </td>
                <td className="py-2.5 pr-3">
                  <QuickEdit product={p} />
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <form action={toggleHidden}>
                      <input type="hidden" name="slug" value={p.slug} />
                      {!p.hidden && bundleNames[p.slug]?.length ? (
                        <ConfirmButton
                          label="Скрыть"
                          tone="neutral"
                          question={`Убрать «${p.title}» с витрины?${bundleNote(p.slug)}`}
                        />
                      ) : (
                        <button
                          type="submit"
                          className="text-muted-foreground transition-all hover:text-signal active:scale-95"
                        >
                          {p.hidden ? "Вернуть" : "Скрыть"}
                        </button>
                      )}
                    </form>
                    <form action={deleteProduct}>
                      <input type="hidden" name="slug" value={p.slug} />
                      <ConfirmButton
                        label="Удалить"
                        question={`Удалить «${p.title}» насовсем? Чтобы просто убрать с витрины, нажмите «Скрыть».${bundleNote(p.slug)}`}
                      />
                    </form>
                    <button
                      type="button"
                      onClick={() => openSheet(p)}
                      aria-label="Ещё действия"
                      className="text-muted-foreground transition-all hover:text-signal active:scale-90"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {onlyOut
              ? "Товаров без остатка нет."
              : "Ничего не нашлось — измените запрос."}
          </p>
        )}
      </div>

      {/* Нижняя шторка действий: выезжает снизу, фон затемняется. */}
      {sheet && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <div
            onClick={closeSheet}
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity duration-200",
              shown ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "relative w-full max-w-[520px] rounded-t-2xl border border-border bg-surface p-5 pb-8 shadow-2xl transition-transform duration-200 ease-out",
              shown ? "translate-y-0" : "translate-y-full",
            )}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <p className="text-[0.72rem] uppercase tracking-wider text-muted-foreground">
              Товар
            </p>
            <p className="mt-0.5 truncate text-[0.95rem] font-medium">
              {sheet.title}
            </p>

            <form action={createAsClearance} className="mt-5">
              <input type="hidden" name="slug" value={sheet.slug} />
              <button
                type="submit"
                className="w-full rounded-sm bg-signal px-4 py-3 text-[0.9rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.98]"
              >
                Создать как уценку
              </button>
            </form>
            <p className="mt-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">
              Создаст скрытую копию этого товара с пометкой «уценка» и откроет её
              на редактирование — поставьте цену уценки, остаток и снимите
              «Скрыть». Исходный товар не изменится.
            </p>

            <button
              type="button"
              onClick={closeSheet}
              className="mt-5 w-full rounded-sm border border-border px-4 py-2.5 text-[0.85rem] font-medium transition-colors hover:border-signal hover:text-signal"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
