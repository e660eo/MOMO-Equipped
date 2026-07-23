"use client";

import { create } from "zustand";

/*
  Состояние окна «Личный кабинет» — открыто оно или нет. Больше здесь
  ничего нет и быть не должно.

  Раньше в этом файле жил аккаунт целиком: профиль и PBKDF2-хеш пароля
  в localStorage под ключом momo-account. Вход давно серверный (см.
  customer-auth.ts), register/login отсюда никто не звал, но у всех, кто
  регистрировался до переезда, хеш пароля с почтой и телефоном так и
  лежал в браузере — любому XSS на любой странице сайта хватило бы
  строчки, чтобы его забрать.

  Поэтому старые ключи чистим при первой же загрузке: и аккаунт, и
  локальную копию заказов (momo-orders), которую писала корзина и не
  читал никто. Данные покупателя есть на сервере, дубль в браузере —
  только лишний способ их потерять.
*/
if (typeof window !== "undefined") {
  for (const key of ["momo-account", "momo-orders"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // приватный режим или запрет хранилища — чистить нечего
    }
  }
}

interface AccountState {
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useAccount = create<AccountState>()((set) => ({
  modalOpen: false,
  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),
}));
