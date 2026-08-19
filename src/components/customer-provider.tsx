"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PublicCustomer } from "@/lib/types";
import type { PublicDealerSession } from "@/lib/viewer-session";

/*
  Текущий покупатель или дилер для клиентских компонентов — шапки, модалки
  входа, корзины. Загружается через закрытый API после гидратации, чтобы
  персональная cookie не переводила публичную витрину в динамический рендеринг.
*/

interface ViewerSession {
  customer: PublicCustomer | null;
  dealer: PublicDealerSession | null;
}

const EMPTY_SESSION: ViewerSession = { customer: null, dealer: null };
const CustomerContext = createContext<ViewerSession>(EMPTY_SESSION);
const CUSTOMER_CHANGED = "momo:customer-changed";

export function notifyCustomerSessionChanged(): void {
  window.dispatchEvent(new Event(CUSTOMER_CHANGED));
}

export function CustomerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<ViewerSession>(EMPTY_SESSION);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/customer/me", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) return setSession(EMPTY_SESSION);
      const body = (await response.json()) as ViewerSession;
      setSession({ customer: body.customer ?? null, dealer: body.dealer ?? null });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setSession(EMPTY_SESSION);
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
    <CustomerContext.Provider value={session}>{children}</CustomerContext.Provider>
  );
}

/** Вошедший покупатель или null. */
export function useCustomer(): PublicCustomer | null {
  return useContext(CustomerContext).customer;
}

/** Вошедший дилер или null. Пароль и email в браузер не передаются. */
export function useDealer(): PublicDealerSession | null {
  return useContext(CustomerContext).dealer;
}
