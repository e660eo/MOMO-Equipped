"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ZoomIn, Plus, Minus } from "lucide-react";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/utils";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";

/*
  Галерея фото товара: обложка, миниатюры и крупный просмотр.

  Крупный просмотр рисуется порталом в <body>. Это не украшение, а
  единственный надёжный способ: сама галерея живёт внутри липкой колонки
  страницы товара, а на странице хватает обёрток со своими слоями и
  трансформациями. Внутри такой обёртки `position: fixed` считается не от
  окна браузера, а от неё, — и просмотр открывался обрезанным, ниже шапки
  сайта. Портал выносит его из этой иерархии целиком.
*/

/** Пределы увеличения. Больше четырёх крат — уже пиксели, а не деталь. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 0.5;

export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const many = images.length > 1;

  // Портал возможен только в браузере: на сервере document нет.
  useEffect(() => setMounted(true), []);

  /* --------------------------- увеличение --------------------------- */

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomed = scale > MIN_SCALE;

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const fit = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

  /*
    Масштаб меняем функциональным обновлением, а не «взять текущее и
    прибавить». Разница видна на быстрых нажатиях: React складывает их в
    один проход, и все обработчики читают одно и то же старое значение —
    три щелчка по «+» давали один шаг вместо трёх.
  */
  const zoomBy = useCallback((delta: number) => {
    setScale((s) => fit(s + delta));
  }, []);

  /** Абсолютное значение — для щипка и двойного щелчка. */
  const zoomTo = useCallback((value: number) => {
    setScale(fit(value));
  }, []);

  /*
    Вернулись к исходному масштабу — снимок снова по центру. Иначе он
    остался бы сдвинутым, а поправить это нечем: тянуть неувеличенное фото
    мы не даём.
  */
  useEffect(() => {
    if (scale === MIN_SCALE && (offset.x !== 0 || offset.y !== 0)) {
      setOffset({ x: 0, y: 0 });
    }
  }, [scale, offset.x, offset.y]);

  const prev = useCallback(() => {
    setIdx((i) => (i - 1 + images.length) % images.length);
    reset();
  }, [images.length, reset]);

  const next = useCallback(() => {
    setIdx((i) => (i + 1) % images.length);
    reset();
  }, [images.length, reset]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  /* ------------------------- перетаскивание ------------------------- */

  /*
    Указатели держим в словаре: один — перетаскивание увеличенного снимка,
    два — щипок для масштаба на сенсорном экране. Pointer Events дают и то,
    и другое одним набором обработчиков, без отдельной ветки под touch.
  */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragFrom = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchFrom = useRef<{ dist: number; scale: number } | null>(null);
  // Отличаем перетаскивание от клика: клик по фону закрывает просмотр,
  // а отпускание после протяжки — нет.
  const moved = useRef(false);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;

    if (pointers.current.size === 2) {
      pinchFrom.current = { dist: distance(), scale };
      dragFrom.current = null;
      return;
    }
    if (zoomed) {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragFrom.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchFrom.current) {
      moved.current = true;
      const ratio = distance() / pinchFrom.current.dist;
      zoomTo(pinchFrom.current.scale * ratio);
      return;
    }

    const from = dragFrom.current;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setOffset({ x: from.ox + dx, y: from.oy + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchFrom.current = null;
    if (pointers.current.size === 0) dragFrom.current = null;
  };

  /* ---------------------------- клавиши ----------------------------- */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "+" || e.key === "=") zoomBy(STEP);
      else if (e.key === "-") zoomBy(-STEP);
      else if (e.key === "0") reset();
    };
    // Общая блокировка: компенсирует ширину полосы прокрутки, иначе страница
    // под просмотром дёргается вбок в момент открытия
    lockScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, prev, next, zoomBy, reset]);

  /*
    Колесо мыши. Слушателя вешаем руками: React ставит обработчик колеса
    пассивным, а пассивный не может отменить прокрутку страницы — и вместо
    приближения снимка уезжала бы страница под ним.
  */
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? STEP : -STEP);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, zoomBy]);

  /* ----------------------------- разметка ---------------------------- */

  const lightbox = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      className={cn(
        "fixed inset-0 z-[300] flex flex-col bg-black/90 backdrop-blur-sm transition-opacity",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {/* Верхняя полоса: счётчик и выход */}
      <div className="flex shrink-0 items-center justify-between gap-4 p-3 sm:p-4">
        <span className="font-mono text-xs text-white/70">
          {many ? `${idx + 1} / ${images.length}` : ""}
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть просмотр"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors hover:border-signal hover:text-signal"
        >
          <X size={18} />
        </button>
      </div>

      {/*
        Сцена. Клик по пустому месту закрывает просмотр, клик по самому
        снимку — нет; протяжка не считается кликом, иначе просмотр
        захлопывался бы каждый раз после перемещения увеличенного фото.
      */}
      <div
        ref={stageRef}
        onClick={(e) => {
          if (e.target === e.currentTarget && !moved.current) close();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 sm:px-16"
        style={{ touchAction: zoomed ? "none" : "pan-y" }}
      >
        {many && (
          <button
            type="button"
            onClick={prev}
            aria-label="Предыдущее фото"
            className="absolute left-2 top-1/2 z-[1] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors hover:border-signal hover:text-signal sm:left-4"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Само фото грузим только при открытом просмотре: это полный файл */}
        {open && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[idx]}
            alt={alt}
            draggable={false}
            onDoubleClick={() => zoomTo(zoomed ? MIN_SCALE : 2)}
            style={{
              /*
                Размер в единицах окна, а не в процентах от родителя:
                проценты зависят от того, сумел ли браузер посчитать высоту
                цепочки родителей, и именно на этом снимок вылезал за экран.
              */
              maxWidth: "min(96vw, 1400px)",
              maxHeight: "calc(100dvh - 190px)",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragFrom.current ? "none" : "transform 0.18s ease-out",
              cursor: zoomed ? "grab" : "zoom-in",
            }}
            className="select-none rounded-md bg-white object-contain"
          />
        )}

        {many && (
          <button
            type="button"
            onClick={next}
            aria-label="Следующее фото"
            className="absolute right-2 top-1/2 z-[1] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors hover:border-signal hover:text-signal sm:right-4"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Нижняя полоса: масштаб и миниатюры */}
      <div className="shrink-0 space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => zoomBy(-STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Уменьшить"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors hover:border-signal hover:text-signal disabled:opacity-35 disabled:hover:border-white/25 disabled:hover:text-white"
          >
            <Minus size={16} />
          </button>
          <span className="w-14 text-center font-mono text-xs tabular-nums text-white/70">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Увеличить"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors hover:border-signal hover:text-signal disabled:opacity-35 disabled:hover:border-white/25 disabled:hover:text-white"
          >
            <Plus size={16} />
          </button>
        </div>

        {many && (
          <div className="flex justify-center gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => {
                  setIdx(i);
                  reset();
                }}
                aria-label={`Фото ${i + 1}`}
                aria-current={i === idx}
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-white transition-colors",
                  i === idx ? "border-signal" : "border-white/25 hover:border-white/60",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-[84%] w-[84%] object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Обложка */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть фото крупно"
        className="group relative flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden rounded border border-border bg-tile"
      >
        <ProductImage
          src={images[idx]}
          alt={alt}
          sizes="(max-width: 1024px) 92vw, 560px"
          priority
          className="h-[86%] w-[86%] object-contain mix-blend-multiply"
        />
        <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <ZoomIn size={16} />
        </span>
      </button>

      {/* Миниатюры — только когда есть что листать */}
      {many && (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Фото ${i + 1}`}
              aria-current={i === idx}
              className={cn(
                "flex h-16 w-16 items-center justify-center overflow-hidden rounded-sm border bg-tile transition-colors",
                i === idx ? "border-signal" : "border-border hover:border-signal/50",
              )}
            >
              <ProductImage
                src={src}
                alt=""
                sizes="96px"
                className="h-[84%] w-[84%] object-contain mix-blend-multiply"
              />
            </button>
          ))}
        </div>
      )}

      {mounted && createPortal(lightbox, document.body)}
    </div>
  );
}
