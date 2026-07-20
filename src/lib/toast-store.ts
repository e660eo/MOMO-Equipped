"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  title: string;
  description?: string;
  image?: string;
  /** Необязательная кнопка-действие (например, «Открыть корзину»). */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 3400);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
