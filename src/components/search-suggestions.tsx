"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatPrice, productImageUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/search-index";
import { ProductImage } from "./product-image";

/**
 * Выпадающие подсказки под строкой поиска.
 *
 * Поиск идёт через короткий серверный запрос с debounce: полный каталог не
 * сериализуется в HTML каждой страницы и не хранится в браузере.
 * Закрывается по клику снаружи и по Esc; выбор мышью и Enter обрабатывает
 * родительская форма.
 */
export function SearchSuggestions({
  query,
  open,
  onClose,
  onNavigate,
  variant = "float",
  limit = 6,
}: {
  query: string;
  open: boolean;
  onClose: () => void;
  /** Мобильному меню мало закрыть подсказки — надо свернуть и само меню. */
  onNavigate?: () => void;
  /** float — выпадает поверх страницы (десктоп); inline — встаёт в поток (меню). */
  variant?: "float" | "inline";
  limit?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /*
    Буква в поле появляется сразу, запрос начинается после короткой паузы,
    а предыдущий отменяется при следующем нажатии.
  */
  const searchQuery = query.trim();
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([searchQuery, limit, retry]);
  const [responseState, setResponseState] = useState<
    { key: string; result: SearchResult } | { key: string; error: true } | null
  >(null);
  // До ответа именно на текущий запрос показываем ожидание, а не пустую
  // выдачу или результаты предыдущей модели (в том числе во время debounce).
  const current = responseState?.key === requestKey ? responseState : null;
  const loading = current === null;
  const failed = current !== null && "error" in current;
  const { hits, total } = current && "result" in current
    ? current.result : { hits: [], total: 0 };

  useEffect(() => {
    const q = searchQuery;
    setResponseState(null);
    if (!open || q.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("search unavailable");
        const result = (await response.json()) as SearchResult;
        if (!controller.signal.aborted) setResponseState({ key: requestKey, result });
      } catch {
        if (!controller.signal.aborted) {
          setResponseState({ key: requestKey, error: true });
        }
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, limit, open, requestKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      /*
        «Снаружи» — это снаружи всей строки поиска, а не только списка.
        Иначе нажатие в уже сфокусированное поле закрывало подсказки:
        mousedown приходит вне списка, а focus второй раз не срабатывает.
      */
      const root = ref.current?.closest("form") ?? ref.current;
      if (root && !root.contains(e.target as Node)) onClose();
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

  // Уход по подсказке закрывает и список, и меню, из которого его открыли
  const leave = () => {
    onClose();
    onNavigate?.();
  };

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface py-1.5",
        variant === "float"
          ? "absolute left-0 right-0 top-[calc(100%+10px)] z-50 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)]"
          : // В мобильном меню список стоит в потоке: над ним «шторка» с
            // overflow-hidden, выпадающий поверх был бы обрезан по её краю.
            "mt-2 animate-[hints-in_.22s_cubic-bezier(0.16,1,0.3,1)]",
      )}
    >
      {loading ? (
        <p role="status" className="px-4 py-5 text-center text-sm text-muted-foreground">
          Ищем…
        </p>
      ) : failed ? (
        <div className="px-4 py-3 text-sm">
          <p role="status" className="text-muted-foreground">Не удалось загрузить подсказки. Попробуйте ещё раз или откройте каталог.</p>
          <div className="mt-2 flex flex-wrap gap-x-4">
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 underline underline-offset-4">Повторить поиск</button>
            <Link href={`/catalog?search=${encodeURIComponent(searchQuery)}`} onClick={leave} className="inline-flex min-h-11 items-center underline underline-offset-4">Открыть каталог</Link>
          </div>
        </div>
      ) : hits.length === 0 ? (
        <p role="status" className="px-4 py-5 text-center text-sm text-muted-foreground">
          Ничего не нашлось по запросу «{searchQuery}»
        </p>
      ) : (
        <>
          {hits.map((h) => (
            <Link
              key={h.slug}
              href={`/product/${h.slug}`}
              onClick={leave}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-tile">
                <ProductImage
                  src={productImageUrl(h.image)}
                  alt=""
                  sizes="64px"
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
            href={`/catalog?search=${encodeURIComponent(searchQuery)}`}
            onClick={leave}
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
