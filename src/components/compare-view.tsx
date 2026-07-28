"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Scale } from "lucide-react";
import { useCompare } from "@/lib/compare-store";
import { fullSpecs } from "@/lib/specs";
import { formatPrice, productImageUrl, isInStock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const stockLabel = (p: Product) => {
  const s = isInStock(p);
  return s === true ? "В наличии" : s === false ? "Под заказ" : "Уточняйте";
};

/* Строка таблицы: подпись слева (липкая при прокрутке) + значения по колонкам. */
function Row({
  label,
  values,
  striped,
}: {
  label: string;
  values: string[];
  striped?: boolean;
}) {
  // Строку, где у всех одно и то же, приглушаем — взгляд цепляется за отличия.
  const differ = new Set(values.map((v) => v.toLowerCase())).size > 1;
  return (
    <tr className={cn("border-b border-border", striped && "bg-surface/50")}>
      <th
        scope="row"
        className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-bg py-2.5 pr-3 pl-1 text-left align-top font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </th>
      {values.map((v, i) => (
        <td
          key={i}
          className={cn(
            "px-3 py-2.5 align-top text-[0.85rem]",
            differ ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

export function CompareView() {
  const [mounted, setMounted] = useState(false);
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);

  useEffect(() => setMounted(true), []);

  /*
    Характеристики каждого товара сводим в карту «метка → значение», а затем
    собираем объединённый список меток в порядке первого появления: сначала
    ключевые цифры (stats), потом строки таблицы. Так одинаковые характеристики
    встают в один ряд, а отсутствующие показываются прочерком.
  */
  const cols = items.map((p) => {
    const fs = fullSpecs(p.title, p.description);
    const m = new Map<string, string>();
    for (const s of [...fs.stats, ...fs.rows]) {
      if (s.value && !m.has(s.label)) m.set(s.label, s.value);
    }
    return m;
  });
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const m of cols) {
    for (const label of m.keys()) {
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold uppercase">
          Сравнение
        </h1>
        {mounted && items.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="rounded-sm border border-border px-4 py-2 text-sm font-medium transition-all hover:border-signal hover:text-signal active:scale-95"
          >
            Очистить
          </button>
        )}
      </div>

      {!mounted ? null : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-border bg-surface p-12 text-center">
          <Scale size={28} className="text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-semibold">
            Пока нечего сравнивать
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted-foreground">
            Откройте каталог и нажмите «Сравнить» на карточках товаров — здесь
            появится таблица характеристик бок о бок.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95"
          >
            В каталог
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[120px] min-w-[120px] bg-bg" />
                {items.map((p) => (
                  <th
                    key={p.slug}
                    className="min-w-[160px] border-b border-border p-3 text-left align-top font-normal"
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => remove(p.slug)}
                        aria-label={`Убрать «${p.title}» из сравнения`}
                        className="absolute -right-1 -top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-signal hover:text-signal"
                      >
                        <X size={13} />
                      </button>
                      <Link href={`/product/${p.slug}`} className="group block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={productImageUrl(p.image)}
                          alt=""
                          className="mx-auto h-24 w-24 rounded-sm border border-border bg-tile object-contain"
                        />
                        <span className="mt-2 block text-[0.82rem] font-medium leading-snug transition-colors group-hover:text-signal">
                          {p.title}
                        </span>
                      </Link>
                      <span className="mt-1 block font-display text-[0.98rem] font-semibold">
                        {formatPrice(p.price)}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Бренд" values={items.map((p) => p.brand)} striped />
              <Row label="Наличие" values={items.map(stockLabel)} />
              {labels.map((label, ri) => (
                <Row
                  key={label}
                  label={label}
                  values={cols.map((m) => m.get(label) ?? "—")}
                  striped={ri % 2 === 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
