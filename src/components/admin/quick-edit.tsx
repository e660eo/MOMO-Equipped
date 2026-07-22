"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { quickUpdate } from "@/app/admin/products/actions";
import type { Product } from "@/lib/types";

/*
  Цена и остаток прямо в строке списка.

  Сохранение — по Enter или по уходу из поля: отдельная кнопка на каждую
  строку превратила бы таблицу в частокол. Пока значение не сохранено, поле
  подсвечено, после записи коротко загорается галочка — видно, что цифра
  действительно уехала на сайт, а не осталась в поле.
*/

const cell =
  "w-full rounded-sm border bg-surface px-2 py-1.5 text-right text-[0.85rem] tabular-nums transition-colors focus:outline-none";

export function QuickEdit({ product }: { product: Product }) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(
    typeof product.stock === "number" ? String(product.stock) : "",
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const priceRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);

  const priceChanged = Number(price) !== product.price;
  const stockChanged =
    (stock === "" ? null : Number(stock)) !==
    (typeof product.stock === "number" ? product.stock : null);
  const dirty = priceChanged || stockChanged;

  function save() {
    if (pending) return;

    /*
      Значения берём из самих полей, а не из состояния: когда значение
      вставляют и сразу уходят из поля, обработчик ухода успевает увидеть
      ещё старое состояние — и правка молча терялась.
    */
    const rawPrice = priceRef.current?.value ?? price;
    const rawStock = stockRef.current?.value ?? stock;

    const nextPrice = Number(rawPrice);
    const nextStock = rawStock.trim() === "" ? null : Number(rawStock);

    const nothingChanged =
      nextPrice === product.price &&
      nextStock === (typeof product.stock === "number" ? product.stock : null);
    if (nothingChanged) return;

    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      setError("Цена должна быть больше нуля");
      return;
    }
    // Тот же предохранитель, что и в полной форме: цену вдвое ниже прежней
    // чаще набирают по ошибке, чем осознанно.
    if (
      nextPrice < product.price / 2 &&
      !window.confirm(
        `Цена падает больше чем вдвое: было ${formatPrice(product.price)}, станет ${formatPrice(nextPrice)}. Всё верно?`,
      )
    ) {
      setPrice(String(product.price));
      if (priceRef.current) priceRef.current.value = String(product.price);
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await quickUpdate(product.slug, nextPrice, nextStock);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setPrice(String(product.price));
      setStock(typeof product.stock === "number" ? String(product.stock) : "");
      setError("");
    }
  };

  const stockNumber = stock.trim() === "" ? null : Number(stock);
  const soldOut = stockNumber === 0;

  return (
    <div className="flex items-center justify-end gap-2">
      <label className="sr-only" htmlFor={`price-${product.slug}`}>
        Цена, ₽
      </label>
      <input
        id={`price-${product.slug}`}
        ref={priceRef}
        value={price}
        inputMode="numeric"
        onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={save}
        onKeyDown={onKey}
        disabled={pending}
        className={cn(
          cell,
          "w-[92px]",
          priceChanged ? "border-signal" : "border-input",
          "hover:border-signal/60 focus:border-signal",
        )}
      />
      <span className="text-[0.72rem] text-muted-foreground">₽</span>

      <label className="sr-only" htmlFor={`stock-${product.slug}`}>
        Остаток, шт
      </label>
      <input
        id={`stock-${product.slug}`}
        ref={stockRef}
        value={stock}
        inputMode="numeric"
        placeholder="—"
        title="Остаток на складе, штук. Пусто — учёт не ведётся, 0 — купить нельзя."
        onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={save}
        onKeyDown={onKey}
        disabled={pending}
        className={cn(
          cell,
          "w-[62px]",
          stockChanged ? "border-signal" : "border-input",
          soldOut && !stockChanged && "border-[var(--signal-text)] text-[var(--signal-text)]",
          "hover:border-signal/60 focus:border-signal",
        )}
      />
      <span className="w-8 text-[0.72rem] text-muted-foreground">шт</span>

      {/* Состояние: сохраняем → сохранено → тишина */}
      <span className="flex h-5 w-5 items-center justify-center">
        {pending && <Loader2 size={15} className="animate-spin text-muted-foreground" />}
        {!pending && saved && (
          <Check size={15} className="animate-in-check text-signal" />
        )}
      </span>

      {error && (
        <span className="max-w-[190px] text-[0.72rem] leading-tight text-[var(--signal-text)]">
          {error}
        </span>
      )}
    </div>
  );
}
