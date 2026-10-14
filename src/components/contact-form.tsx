"use client";
import { useRef, useState, type FormEvent } from "react";
import { ConsentCheckbox } from "./consent-checkbox";
import { CONSENT_VERSION } from "@/lib/privacy-documents";
export function ContactForm() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const token = useRef<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      token.current ??= crypto.randomUUID();
      const response = await fetch("/api/support/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", token: token.current, name: form.get("name"), contact: form.get("contact"), text: form.get("text"),
          consent: { accepted: form.get("consent") === "on", version: CONSENT_VERSION } }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Не удалось отправить обращение.");
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Проверьте соединение."); }
    finally { setPending(false); }
  }
  if (sent) return <p role="status" className="mt-6 text-base">Обращение принято. Менеджер свяжется с вами по указанному телефону или email.</p>;
  const field = "mt-1 w-full rounded-sm border border-input bg-bg px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-signal";
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-sm" htmlFor="ct-name">Имя<input id="ct-name" name="name" autoComplete="name" required minLength={2} maxLength={120} className={field} /></label>
    <label className="block text-sm" htmlFor="ct-contact">Телефон или email<input id="ct-contact" name="contact" required minLength={5} maxLength={160} className={field} /></label>
    <label className="block text-sm" htmlFor="ct-msg">Сообщение<textarea id="ct-msg" name="text" required maxLength={2000} rows={4} className={field} /></label>
    <ConsentCheckbox id="ct-consent" purpose="support" />
    {error && <p role="alert" className="text-sm text-[var(--signal-text)]">{error}</p>}
    <button disabled={pending} className="min-h-11 w-full rounded-sm bg-signal px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Отправляем…" : "Отправить"}</button>
  </form>;
}
