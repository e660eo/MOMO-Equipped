"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PublicCustomer } from "@/lib/types";
import type { PublicDealerSession } from "@/lib/viewer-session";
import { CartAccountSync } from "./cart-account-sync";

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
  const [cartCustomerId, setCartCustomerId] = useState<string | null | undefined>(undefined);
  const requestId = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const id = ++requestId.current;
    try {
      const response = await fetch("/api/customer/me", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) return;
      const body = (await response.json()) as ViewerSession;
      if (id !== requestId.current || signal?.aborted) return;
      setSession({ customer: body.customer ?? null, dealer: body.dealer ?? null });
      setCartCustomerId(body.customer?.id ?? null);
    } catch { /* A network failure is not an authoritative logout. */ }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const onChanged = () => void refresh(controller.signal);
    window.addEventListener(CUSTOMER_CHANGED, onChanged);
    window.addEventListener("focus", onChanged);
    window.addEventListener("online", onChanged);
    return () => {
      controller.abort();
      window.removeEventListener(CUSTOMER_CHANGED, onChanged);
      window.removeEventListener("focus", onChanged);
      window.removeEventListener("online", onChanged);
    };
  }, [refresh]);

  return (
    <CustomerContext.Provider value={session}>
      <CartAccountSync customerId={cartCustomerId} />
      {children}
    </CustomerContext.Provider>
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
