"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToast } from "./toast-store";
import type { Product } from "./types";

/*
  Сравнение товаров.

  Устроено как корзина (cart-store): zustand + сохранение в localStorage, чтобы
  выбор пережил переходы между страницами. Храним товары целиком — тогда
  страница /compare чисто клиентская: серверу за данными ходить не надо, всё
  уже в сторе. Староватая цена после правки каталога — мелочь для сравнения.
*/

export const COMPARE_MAX = 4;

interface CompareState {
  items: Product[];
  toggle: (p: Product) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (p) => {
        const items = get().items;
        if (items.some((i) => i.slug === p.slug)) {
          set({ items: items.filter((i) => i.slug !== p.slug) });
          return;
        }
        if (items.length >= COMPARE_MAX) {
          useToast.getState().push({
            title: `Сравнить можно до ${COMPARE_MAX} товаров`,
            description: "Уберите один из сравнения, чтобы добавить новый.",
          });
          return;
        }
        set({ items: [...items, p] });
      },
      remove: (slug) =>
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "momo-compare",
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
