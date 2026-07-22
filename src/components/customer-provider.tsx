"use client";

import { createContext, useContext } from "react";
import type { PublicCustomer } from "@/lib/types";

/*
  Текущий покупатель для клиентских компонентов — шапки, модалки входа,
  корзины. Читается на сервере из подписанной куки и передаётся сюда:
  проверять сессию в браузере нельзя, её можно подделать.
*/

const CustomerContext = createContext<PublicCustomer | null>(null);

export function CustomerProvider({
  value,
  children,
}: {
  value: PublicCustomer | null;
  children: React.ReactNode;
}) {
  return (
    <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
  );
}

/** Вошедший покупатель или null. */
export function useCustomer(): PublicCustomer | null {
  return useContext(CustomerContext);
}
