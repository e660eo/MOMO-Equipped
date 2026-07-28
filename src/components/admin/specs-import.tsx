"use client";

import { useActionState } from "react";
import { importSpecs, type ActionState } from "@/app/admin/products/actions";

/*
  Разовый импорт характеристик из файла JSON. Формат — объект
  { "слаг-товара": ["Ключ - значение", …] }. Для каждого совпавшего товара
  поле «Характеристики и описание» заменяется; прежнее значение остаётся в
  резервной копии папки данных (writeJson кладёт копию в backups/).
*/
export function SpecsImport() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    importSpecs,
    {},
  );

  return (
    <form
      action={formAction}
      className="max-w-[680px] rounded-sm border border-border bg-surface p-5"
    >
      <h2 className="font-display text-base font-extrabold uppercase">
        Импорт характеристик
      </h2>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-muted-foreground">
        Загрузите файл JSON вида{" "}
        <code className="font-mono text-[0.8rem]">
          {'{ "слаг-товара": ["Ключ - значение", …] }'}
        </code>
        . У каждого совпавшего товара поле «Характеристики и описание» будет
        заменено на строки из файла. Прежние значения сохраняются в резервной
        копии — импорт можно откатить.
      </p>

      <input
        type="file"
        name="file"
        accept=".json,application/json"
        required
        className="mt-4 block w-full text-[0.82rem] file:mr-3 file:rounded-sm file:border-0 file:bg-signal file:px-4 file:py-2 file:text-[0.8rem] file:font-semibold file:text-white"
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95 disabled:opacity-60"
      >
        {pending ? "Применяю…" : "Загрузить и применить"}
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
