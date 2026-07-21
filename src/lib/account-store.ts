"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hashPassword, verifyPassword } from "./local-auth";
import { phoneDigits } from "./phone";

/*
  ЛОКАЛЬНЫЙ аккаунт покупателя — до серверной Фазы 3.

  Всё живёт в localStorage этого браузера: профиль и PBKDF2-хеш пароля
  (см. local-auth.ts — открытый пароль не хранится и никуда не уходит).
  Один аккаунт на устройство: без сервера «второй пользователь» всё равно
  видел бы данные первого, поэтому множественность здесь — иллюзия.

  В Фазе 3 сигнатуры сохранятся, но register/login начнут ходить на сервер,
  а локальная запись станет черновиком для миграции.
*/

export interface AccountProfile {
  name: string;
  email: string;
  phone: string;
}

interface StoredAccount extends AccountProfile {
  salt: string;
  hash: string;
  createdAt: string;
}

// Данные получателя в корзине (momo-recipient) — отдельное хранилище;
// при регистрации подсеваем туда имя и телефон, чтобы корзина заполнялась сама.
const RECIPIENT_KEY = "momo-recipient";

interface AccountState {
  account: StoredAccount | null;
  authed: boolean;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** null — успех, иначе текст ошибки для формы. */
  register: (
    p: AccountProfile & { password: string },
  ) => Promise<string | null>;
  login: (identifier: string, password: string) => Promise<string | null>;
  logout: () => void;
  /** Удаляет только запись аккаунта; заказы и адрес чистит вызывающая сторона. */
  deleteAccount: () => void;
  updateProfile: (p: AccountProfile) => void;
}

const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}***@${domain ?? ""}`;
};

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      account: null,
      authed: false,
      modalOpen: false,
      openModal: () => set({ modalOpen: true }),
      closeModal: () => set({ modalOpen: false }),

      register: async ({ name, email, phone, password }) => {
        const existing = get().account;
        if (existing) {
          return `На этом устройстве уже есть аккаунт (${maskEmail(existing.email)}) — войдите в него. Забыли пароль? Его можно сбросить на вкладке «Вход».`;
        }
        try {
          const { salt, hash } = await hashPassword(password);
          set({
            account: {
              name: name.trim(),
              email: email.trim().toLowerCase(),
              phone,
              salt,
              hash,
              createdAt: new Date().toISOString(),
            },
            authed: true,
          });
        } catch (e) {
          return e instanceof Error ? e.message : "Не получилось создать аккаунт.";
        }
        // Подсеваем получателя для корзины, если он ещё не заполнялся
        try {
          if (!localStorage.getItem(RECIPIENT_KEY)) {
            localStorage.setItem(
              RECIPIENT_KEY,
              JSON.stringify({ name: name.trim(), phone }),
            );
          }
        } catch {}
        return null;
      },

      login: async (identifier, password) => {
        const account = get().account;
        if (!account) {
          return "На этом устройстве аккаунта нет — создайте его на вкладке «Регистрация».";
        }
        const id = identifier.trim().toLowerCase();
        const byEmail = id === account.email;
        const idDigits = phoneDigits(identifier);
        const byPhone =
          idDigits.length === 10 && idDigits === phoneDigits(account.phone);
        if (!byEmail && !byPhone) {
          return "Такой почты или телефона в аккаунте на этом устройстве нет.";
        }
        try {
          if (!(await verifyPassword(password, account.salt, account.hash))) {
            return "Неверный пароль.";
          }
        } catch (e) {
          return e instanceof Error ? e.message : "Не получилось войти.";
        }
        set({ authed: true });
        return null;
      },

      logout: () => set({ authed: false }),
      deleteAccount: () => set({ account: null, authed: false }),
      updateProfile: (p) =>
        set((s) =>
          s.account
            ? {
                account: {
                  ...s.account,
                  name: p.name.trim(),
                  email: p.email.trim().toLowerCase(),
                  phone: p.phone,
                },
              }
            : s,
        ),
    }),
    {
      name: "momo-account",
      partialize: (s) => ({ account: s.account, authed: s.authed }),
    },
  ),
);
