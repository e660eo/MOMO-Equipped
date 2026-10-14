"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ANALYTICS_CONSENT_EVENT, METRIKA_GOAL_EVENT, YANDEX_METRIKA_ID, analyticsConsentGranted, analyticsPathAllowed } from "@/lib/metrika";

/** Параметры URL, номера заказов, кабинет и поля форм не передаём. */
export function YandexMetrica() {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);
  const [ready, setReady] = useState(false);
  const enabled = consented && analyticsPathAllowed(pathname);
  useEffect(() => {
    const update = () => setConsented(analyticsConsentGranted());
    update();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(ANALYTICS_CONSENT_EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  useEffect(() => {
    if (!enabled || !ready || !analyticsConsentGranted()) return;
    window.ym?.(YANDEX_METRIKA_ID, "init", { defer: true, webvisor: false, clickmap: false, trackLinks: false, accurateTrackBounce: false, triggerEvent: false, url: location.origin + "/", referrer: "" });
    window.ym?.(YANDEX_METRIKA_ID, "hit", location.origin + pathname, { title: "MOMO", referer: "" });
    const goal = (event: Event) => {
      const d = (event as CustomEvent<{ goal: string; params?: Record<string, unknown> }>).detail;
      if (analyticsConsentGranted() && d?.goal) window.ym?.(YANDEX_METRIKA_ID, "reachGoal", d.goal, d.params);
    };
    window.addEventListener(METRIKA_GOAL_EVENT, goal);
    return () => {
      window.removeEventListener(METRIKA_GOAL_EVENT, goal);
      window.ym?.(YANDEX_METRIKA_ID, "destruct");
    };
  }, [enabled, ready, pathname]);
  if (!enabled) return null;
  return <Script id="yandex-metrica" src="/yandex-metrica.js?v=20261014" strategy="afterInteractive" onReady={() => setReady(true)} />;
}
