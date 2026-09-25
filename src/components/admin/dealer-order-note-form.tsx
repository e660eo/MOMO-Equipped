"use client";
import { useActionState } from "react";
import { saveDealerNoteAction } from "@/app/admin/dealers/orders/[id]/actions";
import type { DealerOrderNote } from "@/lib/dealer-order-notes";

export function DealerOrderNoteForm({ orderId, saved }: { orderId: string; saved?: DealerOrderNote }) {
  const [state, action, pending] = useActionState(saveDealerNoteAction, { revision: saved?.revision ?? 0 });
  return <form action={action} className="space-y-4">
    <h2 className="font-display text-xl font-extrabold uppercase">Рабочие заметки</h2>
    <p className="text-sm text-muted-foreground">Видны только в админке. Дилеру и в письма не передаются.</p>
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="revision" value={state.revision} />
    <label className="block text-sm font-semibold">О чём договорились<textarea name="note" defaultValue={saved?.note} maxLength={5000} rows={4} className="mt-2 block w-full rounded-lg border border-border bg-bg p-3 font-normal" /></label>
    <label className="block text-sm font-semibold">Следующий контакт<input type="date" name="followUpDate" defaultValue={saved?.followUpDate} className="mt-2 block min-h-11 max-w-full rounded-lg border border-border bg-bg px-3 font-normal" /></label>
    {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}{state.ok && <p role="status" className="text-sm">Заметка сохранена.</p>}
    <button disabled={pending} className="min-h-11 rounded-lg border border-border px-4 text-sm font-bold disabled:opacity-50">{pending ? "Сохраняем…" : "Сохранить заметку"}</button>
  </form>;
}
