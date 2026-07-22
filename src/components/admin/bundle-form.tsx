"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { formatPrice, productImageUrl, isInStock } from "@/lib/format";
import type { Bundle, Category, Product } from "@/lib/types";
import { saveBundle, type ActionState } from "@/app/admin/bundles/actions";

/*
  Форма сборки.

  Состав набирается из каталога: выбранные товары показываем списком с
  живой суммой и итогом со скидкой — так сразу видно, что получит покупатель,
  и не нужно считать в уме.
*/

const field =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none";
const label = "block text-[0.78rem] font-medium";

export function BundleForm({
  bundle,
  products,
  categories,
}: {
  bundle?: Bundle;
  products: Product[];
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveBundle,
    {},
  );
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  /*
    Состав чистим от товаров, которых в каталоге уже нет: удалённая позиция
    оставалась в наборе невидимкой — в списке не показывалась, но уезжала
    при сохранении и валила его ошибкой «часть товаров уже удалена».
  */
  const [items, setItems] = useState<string[]>(
    () => (bundle?.items ?? []).filter((slug) => bySlug.has(slug)),
  );
  const dropped = (bundle?.items.length ?? 0) - items.length;

  const [discount, setDiscount] = useState(bundle?.discountPercent ?? 7);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const chosen = items.map((s) => bySlug.get(s)!).filter(Boolean);
  const full = chosen.reduce((sum, p) => sum + p.price, 0);
  const price = Math.round((full * (100 - discount)) / 100 / 10) * 10;

  /*
    Подбор товара: список открыт всегда, а поиск и категория его сужают —
    так комплект собирается выбором из готового перечня, а не угадыванием
    точного названия. Слова ищем по отдельности: «саб 12» найдёт
    «Сабвуфер автомобильный ACHILLES 12 дюймов».
  */
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = products.filter((p) => {
    if (items.includes(p.slug)) return false;
    if (category && p.category !== category) return false;
    const haystack = `${p.title} ${p.brand}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });

  return (
    <form action={formAction} className="max-w-[760px]">
      {bundle && <input type="hidden" name="slug" value={bundle.slug} />}
      {items.map((slug) => (
        <input key={slug} type="hidden" name="items" value={slug} />
      ))}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="title">
            Название
          </label>
          <input
            id="title"
            name="title"
            defaultValue={bundle?.title}
            required
            className={`${field} mt-1.5`}
            placeholder="Первый бас"
          />
        </div>
        <div>
          <label className={label} htmlFor="tagline">
            Подпись сверху
          </label>
          <input
            id="tagline"
            name="tagline"
            defaultValue={bundle?.tagline}
            className={`${field} mt-1.5`}
            placeholder="Стартовый комплект"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="description">
            Описание
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={bundle?.description}
            className={`${field} mt-1.5`}
            placeholder="Для кого этот комплект и что в нём главное."
          />
        </div>
        <div>
          <label className={label} htmlFor="discountPercent">
            Скидка, %
          </label>
          <input
            id="discountPercent"
            name="discountPercent"
            inputMode="numeric"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className={`${field} mt-1.5`}
          />
        </div>
      </div>

      {/* Состав */}
      <fieldset className="mt-8">
        <legend className="text-[0.78rem] font-medium">Состав</legend>

        {dropped > 0 && (
          <p className="mt-2 rounded-sm border border-border bg-surface px-3 py-2 text-[0.8rem] text-muted-foreground">
            {dropped === 1
              ? "Один товар из этой сборки удалён из каталога и убран из состава."
              : `${dropped} товара из этой сборки удалены из каталога и убраны из состава.`}{" "}
            Добавьте замену ниже и сохраните.
          </p>
        )}

        {chosen.length > 0 && (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {chosen.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 py-2.5 text-[0.85rem]">
                <span className="flex-1">{p.title}</span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatPrice(p.price)}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((list) => list.filter((s) => s !== p.slug))}
                  className="text-[0.78rem] text-muted-foreground transition-colors hover:text-[var(--signal-text)]"
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5">
          <p className="text-[0.78rem] font-medium">Добавить товар</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: сабвуфер, усилитель, кабель…"
              className={`${field} min-w-[220px] flex-1`}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${field} w-auto`}
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-2 text-[0.72rem] text-muted-foreground">
            {found.length > 0
              ? `Показано ${Math.min(found.length, 60)} из ${found.length} — нажмите на товар, чтобы добавить`
              : "Ничего не нашлось: измените запрос или категорию"}
          </p>

          {found.length > 0 && (
            <ul className="mt-2 max-h-[320px] divide-y divide-border overflow-y-auto rounded-sm border border-border bg-surface">
              {found.slice(0, 60).map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => setItems((list) => [...list, p.slug])}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-[0.85rem] transition-colors hover:bg-signal/5 hover:text-signal active:scale-[0.995]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImageUrl(p.image)}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-sm border border-border bg-tile object-contain"
                    />
                    <span className="flex-1">
                      {p.title}
                      <span className="block text-[0.72rem] text-muted-foreground">
                        {p.brand}
                        {isInStock(p) === false && " · нет на складе"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatPrice(p.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {chosen.length > 0 && (
          <p className="mt-4 text-[0.85rem]">
            Сумма по отдельности: {formatPrice(full)} · со скидкой{" "}
            <b className="font-semibold text-signal">{formatPrice(price)}</b> ·
            выгода {formatPrice(full - price)}
          </p>
        )}
      </fieldset>

      {state.error && (
        <p className="mt-6 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          {state.error}
        </p>
      )}

      <div className="mt-7 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_20px_-6px_rgba(255,85,0,0.6)] active:scale-95 disabled:opacity-60"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <Link
          href="/admin/bundles"
          className="text-[0.85rem] text-muted-foreground transition-colors hover:text-signal"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
