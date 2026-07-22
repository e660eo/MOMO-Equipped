"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Bundle, Product } from "@/lib/types";
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
}: {
  bundle?: Bundle;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveBundle,
    {},
  );
  const [items, setItems] = useState<string[]>(bundle?.items ?? []);
  const [discount, setDiscount] = useState(bundle?.discountPercent ?? 7);
  const [query, setQuery] = useState("");

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const chosen = items.map((s) => bySlug.get(s)).filter(Boolean) as Product[];
  const full = chosen.reduce((sum, p) => sum + p.price, 0);
  const price = Math.round((full * (100 - discount)) / 100 / 10) * 10;

  const found = query.trim()
    ? products
        .filter(
          (p) =>
            !items.includes(p.slug) &&
            p.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];

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

        <div className="mt-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти товар и добавить в сборку…"
            className={field}
          />
          {found.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-sm border border-border bg-surface">
              {found.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((list) => [...list, p.slug]);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-[0.85rem] transition-colors hover:text-signal"
                  >
                    <span className="flex-1">{p.title}</span>
                    <span className="text-muted-foreground">{formatPrice(p.price)}</span>
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
          className="rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
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
