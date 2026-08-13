"use client";
import { useActionState } from "react";
import { importCatalogData, type ActionState } from "@/app/admin/products/actions";

export function CatalogDataImport() {
  const [state, action, pending] = useActionState<ActionState, FormData>(importCatalogData, {});
  return <form action={action} className="max-w-[760px] rounded-xl border border-border bg-surface p-5">
    <h2 className="font-display text-base font-extrabold uppercase">Цены и остатки из CSV</h2>
    <p className="mt-2 text-[0.82rem] leading-relaxed text-muted-foreground">Первая строка: <code>slug;price;stock;inStock</code>. Вместо slug можно использовать <code>ozonSku</code> или <code>ozonOfferId</code>. Пустые значения не меняют товар.</p>
    <input type="file" name="file" accept=".csv,text/csv" required className="mt-4 block w-full text-[0.82rem] file:mr-3 file:rounded-sm file:border-0 file:bg-signal file:px-4 file:py-2 file:font-semibold file:text-white" />
    <button type="submit" disabled={pending} className="mt-4 rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white disabled:opacity-50">{pending ? "Проверяю и обновляю…" : "Импортировать"}</button>
    {state.ok && <p className="mt-4 rounded-sm border border-border px-4 py-3 text-[0.82rem]">{state.ok}</p>}{state.error && <p className="mt-4 rounded-sm border border-signal px-4 py-3 text-[0.82rem] text-signal">{state.error}</p>}
  </form>;
}
