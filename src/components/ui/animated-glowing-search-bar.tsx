"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Анимированная светящаяся обёртка для строки поиска.
 *
 * Адаптация компонента «animated-glowing-search-bar» под MOMO:
 * вместо фиксированной фиолетовой плашки — переиспользуемая обёртка,
 * которая тянется на всю ширину, работает в светлой/тёмной теме и
 * подсвечивается фирменным сигнальным→жёлтым коническим градиентом.
 *
 * Механика: два слоя вращающегося конического градиента
 * (`.search-glow__spin`) — размытый ambient-ореол сзади и чёткая
 * «рамка», обрезанная скруглённым контейнером. Содержимое лежит поверх
 * на непрозрачном фоне, поэтому свечение видно только тонкой каймой.
 * Ореол усиливается при наведении и фокусе внутри.
 */
export function AnimatedGlowingSearch({
  children,
  className,
  rounded = "rounded-full",
}: {
  children: ReactNode;
  className?: string;
  /** Скругление — должно совпадать со скруглением вложенного поля. */
  rounded?: string;
}) {
  return (
    <div className={cn("group/glow relative", rounded, className)}>
      {/* Ambient-ореол: обрезан контейнером чуть больше плашки и размыт —
          мягкое свечение остаётся тонкой каймой вокруг поиска, не растекается */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-[3px] z-0 overflow-hidden opacity-45 blur-[5px] transition-opacity duration-500 group-hover/glow:opacity-75 group-focus-within/glow:opacity-100",
          rounded,
        )}
      >
        <span className="search-glow__spin" />
      </div>

      {/* Рамка: тот же градиент, обрезан контейнером до тонкой каймы */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-70 transition-opacity duration-500 group-hover/glow:opacity-100 group-focus-within/glow:opacity-100",
          rounded,
        )}
      >
        <span className="search-glow__spin" />
      </div>

      {/* Содержимое поверх свечения; непрозрачный фон делает подсветку каймой */}
      <div className={cn("relative z-[1] p-[1.5px]", rounded)}>{children}</div>
    </div>
  );
}

export default AnimatedGlowingSearch;
