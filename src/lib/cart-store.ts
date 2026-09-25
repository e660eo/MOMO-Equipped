"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToast } from "./toast-store";
import { applyCartMutation, cartChanges, type CartMutation } from "./cart-sync";

export interface CartItem {
  slug: string;
  title: string;
  price: number;
  image: string;
  qty: number;
  packageQuantity?: number;
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
  ownerId: string | null;
  pending: CartMutation[];
  accounts: Record<string, { items: CartItem[]; pending: CartMutation[] }>;
  syncStatus: "idle" | "syncing" | "saved" | "error";
  bindAccount: (ownerId: string | null) => void;
  acceptRemote: (ownerId: string, items: CartItem[], acknowledged?: string) => void;
  add: (item: Omit<CartItem, "qty">) => void;
  addMany: (
    items: Omit<CartItem, "qty">[],
    toast?: { title?: string; description?: string },
  ) => void;
  addBundle: (item: Omit<CartItem, "qty"> & { bundle: NonNullable<CartItem["bundle"]> }) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
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
    (set) => {
      const changeItems = (change: (items: CartItem[]) => CartItem[], mode: "patch" | "add" = "patch") => set((state) => {
        const items = change(state.items);
        const lines = cartChanges(state.items, items);
        if (!lines.length) return { items };
        return {
          items,
          ...(state.ownerId ? {
            pending: [...state.pending, { id: crypto.randomUUID(), mode, lines: mode === "add"
              ? lines.map((line) => ({ ...line, qty: Math.max(0, line.qty - (state.items.find((item) => item.slug === line.slug)?.qty ?? 0)) }))
              : lines }],
            syncStatus: "syncing" as const,
          } : {}),
        };
      });
      return {
        items: [],
        ownerId: null,
        pending: [],
        accounts: {},
        syncStatus: "idle",
        bindAccount: (ownerId) => set((state) => {
          if (ownerId === state.ownerId) return state;
          const accounts = { ...state.accounts };
          if (state.ownerId) accounts[state.ownerId] = { items: state.items, pending: state.pending };
          const saved = ownerId ? accounts[ownerId] : undefined;
          const guest = !state.ownerId ? state.items : [];
          const pending = [...(saved?.pending ?? [])];
          if (ownerId && guest.length) pending.push({
            id: crypto.randomUUID(), mode: "merge", lines: guest.map(({ slug, qty }) => ({ slug, qty })),
          });
          const items = new Map((saved?.items ?? []).map((item) => [item.slug, item]));
          for (const item of guest) items.set(item.slug, { ...item, qty: Math.max(items.get(item.slug)?.qty ?? 0, item.qty) });
          if (ownerId) delete accounts[ownerId];
          return { ownerId, accounts, items: ownerId ? [...items.values()] : [], pending, syncStatus: ownerId ? "syncing" : "idle" };
        }),
        acceptRemote: (ownerId, remote, acknowledged) => set((state) => {
          if (state.ownerId !== ownerId) return state;
          const pending = state.pending.filter((mutation) => mutation.id !== acknowledged);
          let lines = remote.map(({ slug, qty }) => ({ slug, qty }));
          for (const mutation of pending) lines = applyCartMutation(lines, mutation);
          const products = new Map([...state.items, ...remote].map((item) => [item.slug, item]));
          const items = lines.flatMap(({ slug, qty }) => {
            const item = products.get(slug);
            return item ? [{ ...item, qty }] : [];
          });
          return {
            items: JSON.stringify(items) === JSON.stringify(state.items) ? state.items : items,
            pending,
            syncStatus: pending.length ? "syncing" : "saved",
          };
        }),
        add: (item) => {
          changeItems((items) => mergeInto(items, item), "add");
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
          changeItems((current) => {
            let next = current;
            for (const item of items) next = mergeInto(next, item);
            return next;
          }, "add");
          useToast.getState().push({
            title: toast?.title ?? "Сборка добавлена в корзину",
            description: toast?.description,
            actionLabel: "Корзина",
            onAction: () => useCart.getState().openCart(),
          });
        },
        addBundle: (item) => {
          // Комплект — дополнительная покупка. Совпадение состава не означает,
          // что отдельно выбранные товары можно заменить или удалить.
          changeItems((items) => mergeInto(items, item), "add");
          useToast.getState().push({
            title: "Комплект добавлен в корзину",
            description: `${item.bundle.title} · скидка ${item.bundle.discountPercent}%`,
            actionLabel: "Корзина",
            onAction: () => useCart.getState().openCart(),
          });
        },
        remove: (slug) =>
          changeItems((items) => items.filter((i) => i.slug !== slug)),
        setQty: (slug, qty) =>
          changeItems((items) =>
              qty < 1
                ? items.filter((i) => i.slug !== slug)
                : items.map((i) =>
                    i.slug === slug
                      ? { ...i, qty: Math.min(qty, capFor(i)) }
                      : i,
                  ),
          ),
        clear: () => changeItems(() => []),
        replace: (items) => changeItems(() => items),
        openCart: () => {
          if (typeof window !== "undefined") window.location.assign("/cart");
        },
      };
    },
    {
      name: "momo-cart",
      partialize: (s) => ({ items: s.items, ownerId: s.ownerId, pending: s.pending, accounts: s.accounts }),
    },
  ),
);

export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.qty, 0);

export const cartCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.qty, 0);
