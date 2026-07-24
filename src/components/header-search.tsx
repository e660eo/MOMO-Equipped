"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AnimatedGlowingSearch } from "./ui/animated-glowing-search-bar";
import { SearchSuggestions } from "./search-suggestions";
import { cleanQuery } from "@/lib/sanitize";

/*
  Строка поиска вынесена из шапки отдельным компонентом.

  Раньше строка запроса жила в состоянии SiteHeader, и каждая набранная буква
  перерисовывала шапку целиком: кнопку «Каталог», обе плашки нав-ряда, выбор
  города, переключатель темы и счётчик корзины вместе с его пружинной
  анимацией. Ни одному из них новая буква не нужна.

  Теперь состояние живёт здесь, и на нажатие клавиши обновляются только само
  поле и список подсказок.
*/
export function HeaderSearch({
  variant = "desktop",
  onNavigate,
}: {
  /** desktop — с подсказками и свечением; mobile — просто поле в меню. */
  variant?: "desktop" | "mobile";
  /** Шапке нужно закрыть мобильное меню после перехода. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);

  // Стабильная ссылка: иначе SearchSuggestions переподписывал бы слушатели
  // документа на каждое нажатие клавиши.
  const closeHints = useCallback(() => setHintsOpen(false), []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = cleanQuery(query);
      router.push(q ? `/catalog?search=${encodeURIComponent(q)}` : "/catalog");
      setHintsOpen(false);
      onNavigate?.();
    },
    [query, router, onNavigate],
  );

  if (variant === "mobile") {
    return (
      <form onSubmit={submit} role="search" className="relative mb-2">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти товары…"
          aria-label="Поиск товаров"
          className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-base text-foreground focus:border-signal focus:outline-none"
        />
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="relative hidden flex-1 md:block" role="search">
      <AnimatedGlowingSearch className="w-full">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHintsOpen(true);
            }}
            onFocus={() => setHintsOpen(true)}
            placeholder="Найти товары…"
            aria-label="Поиск товаров"
            autoComplete="off"
            className="w-full rounded-full bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground focus:outline-none"
          />
        </div>
      </AnimatedGlowingSearch>
      <SearchSuggestions query={query} open={hintsOpen} onClose={closeHints} />
    </form>
  );
}
