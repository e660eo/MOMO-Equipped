"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  METRIKA_GOAL_EVENT,
  YANDEX_METRIKA_ID,
  analyticsConsentGranted,
} from "@/lib/metrika";

/*
  init засчитывает первый просмотр сам. Дальше сайт работает как SPA: переходы
  между страницами идут без перезагрузки, и Метрика их не видит — без ручного
  hit в статистике был бы только вход, весь путь покупателя терялся бы.
  Поэтому на каждую смену маршрута шлём hit, пропуская самый первый рендер,
  чтобы не задвоить стартовую страницу.

  useSearchParams обязывает обернуть чтение в Suspense, иначе сборка падает —
  поэтому трекер вынесен отдельным компонентом под <Suspense/> ниже. Параметры
  запроса в URL нужны: категория и поиск в каталоге живут именно в них
  (/catalog?category=…), без них все фильтры слились бы в один адрес.
*/
function MetrikaRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const qs = searchParams.toString();
    const url = location.origin + pathname + (qs ? `?${qs}` : "");
    window.ym?.(YANDEX_METRIKA_ID, "hit", url);
  }, [pathname, searchParams]);

  return null;
}

/*
  Загрузчик Метрики вынесен в public/yandex-metrica.js, чтобы он кэшировался
  как обычный файл. Опции init оставлены ровно те, что были выбраны в счётчике:
  webvisor (запись сессий), clickmap (карта кликов), ecommerce (события
  корзины из dataLayer — пригодятся, когда начнём их отправлять).
  afterInteractive используется после согласия: компонент может появиться уже
  после window.load, но скрипт всё равно должен быть вставлен в документ.

  Внешние адреса явно разрешены в CSP.
*/
export function YandexMetrica() {
  const [enabled, setEnabled] = useState(false);
  const pending = useRef<Array<{ goal: string; params?: Record<string, unknown> }>>([]);

  useEffect(() => {
    setEnabled(analyticsConsentGranted());
    const onConsent = () => setEnabled(analyticsConsentGranted());
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onGoal = (event: Event) => {
      const detail = (event as CustomEvent<{ goal: string; params?: Record<string, unknown> }>).detail;
      if (!detail?.goal) return;
      if (window.ym) window.ym(YANDEX_METRIKA_ID, "reachGoal", detail.goal, detail.params);
      else pending.current.push(detail);
    };
    window.addEventListener(METRIKA_GOAL_EVENT, onGoal);
    return () => window.removeEventListener(METRIKA_GOAL_EVENT, onGoal);
  }, [enabled]);

  if (!enabled) return null;

  const flush = () => {
    if (!window.ym) return;
    for (const item of pending.current.splice(0)) {
      window.ym(YANDEX_METRIKA_ID, "reachGoal", item.goal, item.params);
    }
  };

  return (
    <>
      <Script
        id="yandex-metrica"
        src="/yandex-metrica.js"
        // Компонент появляется только после согласия, то есть зачастую уже
        // после window.load. afterInteractive гарантированно вставляет скрипт
        // и при таком позднем условном рендере.
        strategy="afterInteractive"
        onReady={flush}
      />
      <Suspense fallback={null}>
        <MetrikaRouteTracker />
      </Suspense>
    </>
  );
}
