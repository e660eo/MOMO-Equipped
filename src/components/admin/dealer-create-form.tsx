"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Copy, LoaderCircle, MailCheck, MailWarning } from "lucide-react";
import { createDealerAdmin, type CreateDealerState } from "@/app/admin/dealers/actions";

export type DealerCreateInitial = { applicationId?: string; name?: string; city?: string; phone?: string; contactName?: string; loginEmail?: string; website?: string };

export function DealerCreateForm({ initial = {} }: { initial?: DealerCreateInitial }) {
  const [state, action, pending] = useActionState<CreateDealerState, FormData>(createDealerAdmin, {});
  const [copied, setCopied] = useState(false);
  const input = "h-11 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-signal";
  return <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
    {initial.applicationId && <input type="hidden" name="applicationId" value={initial.applicationId} />}
    <label className="grid gap-1 text-xs text-muted-foreground">Компания<input className={input} name="name" defaultValue={initial.name} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Город<input className={input} name="city" defaultValue={initial.city} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">Публичный адрес<input className={input} name="address" required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Публичный телефон<input className={input} name="phone" defaultValue={initial.phone} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Публичный email<input className={input} type="email" name="publicEmail" defaultValue={initial.loginEmail} /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Контактное лицо<input className={input} name="contactName" defaultValue={initial.contactName} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Email для входа<input className={input} type="email" name="loginEmail" defaultValue={initial.loginEmail} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Сайт<input className={input} type="url" name="website" defaultValue={initial.website} placeholder="https://" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Режим работы<input className={input} name="hours" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Широта<input className={input} inputMode="decimal" name="latitude" placeholder="42.9849" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Долгота<input className={input} inputMode="decimal" name="longitude" placeholder="47.5047" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Ценовой уровень<select className={input} name="priceTier" defaultValue="dealer" required><option value="dealer">Дилерский прайс</option><option value="dagestan">Дагестанский прайс</option><option value="wholesale">Оптовый прайс</option></select></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Резервная скидка от РРЦ, %<input className={input} type="number" min="0" max="80" step="0.1" name="discountPercent" defaultValue="0" required /><span className="text-[10px] leading-4">Применится только к товарам, которых нет в выбранном прайсе.</span></label>
    <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="authorizedInstallation" /> Авторизованная установка</label>
    {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>}
    {state.ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"><p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 size={17} /> Дилер создан</p><p className="mt-2 flex items-center gap-2 text-xs text-emerald-700">{state.mailSent ? <><MailCheck size={15} /> Ссылка отправлена на email.</> : <><MailWarning size={15} /> Почта не отправилась — передайте ссылку вручную.</>}</p>{state.inviteUrl && <div className="mt-3 flex gap-2"><input readOnly value={state.inviteUrl} className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-xs" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(state.inviteUrl!); setCopied(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"><Copy size={14} /> {copied ? "Скопировано" : "Копировать"}</button></div>}</div>}
    <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 text-sm font-bold text-white sm:col-span-2 sm:justify-self-start">{pending && <LoaderCircle className="animate-spin" size={17} />} Создать и отправить доступ</button>
  </form>;
}
