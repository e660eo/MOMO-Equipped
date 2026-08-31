"use client";

import { useActionState } from "react";
import {
  saveOzonSellerAccess,
  type ActionState,
} from "@/app/admin/settings/actions";

const field =
  "mt-1.5 min-h-11 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/25";

export function OzonStockCredentialsForm({
  configured,
  canSave,
}: {
  configured: boolean;
  canSave: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveOzonSellerAccess,
    {},
  );

  return (
    <form action={formAction} className="mt-4 grid gap-4 rounded-lg border border-border p-4">
      <div>
        <p className="text-[0.85rem] font-semibold">
          {configured ? "Заменить ключ Seller API" : "Подключить Seller API"}
        </p>
        <p className="mt-1 text-[0.76rem] leading-relaxed text-muted-foreground">
          Ключ шифруется до записи на диск. После сохранения он больше не показывается в панели и не попадает в журнал действий.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ozonApiKey" className="block text-[0.78rem] font-medium">
            1. API Key
          </label>
          <input
            id="ozonApiKey"
            name="ozonApiKey"
            type="password"
            required
            autoComplete="new-password"
            spellCheck={false}
            placeholder="Вставьте скопированный ключ"
            className={`${field} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="ozonClientId" className="block text-[0.78rem] font-medium">
            2. Client ID
          </label>
          <input
            id="ozonClientId"
            name="ozonClientId"
            required
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="Например, 123456"
            className={field}
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.82rem] text-[var(--signal-text)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !canSave}
        className="min-h-11 w-fit rounded-sm bg-signal px-5 py-2.5 text-[0.82rem] font-semibold text-white transition-colors hover:bg-[#ff6a1f] focus:outline-none focus:ring-2 focus:ring-signal/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Шифрую и сохраняю…" : "Сохранить ключи Ozon"}
      </button>
      {!canSave && (
        <p role="alert" className="text-[0.76rem] text-[var(--signal-text)]">
          На сервере пока не настроено шифрование секретов. Обратитесь к разработчику.
        </p>
      )}
    </form>
  );
}
