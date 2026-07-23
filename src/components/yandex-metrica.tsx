"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

// Номер счётчика Яндекс.Метрики — выдан владельцем магазина.
const YM_ID = 110907002;

declare global {
  interface Window {
    ym?: (id: number, action: string, ...rest: unknown[]) => void;
  }
}

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
    window.ym?.(YM_ID, "hit", url);
  }, [pathname, searchParams]);

  return null;
}

/*
  Инлайн-загрузчик Метрики — как в панели Яндекса, только id вынесен в
  константу. Опции init оставлены ровно те, что были выбраны в счётчике:
  webvisor (запись сессий), clickmap (карта кликов), ecommerce (события
  корзины из dataLayer — пригодятся, когда начнём их отправлять).
  strategy="lazyOnload" — грузим последним, чтобы 86 КБ аналитики не
  конкурировали с отрисовкой страницы.

  nonce — метка запроса из proxy.ts: без неё политика безопасности не даст
  выполниться встроенному скрипту. Сам tag.js метки не получает и не должен:
  его вставляет уже доверенный загрузчик, а это разрешает 'strict-dynamic'.
*/
export function YandexMetrica({ nonce }: { nonce?: string }) {
  const loader = `
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}', 'ym');
    ym(${YM_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  `;

  return (
    <>
      <Script
        id="yandex-metrica"
        strategy="lazyOnload"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: loader }}
      />
      <Suspense fallback={null}>
        <MetrikaRouteTracker />
      </Suspense>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YM_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
