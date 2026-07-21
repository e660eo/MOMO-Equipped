"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/utils";

/*
  Галерея фото товара. Обложка кликабельна — открывается крупный просмотр
  (лайтбокс) с листанием. Миниатюры показываются, когда фото больше одного:
  владелец добавляет снимки в data/products.json (поле images) — и они
  подхватываются без правок кода.
*/
export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const many = images.length > 1;

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, images.length]);

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
              className={cn(
                "flex h-16 w-16 items-center justify-center overflow-hidden rounded-sm border bg-tile transition-colors",
                i === idx ? "border-signal" : "border-border hover:border-signal/50",
              )}
            >
              <ProductImage
                src={src}
                alt=""
                className="h-[84%] w-[84%] object-contain mix-blend-multiply"
              />
            </button>
          ))}
        </div>
      )}

      {/* Лайтбокс */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Просмотр фото"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm transition-opacity sm:p-10",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Закрыть"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-signal hover:text-signal"
        >
          <X size={17} />
        </button>

        {many && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Предыдущее фото"
            className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-signal hover:text-signal sm:left-6"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Клик по самому фото не закрывает просмотр */}
        {open && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[idx]}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-md bg-white object-contain"
          />
        )}

        {many && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Следующее фото"
            className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-signal hover:text-signal sm:right-6"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {many && (
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-xs text-white/70">
            {idx + 1} / {images.length}
          </span>
        )}
      </div>
    </div>
  );
}
