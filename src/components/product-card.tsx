"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice, productImageUrl, isInStock } from "@/lib/format";
import { shortSpecs } from "@/lib/specs";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { ProductImage } from "./product-image";
import { CompareToggle } from "./compare-toggle";
import { YandexSplitBadge } from "./yandex-split-badge";

const CARD_IMAGE_SIZES =
  "(max-width: 639px) calc(50vw - 28px), (max-width: 1023px) calc(33vw - 28px), 256px";

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
    Подмена снимка при наведении.

    Второй кадр не рисуем заранее: сейчас дополнительные фото есть не у всех
    товаров, а если бы были у всех — каталог тянул бы вдвое больше картинок
    ради того, чего покупатель может и не увидеть. Поэтому файл заказывается
    в момент первого наведения, а показывается только когда доехал: проявить
    пустое место хуже, чем секунду подождать.
  */
  const second = product.images?.[0];
  const [wanted, setWanted] = useState(false);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState(false);
  const swapped = Boolean(second) && hovered && ready;

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

    /*
      Только мышь. Касание тоже поднимает pointerenter, но там за ним сразу
      идёт переход на карточку товара — качать второй снимок незачем, а на
      мобильном канале это прямой вред.
    */
    if (e.pointerType !== "mouse") return;
    setHovered(true);
    setWanted(true);
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
    setHovered(false);
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
      className="spotlight-card product-tile group flex flex-col overflow-hidden rounded border border-border bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow)]"
    >
      <Link
        href={`/product/${product.slug}`}
        className="tile-media flex aspect-square items-center justify-center overflow-hidden rounded-sm border border-border bg-tile"
      >
        <ProductImage
          src={productImageUrl(product.image)}
          alt={product.title}
          priority={priority}
          sizes={CARD_IMAGE_SIZES}
          className={cn(
            "h-[86%] w-[86%] object-contain mix-blend-multiply transition-opacity duration-300",
            swapped && "opacity-0",
          )}
        />

        {/*
          Второй кадр поверх первого. Обёртка absolute, а не сама картинка:
          `.spotlight-card > *` принудительно ставит прямым детям карточки
          position: relative, но сюда это правило не достаёт — мы уже внутри
          ссылки.

          alt пустой намеренно: это тот же товар, что и на первом снимке, и
          читалке экрана незачем произносить название дважды. Наведения она
          всё равно не видит.
        */}
        {second && wanted && (
          <span className="absolute inset-0 flex items-center justify-center">
            <ProductImage
              src={productImageUrl(second)}
              alt=""
              sizes={CARD_IMAGE_SIZES}
              onLoad={() => setReady(true)}
              className={cn(
                "h-[86%] w-[86%] object-contain mix-blend-multiply transition-opacity duration-300",
                swapped ? "opacity-100" : "opacity-0",
              )}
            />
          </span>
        )}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
        <CompareToggle product={product} className="ml-auto" />
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

      <div className="mt-3.5 border-t border-border pt-3.5">
        <span className="font-display text-[1.05rem] font-semibold whitespace-nowrap">
          {formatPrice(product.price)}
        </span>
        <YandexSplitBadge
          amount={product.price}
          size="s"
          variant="simple"
          color="transparent"
          className="mt-1.5"
        />
      </div>

      <div className="mt-3">
        <AddToCartButton product={product} />
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardImpl);
