"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ANALYTICS_CONSENT_EVENT, ANALYTICS_CONSENT_KEY, ANALYTICS_CONSENT_VERSION, analyticsChoice, YANDEX_METRIKA_ID } from "@/lib/metrika";
export function CookieNotice() {
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const first = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setShow(!analyticsChoice());
    const open = () => { opener.current = document.activeElement as HTMLElement; setShow(true); requestAnimationFrame(() => first.current?.focus()); };
    window.addEventListener("momo:cookie-settings", open);
    return () => window.removeEventListener("momo:cookie-settings", open);
  }, []);
  function choose(accepted: boolean) {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({ accepted, version: ANALYTICS_CONSENT_VERSION, at: new Date().toISOString() }));
    } catch { setError("Не удалось сохранить выбор. Аналитика остаётся выключенной."); return; }
    if (!accepted) {
      window.ym?.(YANDEX_METRIKA_ID, "destruct");
      // Удаляем только cookie Метрики, доступные текущему сайту.
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.split("=")[0].trim();
        if (!name.startsWith("_ym_")) continue;
        for (const domain of ["", "; domain=" + location.hostname, "; domain=." + location.hostname]) {
          document.cookie = name + "=; Max-Age=0; path=/" + domain;
        }
      }
    }
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
    setShow(false);
    setError("");
    opener.current?.focus();
  }
  if (!show) return null;
  return <section aria-label="Настройки файлов cookie" className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_5.25rem)] left-3 right-3 z-[100] max-h-[70dvh] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl sm:bottom-3 sm:right-auto sm:max-w-sm">
    <h2 className="text-base font-semibold">Cookie и аналитика</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Необходимые файлы обеспечивают вход и корзину. По вашему отдельному выбору Яндекс.Метрика получает данные о посещениях и действиях. Запись сеансов Вебвизора отключена. Отказ не мешает покупкам.</p>
    <Link href="/privacy#analytics" className="mt-2 inline-flex min-h-11 items-center text-sm underline">Данные, цели и сроки обработки</Link>
    <p className="text-sm text-muted-foreground">Выбор можно изменить через «Настройки cookie» внизу страницы.</p>
    {error && <p role="alert" className="mt-2 text-sm text-[var(--signal-text)]">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button ref={first} type="button" onClick={() => choose(true)} className="min-h-11 rounded-sm bg-signal px-4 text-sm font-semibold text-white">Разрешить аналитику</button>
      <button type="button" onClick={() => choose(false)} className="min-h-11 rounded-sm border border-border px-4 text-sm font-semibold">Только необходимые</button>
    </div>
  </section>;
}
