"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/lib/compare-store";

/*
  Плавающая панель сравнения — появляется, когда выбран хотя бы один товар.
  Стоит по центру снизу: справа снизу кнопка WhatsApp, слева — баннер cookie.

  mounted-заслон: стор восстанавливается из localStorage уже в браузере,
  поэтому до монтирования рисуем пусто — так серверная и первая клиентская
  разметка совпадают и React не ругается на расхождение.
*/
export function CompareBar() {
  const [mounted, setMounted] = useState(false);
  const count = useCompare((s) => s.items.length);
  const clear = useCompare((s) => s.clear);

  useEffect(() => setMounted(true), []);
  if (!mounted || count < 1) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface p-1 pl-1.5 shadow-[var(--card-shadow)]">
      <Link
        href="/compare"
        className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95"
      >
        <Scale size={16} />
        Сравнить · {count}
      </Link>
      <button
        type="button"
        onClick={clear}
        aria-label="Очистить сравнение"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-signal"
      >
        <X size={16} />
      </button>
    </div>
  );
}
