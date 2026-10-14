"use client";
import { useState } from "react";

/** Внешний iframe загружается только после явного выбора посетителя. */
export function YandexMap({ query, zoom = 16, className = "", title = "Карта проезда" }: {
  query: string; zoom?: number; className?: string; title?: string;
}) {
  const [requested, setRequested] = useState(false);
  const src = `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(query)}&z=${zoom}`;
  return <div className={`overflow-hidden rounded-xl border border-border bg-tile ${className}`}>
    {requested ? <>
      <div className="flex justify-end p-2"><button type="button" onClick={() => setRequested(false)} className="min-h-11 px-3 text-sm underline">Скрыть карту</button></div>
      <iframe src={src} title={title} allowFullScreen referrerPolicy="no-referrer" className="block h-[360px] w-full border-0 sm:h-[420px]" />
    </> : <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-semibold">{query}</p>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">Карта — внешний сервис Яндекса. При загрузке он получит технические данные браузера и может использовать cookie и статистику.</p>
      <button type="button" onClick={() => setRequested(true)} className="min-h-11 rounded-sm bg-signal px-5 py-3 text-sm font-semibold text-white">Показать карту Яндекса</button>
    </div>}
  </div>;
}
