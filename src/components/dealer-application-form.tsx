"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { PhoneInput } from "./phone-input";
import { submitDealerApplication, type DealerApplicationState } from "@/app/(shop)/become-dealer/actions";

const field = "w-full rounded-sm border border-input bg-bg px-3 py-3 text-sm outline-none transition focus:border-signal";

export function DealerApplicationForm() {
  const [state, action, pending] = useActionState<DealerApplicationState, FormData>(submitDealerApplication, {});
  const [phone, setPhone] = useState("");

  if (state.ok) return (
    <div className="rounded-xl border border-green-600/30 bg-green-600/5 p-6" role="status">
      <p className="font-display text-lg font-bold">Заявка отправлена</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.ok}</p>
      <Link href="/dealer/login" className="mt-5 inline-flex text-sm font-semibold text-signal hover:underline">Уже есть доступ? Войти в кабинет →</Link>
    </div>
  );

  return (
    <form action={action} className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-[0.78rem] font-medium sm:col-span-2">Компания или студия<input name="company" required maxLength={160} autoComplete="organization" className={`${field} mt-1.5`} /></label>
        <label className="text-[0.78rem] font-medium">Город<input name="city" required maxLength={100} autoComplete="address-level2" className={`${field} mt-1.5`} /></label>
        <label className="text-[0.78rem] font-medium">Формат работы<select name="businessType" required defaultValue="" className={`${field} mt-1.5`}><option value="" disabled>Выберите</option><option value="store">Магазин</option><option value="install">Студия установки</option><option value="online">Интернет-магазин</option><option value="mixed">Магазин + установка</option></select></label>
        <label className="text-[0.78rem] font-medium">Контактное лицо<input name="contactName" required maxLength={120} autoComplete="name" className={`${field} mt-1.5`} /></label>
        <label className="text-[0.78rem] font-medium">Телефон<PhoneInput value={phone} onChange={setPhone} required className={`${field} mt-1.5`} /><input type="hidden" name="phone" value={phone} /></label>
        <label className="text-[0.78rem] font-medium">Email<input name="email" type="email" required maxLength={160} autoComplete="email" className={`${field} mt-1.5`} /></label>
        <label className="text-[0.78rem] font-medium">Сайт или соцсеть <span className="font-normal text-muted-foreground">(необязательно)</span><input name="website" type="url" maxLength={240} placeholder="https://" className={`${field} mt-1.5`} /></label>
        <label className="text-[0.78rem] font-medium sm:col-span-2">Что важно обсудить<textarea name="comment" rows={4} maxLength={1500} placeholder="Город, текущий ассортимент, формат точки, вопросы по сотрудничеству" className={`${field} mt-1.5 resize-y`} /></label>
      </div>
      <label className="mt-5 flex items-start gap-2.5 text-[0.76rem] leading-relaxed text-muted-foreground"><input type="checkbox" name="consent" required className="mt-0.5 accent-[#ff5500]" /><span>Согласен на обработку персональных данных и принимаю <Link href="/privacy" target="_blank" className="text-signal underline underline-offset-2">политику конфиденциальности</Link>.</span></label>
      {state.error && <p className="mt-4 rounded-sm border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-[var(--signal-text)]" role="alert">{state.error}</p>}
      <button disabled={pending} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-signal px-6 text-sm font-semibold text-white transition hover:bg-[#ff6a1f] disabled:opacity-60">{pending ? "Отправляем…" : "Обсудить дилерство"}</button>
      <p className="mt-3 text-center text-[0.72rem] text-muted-foreground">Закрытые цены публикуются только в кабинете после одобрения заявки.</p>
    </form>
  );
}
