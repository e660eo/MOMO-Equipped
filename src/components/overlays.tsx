"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "@/lib/account-store";

/* Окно входа подгружается по требованию и тихо прогревается в простое. */

const AuthModal = dynamic(
  () => import("./auth-modal").then((m) => m.AuthModal),
  { ssr: false },
);

export function Overlays() {
  const authOpen = useAccount((s) => s.modalOpen);

  // Один раз смонтировали — держим: закрытие не выгружает набранные поля.
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (authOpen) setAuthReady(true);
  }, [authOpen]);

  // Тихая предзагрузка в простое — чтобы первое открытие было мгновенным
  useEffect(() => {
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 2000));
    const id = idle(() => {
      setAuthReady(true);
    });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  return <>{authReady && <AuthModal />}</>;
}
