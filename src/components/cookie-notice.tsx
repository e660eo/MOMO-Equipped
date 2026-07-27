"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/*
  Уведомление о файлах cookie (152-ФЗ). Сама политика cookie уже есть в
  «Политике конфиденциальности» (раздел 07) — здесь видимое согласие, которого
  ждут проверяющие и аудит-боты.

  Показываем только тем, кто ещё не нажал «Принять»: факт согласия храним в
  localStorage. На сервере не рисуем вовсе — иначе уже согласившийся увидел бы
  вспышку баннера до гидратации. Поэтому первый кадр пустой, а решение о показе
  принимается после монтирования.
*/
const KEY = "momo-cookie-consent";

export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // Приватный режим/недоступное хранилище — не навязываемся.
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Не удалось сохранить — просто закрываем на эту сессию.
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Уведомление об использовании файлов cookie"
      className="fixed bottom-3 left-3 right-[5.5rem] z-40 rounded-xl border border-border bg-surface p-4 shadow-[var(--card-shadow)] sm:right-auto sm:max-w-sm"
    >
      <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
        Сайт использует файлы cookie и сервис веб-аналитики, чтобы магазин
        работал корректно и становился удобнее. Продолжая пользоваться сайтом, вы
        соглашаетесь с этим — подробнее в{" "}
        <Link
          href="/privacy"
          className="text-[var(--signal-text)] underline underline-offset-2 transition-colors hover:no-underline"
        >
          политике конфиденциальности
        </Link>
        .
      </p>
      <button
        onClick={accept}
        className="mt-3 inline-flex rounded-sm bg-signal px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
      >
        Принять
      </button>
    </div>
  );
}
