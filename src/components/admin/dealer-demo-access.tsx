"use client";

import { useActionState } from "react";
import { openDemoDealerCabinet } from "@/app/admin/dealers/demo-action";

export function DealerDemoAccess() {
  const [state, action, pending] = useActionState(openDemoDealerCabinet, {});
  return <section className="mt-5 rounded-xl border border-border bg-surface p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-base font-bold">Демо-кабинет MOMO</h2><p className="mt-1 text-sm text-muted-foreground">Откройте существующий демо-аккаунт, чтобы посмотреть кабинет глазами дилера. Письмо и пароль не нужны.</p></div>
      <form action={action}><button disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-bold text-bg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50">{pending ? "Открываем…" : "Открыть демо-кабинет"}</button></form>
    </div>
    {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
  </section>;
}
