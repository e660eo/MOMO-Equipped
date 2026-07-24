"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import type { PointerEvent } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice, splitPayment, productImageUrl, isInStock } from "@/lib/format";
import { shortSpecs } from "@/lib/specs";
import { AddToCartButton } from "./add-to-cart-button";
import { ProductImage } from "./product-image";

/*
  Плитка товара.

  memo здесь не для красоты: в каталоге сетка перерисовывается на каждое
  нажатие в поиске и на каждый кадр перетаскивания ползунка цены, а карточек
  на экране двадцать четыре. Товар — объект из статических данных, ссылка на
  него не меняется, поэтому сравнения по ссылке достаточно.
*/
function ProductCardImpl({
  product,
  priority = false,
}: {
  product: Product;
  /**
   * Плитка из первого экрана: её снимок и есть кандидат в LCP, поэтому он
   * грузится сразу, а не по мере доскролла. Ставить всем подряд нельзя —
   * тогда полсотни снимков наперегонки съедят канал у того единственного,
   * по которому и меряется время отрисовки.
   */
  priority?: boolean;
}) {
  // Разбор характеристик из названия — не на каждый рендер
  const specs = useMemo(() => shortSpecs(product.title), [product.title]);

  /*
    Свечение под курсором.

    Раньше каждое движение мыши вызывало getBoundingClientRect прямо в
    обработчике: браузер вынужден был досчитать раскладку немедленно
    (forced reflow), и так — на каждое событие, по всей сетке. Теперь размер
    карточки замеряется один раз при входе курсора, а движения складываются в
    один кадр: в обработчике только запись двух переменных.
  */
  const rectRef = useRef<{ left: number; top: number } | null>(null);
  const frameRef = useRef(0);
  const posRef = useRef({ x: 0, y: 0 });

  const onEnter = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    rectRef.current = { left: r.left, top: r.top };
  }, []);

  const onMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const rect = rectRef.current;
    if (!rect) return;
    posRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (frameRef.current) return;
    const el = e.currentTarget;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      el.style.setProperty("--mx", `${posRef.current.x}px`);
      el.style.setProperty("--my", `${posRef.current.y}px`);
    });
  }, []);

  const onLeave = useCallback(() => {
    rectRef.current = null;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
  }, []);

  return (
    <div
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="spotlight-card group flex flex-col overflow-hidden rounded border border-border bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow)]"
    >
      <Link
        href={`/product/${product.slug}`}
        className="flex aspect-square items-center justify-center overflow-hidden rounded-sm border border-border bg-tile"
      >
        <ProductImage
          src={productImageUrl(product.image)}
          alt={product.title}
          priority={priority}
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
        {isInStock(product) === false && (
          <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
            Под заказ
          </span>
        )}
      </div>

      <Link href={`/product/${product.slug}`} className="mt-1.5">
        {/* min-h-11 вместо 2.8em: та же высота в две строки, но не меньше 44px */}
        <h3 className="min-h-11 text-[0.92rem] font-medium leading-snug transition-colors group-hover:text-signal">
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

      {/* На узкой плитке (две колонки на телефоне) цена и сплит в одну строку
          не помещаются и рвутся посреди числа — там они идут друг под другом. */}
      <div className="mt-3.5 flex flex-col gap-0.5 border-t border-border pt-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <span className="font-display text-[1.05rem] font-semibold whitespace-nowrap">
          {formatPrice(product.price)}
        </span>
        <span className="font-mono text-[0.68rem] text-muted-foreground whitespace-nowrap">
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

export const ProductCard = memo(ProductCardImpl);
