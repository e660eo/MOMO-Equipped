"use client";

import { useActionState } from "react";
import { applyBundledSpecs, type ActionState } from "@/app/admin/products/actions";

/*
  Кнопка «Применить готовый набор» — заливает характеристики 59 профильных
  товаров, зашитые в код (profile-specs.json). Нужна, чтобы не скачивать и не
  загружать файл вручную: один клик — и таблицы появились.
*/
export function ApplyBundledSpecs() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    applyBundledSpecs,
    {},
  );

  return (
    <form
      action={formAction}
      className="max-w-[680px] rounded-sm border border-signal bg-surface p-5"
    >
      <h2 className="font-display text-base font-extrabold uppercase">
        Характеристики MOMO — 59 товаров
      </h2>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-muted-foreground">
        Готовый набор для профильных товаров (динамики, усилители, сабвуферы) уже
        в системе — скачивать ничего не нужно. Нажмите, и таблицы характеристик
        появятся у 59 товаров. Прежние описания сохраняются в резервной копии,
        откат возможен.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95 disabled:opacity-60"
      >
        {pending ? "Применяю…" : "Применить характеристики (59 товаров)"}
      </button>

      {state.ok && (
        <p className="mt-4 rounded-sm border border-border px-4 py-3 text-[0.85rem] leading-relaxed">
          {state.ok}
        </p>
      )}
      {state.error && (
        <p className="mt-4 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] leading-relaxed text-[var(--signal-text)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
