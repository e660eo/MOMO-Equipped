"use client";

import { useState } from "react";
import Link from "next/link";
import { resendEmailVerification } from "@/app/customer-actions";
import { notifyCustomerSessionChanged } from "./customer-provider";

export function EmailVerificationNotice({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  async function resend() {
    if (busy) return;
    if (Date.now() < retryAt) {
      setMessage(`Повторная отправка доступна через ${Math.ceil((retryAt - Date.now()) / 1000)} сек.`);
      return;
    }
    setBusy(true);
    try {
      const result = await resendEmailVerification();
      setMessage(result.ok ? "Письмо поставлено в очередь отправки. Проверьте входящие и спам. Повторная отправка доступна через минуту." : result.error ?? "Не удалось отправить письмо. Попробуйте позже.");
      if (result.ok) setRetryAt(Date.now() + 60_000);
    } catch { setMessage("Не удалось связаться с сервером. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }
  return <section className="my-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
    <p className="font-semibold">Перед онлайн-оплатой подтвердите почту</p>
    <p className="mt-2 break-words">Откройте ссылку в письме на {email}. Корзина сохранится.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={resend} className="min-h-11 rounded border border-border px-3 font-semibold disabled:opacity-50">{busy ? "Отправляем…" : "Отправить письмо ещё раз"}</button>
      <button type="button" onClick={notifyCustomerSessionChanged} className="min-h-11 underline">Я подтвердил почту — проверить</button>
      <Link href="/support" className="inline-flex min-h-11 items-center underline">Письмо не приходит</Link>
    </div>
    {message && <p role="status" className="mt-3">{message}</p>}
    <p className="mt-2 text-xs text-muted-foreground">Также можно выбрать заказ без онлайн-оплаты и согласовать покупку с менеджером.</p>
  </section>;
}
