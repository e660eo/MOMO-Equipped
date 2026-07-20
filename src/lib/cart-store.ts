"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToast } from "./toast-store";

export interface CartItem {
  slug: string;
  title: string;
  price: number;
  image: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  add: (item: Omit<CartItem, "qty">) => void;
  addMany: (
    items: Omit<CartItem, "qty">[],
    toast?: { title?: string; description?: string },
  ) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

function mergeInto(
  list: CartItem[],
  item: Omit<CartItem, "qty">,
): CartItem[] {
  const existing = list.find((i) => i.slug === item.slug);
  return existing
    ? list.map((i) => (i.slug === item.slug ? { ...i, qty: i.qty + 1 } : i))
    : [...list, { ...item, qty: 1 }];
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      add: (item) => {
        set((s) => ({ items: mergeInto(s.items, item) }));
        // Тихий фидбек тостом вместо навязчивого раскрытия корзины.
        useToast.getState().push({
          title: "Добавлено в корзину",
          description: item.title,
          image: item.image,
          actionLabel: "Корзина",
          onAction: () => useCart.getState().openCart(),
        });
      },
      addMany: (items, toast) => {
        set((s) => {
          let next = s.items;
          for (const item of items) next = mergeInto(next, item);
          return { items: next };
        });
        useToast.getState().push({
          title: toast?.title ?? "Сборка добавлена в корзину",
          description: toast?.description,
          actionLabel: "Корзина",
          onAction: () => useCart.getState().openCart(),
        });
      },
      remove: (slug) =>
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({
          items:
            qty < 1
              ? s.items.filter((i) => i.slug !== slug)
              : s.items.map((i) => (i.slug === slug ? { ...i, qty } : i)),
        })),
      clear: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: "momo-cart",
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.qty, 0);

export const cartCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.qty, 0);
