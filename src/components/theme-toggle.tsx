"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  variant="icon"  — круглая кнопка в шапке (десктоп).
  variant="row"   — строка мобильного меню: на узком экране в шапке не хватает
                    места, кнопка переезжает в меню и там нуждается в подписи.
*/
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row";
  className?: string;
} = {}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);

    /*
      Переключение темы меняет значения переменных на :root, и вместе с ними
      перекрашивается всё дерево разом. При этом на body висит переход по
      background и color на 0.25s, а на десятках элементов — свои transition
      по border-color и цвету текста: браузер честно начинает анимировать
      каждый из них, и вместо мгновенной смены получается ощутимая просадка
      кадров, тем заметнее, чем длиннее страница.

      Поэтому на время подмены переходы глушим целиком (класс theme-switching),
      а снимаем его следующим кадром — когда новые цвета уже применены.
      Тема меняется мгновенно и без дёрганья.
    */
    const root = document.documentElement;
    root.classList.add("theme-switching");

    if (next) {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }

    // Cookie читает сервер при следующем рендере — тема применяется без вспышки.
    document.cookie = `momo-theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove("theme-switching"));
    });
  }

  const label = dark ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <button
      onClick={toggle}
      aria-label={label}
      className={cn(
        "text-foreground transition-colors hover:text-signal",
        variant === "icon"
          ? "tap-44 relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-signal"
          : "flex min-h-11 w-full items-center gap-3 border-b border-border py-3.5 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      {dark ? <Moon size={16} /> : <Sun size={16} />}
      {variant === "row" && <span>{dark ? "Светлая тема" : "Тёмная тема"}</span>}
    </button>
  );
}
