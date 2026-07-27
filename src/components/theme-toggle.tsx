"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

// Длительность раскрытия темы кругом (мс). Держим в паре с CSS-переменной.
const VT_DURATION = 500;

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
};
type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

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

  /*
    Мгновенная подмена цветов. Переключение темы меняет переменные на :root, и
    вместе с ними перекрашивается всё дерево разом; на body и десятках элементов
    висят transition по цвету — браузер честно анимировал бы каждый, отсюда
    просадка кадров. Поэтому на время подмены глушим переходы (theme-switching),
    а снимаем класс следующим кадром.

    Для анимации переключения это ещё и обязательное условие: снимок «нового»
    состояния для View Transitions берётся сразу после подмены — без мгновенной
    смены он поймал бы ещё старые цвета (CSS-переход не успел бы пройти).
  */
  function applyTheme(next: boolean) {
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

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next = !dark;
    const root = document.documentElement;
    const doc = document as DocumentWithVT;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Без поддержки View Transitions или при reduced-motion — как было, мгновенно.
    if (reduce || typeof doc.startViewTransition !== "function") {
      setDark(next);
      applyTheme(next);
      return;
    }

    // Центр расходящегося круга — центр нажатой кнопки; радиус — до дальнего угла.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    // Скоуп для CSS перехода: правила действуют только во время нашего переключения.
    root.dataset.themeVt = "active";
    root.style.setProperty("--theme-vt-duration", `${VT_DURATION}ms`);

    const transition = doc.startViewTransition(() => {
      // Синхронно: и иконка, и цвета попадают в «новый» снимок перехода.
      flushSync(() => {
        setDark(next);
        applyTheme(next);
      });
    });

    transition.finished.finally(() => {
      delete root.dataset.themeVt;
      root.style.removeProperty("--theme-vt-duration");
    });

    transition.ready
      .then(() => {
        // Сам круг рисуем через WAAPI — он не зависит от CSS-глушения переходов.
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: VT_DURATION,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          } as KeyframeAnimationOptions,
        );
      })
      .catch(() => {});
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
