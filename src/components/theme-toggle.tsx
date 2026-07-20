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
    if (next) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }
    // Cookie читает сервер при следующем рендере — тема применяется без вспышки.
    document.cookie = `momo-theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = dark ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <button
      onClick={toggle}
      aria-label={label}
      className={cn(
        "text-foreground transition-colors hover:text-signal",
        variant === "icon"
          ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-signal"
          : "flex w-full items-center gap-3 border-b border-border py-3.5 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      {dark ? <Moon size={16} /> : <Sun size={16} />}
      {variant === "row" && <span>{dark ? "Светлая тема" : "Тёмная тема"}</span>}
    </button>
  );
}
