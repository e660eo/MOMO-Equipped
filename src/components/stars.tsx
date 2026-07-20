import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Пять звёзд с дробным заполнением: нижний ряд — приглушённый,
 * поверх него обрезанный по ширине ряд сигнальных звёзд.
 */
export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  const gap = Math.max(1, Math.round(size * 0.18));
  const total = size * 5 + gap * 4;

  const row = (filled: boolean) => (
    <span className="flex" style={{ gap, width: total }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={filled ? 0 : 1.6}
          className={cn("shrink-0", filled ? "fill-signal" : "text-border")}
        />
      ))}
    </span>
  );

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: total, height: size }}
      role="img"
      aria-label={`Рейтинг ${clamped.toFixed(1)} из 5`}
    >
      <span className="absolute inset-0">{row(false)}</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        {row(true)}
      </span>
    </span>
  );
}
