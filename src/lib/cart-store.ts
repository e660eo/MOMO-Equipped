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
  /**
   * Остаток на складе на момент добавления. Ограничивает количество в
   * корзине: узнавать о нехватке от менеджера после оформления — плохо.
   * Не задан — учёта по этому товару нет, ограничения тоже.
   */
  stock?: number;
  /** Готовый комплект остаётся одной строкой корзины с пакетной ценой. */
  bundle?: {
    slug: string;
    title: string;
    discountPercent: number;
    fullPrice: number;
    saving: number;
    items: Array<{
      slug: string;
      title: string;
      price: number;
      image: string;
      qty?: number;
    }>;
  };
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">) => void;
  addMany: (
    items: Omit<CartItem, "qty">[],
    toast?: { title?: string; description?: string },
  ) => void;
  addBundle: (item: Omit<CartItem, "qty"> & { bundle: NonNullable<CartItem["bundle"]> }) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  openCart: () => void;
}

/** Сколько штук этого товара допустимо в корзине. */
function capFor(item: { stock?: number }): number {
  return typeof item.stock === "number" ? item.stock : Infinity;
}

function mergeInto(
  list: CartItem[],
  item: Omit<CartItem, "qty">,
): CartItem[] {
  const existing = list.find((i) => i.slug === item.slug);
  if (!existing) return [...list, { ...item, qty: 1 }];
  // Остаток мог измениться с прошлого добавления — берём свежий
  const cap = capFor(item);
  return list.map((i) =>
    i.slug === item.slug
      ? { ...i, ...item, qty: Math.min(i.qty + 1, cap) }
      : i,
  );
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
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
      addBundle: (item) => {
        set((state) => {
          /*
            До появления строки «Комплект» старая кнопка добавляла компоненты
            по одному. При повторном добавлении снимаем по одной такой позиции,
            чтобы старая корзина автоматически превратилась в комплект и не
            задублировала состав.
          */
          let next = [...state.items];
          const required = new Map<string, number>();
          for (const component of item.bundle.items) {
            required.set(
              component.slug,
              (required.get(component.slug) ?? 0) + Math.max(1, component.qty ?? 1),
            );
          }
          const available = new Map<string, number>();
          for (const line of next) {
            if (line.bundle) continue;
            available.set(line.slug, (available.get(line.slug) ?? 0) + line.qty);
          }
          const canConvertLegacy = [...required].every(
            ([slug, qty]) => (available.get(slug) ?? 0) >= qty,
          );

          if (canConvertLegacy) {
            for (const [slug, requiredQty] of required) {
              let remaining = requiredQty;
              next = next.flatMap((line) => {
                if (line.bundle || line.slug !== slug || remaining <= 0) return [line];
                const consumed = Math.min(line.qty, remaining);
                remaining -= consumed;
                return line.qty === consumed ? [] : [{ ...line, qty: line.qty - consumed }];
              });
            }
          }
          return { items: mergeInto(next, item) };
        });
        useToast.getState().push({
          title: "Комплект добавлен в корзину",
          description: `${item.bundle.title} · скидка ${item.bundle.discountPercent}%`,
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
              : s.items.map((i) =>
                  i.slug === slug
                    ? { ...i, qty: Math.min(qty, capFor(i)) }
                    : i,
                ),
        })),
      clear: () => set({ items: [] }),
      openCart: () => {
        if (typeof window !== "undefined") window.location.assign("/cart");
      },
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
