"use client";

import { createContext, useContext, useMemo } from "react";
import {
  buildSearchIndex,
  searchIndex,
  type SearchHit,
  type SearchResult,
} from "@/lib/search-index";

/*
  Живой индекс поиска для клиентских подсказок.

  Раньше search-index импортировал data/products.json на этапе сборки, и цены
  в подсказках отставали от того, что владелец правит в /admin. Теперь серверный
  ShopChrome читает getProducts() из рантайм-папки и кладёт облегчённый список
  сюда — тем же способом, что контакты уходят через SiteConfigProvider.

  Индекс (с приведёнными названиями) строим один раз на весь список и отдаём
  готовую функцию поиска: перестроения на каждое нажатие клавиши нет.
*/

type SearchFn = (query: string, limit?: number) => SearchResult;

const SearchContext = createContext<SearchFn | null>(null);

export function SearchProvider({
  hits,
  children,
}: {
  hits: SearchHit[];
  children: React.ReactNode;
}) {
  const search = useMemo<SearchFn>(() => {
    const index = buildSearchIndex(hits);
    return (query, limit = 6) => searchIndex(index, query, limit);
  }, [hits]);

  return (
    <SearchContext.Provider value={search}>{children}</SearchContext.Provider>
  );
}

export function useSearch(): SearchFn {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch вызван вне SearchProvider");
  }
  return ctx;
}
