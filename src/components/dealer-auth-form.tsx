"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { activateDealer, loginDealer, type DealerAuthState } from "@/app/(shop)/dealer/actions";

export function DealerAuthForm({ mode, token = "" }: { mode: "login" | "activate"; token?: string }) {
  const action = mode === "login" ? loginDealer : activateDealer;
  const [state, formAction, pending] = useActionState<DealerAuthState, FormData>(action, {});
  const [visible, setVisible] = useState(false);
  const inputClass = "h-12 w-full rounded-lg border border-black/10 bg-white px-11 text-sm outline-none transition focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/15";

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      {mode === "activate" && <input type="hidden" name="token" value={token} />}
      {mode === "login" && (
        <label className="relative block">
          <Mail aria-hidden className="absolute left-4 top-3.5 text-black/35" size={19} />
          <span className="sr-only">Email</span>
          <input className={inputClass} type="email" name="email" autoComplete="username" placeholder="Email дилера" required />
        </label>
      )}
      <label className="relative block">
        <LockKeyhole aria-hidden className="absolute left-4 top-3.5 text-black/35" size={19} />
        <span className="sr-only">Пароль</span>
        <input className={`${inputClass} pr-12`} type={visible ? "text" : "password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Пароль" : "Новый пароль — от 10 символов"} minLength={mode === "activate" ? 10 : undefined} required />
        <button type="button" onClick={() => setVisible((value) => !value)} className="absolute right-3 top-2.5 rounded-md p-2 text-black/45 hover:text-black" aria-label={visible ? "Скрыть пароль" : "Показать пароль"}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
      </label>
      {mode === "activate" && (
        <label className="relative block">
          <LockKeyhole aria-hidden className="absolute left-4 top-3.5 text-black/35" size={19} />
          <span className="sr-only">Подтверждение пароля</span>
          <input className={inputClass} type={visible ? "text" : "password"} name="confirm" autoComplete="new-password" placeholder="Повторите пароль" minLength={10} required />
        </label>
      )}
      {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#ff5500] px-5 text-sm font-bold text-white shadow-lg shadow-[#ff5500]/20 transition hover:bg-[#e84d00] disabled:opacity-60">
        {pending && <LoaderCircle className="animate-spin" size={18} />}
        {mode === "login" ? "Войти в кабинет" : "Активировать кабинет"}
      </button>
    </form>
  );
}
