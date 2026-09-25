"use client";

import { useEffect } from "react";
import { useCart, type CartItem } from "@/lib/cart-store";

/** Serialize requests; keep pending edits on disk until acknowledged by the server. */
export function CartAccountSync({ customerId }: { customerId: string | null | undefined }) {
  useEffect(() => {
    // undefined means authentication is still loading or temporarily unavailable.
    if (customerId === undefined) return;
    const store = useCart;
    store.getState().bindAccount(customerId);
    if (!customerId) return;
    let stopped = false;
    let running = false;
    let controller: AbortController | undefined;

    async function sync() {
      if (stopped || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        do {
          const state = store.getState();
          if (state.ownerId !== customerId) return;
          const mutation = state.pending[0];
          controller = new AbortController();
          const timeout = window.setTimeout(() => controller?.abort(), 15_000);
          let response: Response;
          try {
            response = await fetch("/api/customer/cart", {
              method: mutation ? "POST" : "GET",
              cache: "no-store", credentials: "same-origin", signal: controller.signal,
              ...(mutation ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId, mutation }), keepalive: true,
              } : {}),
            });
          } finally { window.clearTimeout(timeout); }
          if (response.status === 401 || response.status === 409) {
            window.dispatchEvent(new Event("momo:customer-changed"));
          }
          if (!response.ok) throw new Error("Cart sync failed");
          const result = await response.json() as { customerId: string; items: CartItem[] };
          if (stopped) return;
          if (result.customerId !== customerId || !Array.isArray(result.items)) throw new Error("Account changed");
          store.getState().acceptRemote(customerId!, result.items, mutation?.id);
        } while (!stopped && store.getState().pending.length > 0);
      } catch {
        if (!stopped && store.getState().ownerId === customerId) store.setState({ syncStatus: "error" });
      } finally { running = false; }
    }

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.pending !== previous.pending && state.pending.length) void sync();
    });
    const refresh = () => void sync();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 15_000);
    void sync();
    return () => {
      stopped = true;
      controller?.abort();
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [customerId]);
  return null;
}
