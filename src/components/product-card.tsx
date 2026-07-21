"use client";

import type { PointerEvent } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice, splitPayment, productImageUrl } from "@/lib/data";
import { shortSpecs } from "@/lib/specs";
import { AddToCartButton } from "./add-to-cart-button";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: Product }) {
  const specs = shortSpecs(product.title);

  // Двигаем центр свечения за курсором внутри карточки (обновляется только
  // наведённая карточка — без глобальных слушателей).
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div
      onPointerMove={onMove}
      className="spotlight-card group flex flex-col overflow-hidden rounded border border-border bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow)]"
    >
      <Link
        href={`/product/${product.slug}`}
        className="flex aspect-square items-center justify-center overflow-hidden rounded-sm border border-border bg-tile"
      >
        <ProductImage
          src={productImageUrl(product.image)}
          alt={product.title}
          className="h-[86%] w-[86%] object-contain mix-blend-multiply"
        />
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
          {product.brand}
        </span>
        {product.isClearance && (
          <span className="rounded-sm bg-[var(--signal-text)] px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-white">
            Уценка
          </span>
        )}
        {/* «В наличии» на каждой плитке — шум; предупреждаем только про ожидание */}
        {product.inStock === false && (
          <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
            Под заказ
          </span>
        )}
      </div>

      <Link href={`/product/${product.slug}`} className="mt-1.5">
        <h3 className="min-h-[2.8em] text-[0.92rem] font-medium leading-snug transition-colors group-hover:text-signal">
          {product.title}
        </h3>
      </Link>

      {/* Характеристики, распознанные из названия */}
      {specs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {specs.map((s) => (
            <span
              key={s}
              className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.62rem] tracking-wide text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex items-baseline justify-between gap-2 border-t border-border pt-3.5">
        <span className="font-display text-[1.05rem] font-semibold">
          {formatPrice(product.price)}
        </span>
        <span className="font-mono text-[0.68rem] text-muted-foreground">
          <b className="font-medium text-[var(--signal-text)]">
            {formatPrice(splitPayment(product.price))}
          </b>{" "}
          × 4
        </span>
      </div>

      <div className="mt-3">
        <AddToCartButton product={product} />
      </div>
    </div>
  );
}
