"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PublicCustomer } from "@/lib/types";

/*
  Текущий покупатель для клиентских компонентов — шапки, модалки входа,
  корзины. Загружается через закрытый API после гидратации, чтобы персональная
  cookie не переводила всю публичную витрину в динамический рендеринг.
*/

const CustomerContext = createContext<PublicCustomer | null>(null);
const CUSTOMER_CHANGED = "momo:customer-changed";

export function notifyCustomerSessionChanged(): void {
  window.dispatchEvent(new Event(CUSTOMER_CHANGED));
}

export function CustomerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [customer, setCustomer] = useState<PublicCustomer | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/customer/me", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) return setCustomer(null);
      const body = (await response.json()) as { customer: PublicCustomer | null };
      setCustomer(body.customer);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setCustomer(null);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const onChanged = () => void refresh();
    window.addEventListener(CUSTOMER_CHANGED, onChanged);
    return () => {
      controller.abort();
      window.removeEventListener(CUSTOMER_CHANGED, onChanged);
    };
  }, [refresh]);

  return (
    <CustomerContext.Provider value={customer}>{children}</CustomerContext.Provider>
  );
}

/** Вошедший покупатель или null. */
export function useCustomer(): PublicCustomer | null {
  return useContext(CustomerContext);
}
