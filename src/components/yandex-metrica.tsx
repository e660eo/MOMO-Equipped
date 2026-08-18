"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { YANDEX_METRIKA_ID } from "@/lib/metrika";

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
  strategy="lazyOnload" — грузим последним, чтобы 86 КБ аналитики не
  конкурировали с отрисовкой страницы.

  Внешние адреса явно разрешены в CSP.
*/
export function YandexMetrica() {
  return (
    <>
      <Script
        id="yandex-metrica"
        src="/yandex-metrica.js"
        strategy="lazyOnload"
      />
      <Suspense fallback={null}>
        <MetrikaRouteTracker />
      </Suspense>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
