"use client";

import { Scale } from "lucide-react";
import { useCompare } from "@/lib/compare-store";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

/*
  Переключатель «Сравнить» на карточке и странице товара. Подписан на стор
  выборочно (только этот slug), поэтому нажатие на одной карточке не
  перерисовывает остальные.
*/
export function CompareToggle({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const active = useCompare((s) => s.items.some((i) => i.slug === product.slug));
  const toggle = useCompare((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={() => toggle(product)}
      aria-pressed={active}
      title={active ? "Убрать из сравнения" : "Добавить к сравнению"}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-sm border px-3 py-2 font-mono text-[0.7rem] uppercase tracking-wide transition duration-150 active:scale-95",
        active
          ? "border-signal bg-signal/10 text-signal"
          : "border-border text-muted-foreground hover:border-signal hover:text-signal",
        className,
      )}
    >
      <Scale size={14} />
      {active ? "В сравнении" : "Сравнить"}
    </button>
  );
}
