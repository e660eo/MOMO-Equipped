"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchProducts, countMatches } from "@/lib/search-index";
import { formatPrice, productImageUrl } from "@/lib/format";
import { ProductImage } from "./product-image";

/**
 * Выпадающие подсказки под строкой поиска.
 *
 * Поиск идёт по индексу в браузере, поэтому результат появляется мгновенно.
 * Закрывается по клику снаружи и по Esc; выбор мышью и Enter обрабатывает
 * родительская форма.
 */
export function SearchSuggestions({
  query,
  open,
  onClose,
}: {
  query: string;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => searchProducts(query), [query]);
  const total = useMemo(() => countMatches(query), [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || query.trim().length < 2) return null;

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-xl border border-border bg-surface py-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)]"
    >
      {hits.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted-foreground">
          Ничего не нашлось по запросу «{query.trim()}»
        </p>
      ) : (
        <>
          {hits.map((h) => (
            <Link
              key={h.slug}
              href={`/product/${h.slug}`}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-tile">
                <ProductImage
                  src={productImageUrl(h.image)}
                  alt=""
                  className="h-[84%] w-[84%] object-contain mix-blend-multiply"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.86rem] font-medium leading-tight">
                  {h.title}
                </span>
                <span className="mt-0.5 block font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                  {h.brand}
                </span>
              </span>
              <span className="shrink-0 font-display text-[0.9rem] font-semibold">
                {formatPrice(h.price)}
              </span>
            </Link>
          ))}

          <Link
            href={`/catalog?search=${encodeURIComponent(query.trim())}`}
            onClick={onClose}
            className="mt-1 flex items-center gap-2 border-t border-border px-4 py-3 font-mono text-[0.72rem] uppercase tracking-wider text-signal transition-colors hover:bg-muted"
          >
            <Search size={13} />
            Показать все результаты ({total})
          </Link>
        </>
      )}
    </div>
  );
}
