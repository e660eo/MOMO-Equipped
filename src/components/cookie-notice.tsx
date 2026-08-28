"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ANALYTICS_CONSENT_EVENT, ANALYTICS_CONSENT_KEY } from "@/lib/metrika";

/*
  Уведомление о файлах cookie (152-ФЗ). Сама политика cookie уже есть в
  «Политике конфиденциальности» (раздел 07) — здесь видимое согласие, которого
  ждут проверяющие и аудит-боты.

  Показываем только тем, кто ещё не нажал «Принять»: факт согласия храним в
  localStorage. На сервере не рисуем вовсе — иначе уже согласившийся увидел бы
  вспышку баннера до гидратации. Поэтому первый кадр пустой, а решение о показе
  принимается после монтирования.
*/
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ANALYTICS_CONSENT_KEY)) setShow(true);
    } catch {
      // Приватный режим/недоступное хранилище — не навязываемся.
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    } catch {
      // Не удалось сохранить — просто закрываем на эту сессию.
    }
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
    setShow(false);
  }

  function decline() {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, "declined");
    } catch {}
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Уведомление об использовании файлов cookie"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_5.25rem)] left-3 right-3 z-50 max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_6.5rem)] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-[var(--card-shadow)] sm:bottom-3 sm:right-auto sm:max-h-none sm:max-w-sm"
    >
      <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
        Сайт использует файлы cookie и сервис веб-аналитики, чтобы магазин
        работал корректно и становился удобнее. Аналитика включится только с
        вашего согласия — подробнее в{" "}
        <Link
          href="/privacy"
          className="text-[var(--signal-text)] underline underline-offset-2 transition-colors hover:no-underline"
        >
          политике конфиденциальности
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={accept}
          className="inline-flex min-h-11 items-center rounded-sm bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Разрешить аналитику
        </button>
        <button
          onClick={decline}
          className="inline-flex min-h-11 items-center rounded-sm border border-border px-4 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          Только необходимые
        </button>
      </div>
    </div>
  );
}
