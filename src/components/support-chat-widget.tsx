"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Headphones, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useCustomer } from "@/components/customer-provider";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import type { PublicSupportConversation } from "@/lib/types";

const TOKEN_KEY = "momo-support-token";
const SEEN_KEY = "momo-support-seen";

type ChatResponse =
  | { ok: true; conversation: PublicSupportConversation | null }
  | { ok: false; error: string };

function visitorToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

function time(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SupportChatWidget() {
  const customer = useCustomer();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<PublicSupportConversation | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newReply, setNewReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customer || conversation) return;
    setName((current) => current || customer.name);
    setContact((current) => current || customer.email || customer.phone);
  }, [customer, conversation]);

  const applyConversation = useCallback(
    (next: PublicSupportConversation | null, viewed: boolean) => {
      setConversation(next);
      const latestAdmin = next?.messages.filter((item) => item.author === "admin").at(-1);
      if (!latestAdmin) return setNewReply(false);

      if (viewed) {
        localStorage.setItem(SEEN_KEY, latestAdmin.createdAt);
        setNewReply(false);
      } else {
        setNewReply(latestAdmin.createdAt > (localStorage.getItem(SEEN_KEY) ?? ""));
      }
    },
    [],
  );

  const loadConversation = useCallback(
    async (viewed: boolean, signal?: AbortSignal) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      try {
        const response = await fetch("/api/support/chat", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "load", token }),
          signal,
        });
        const body = (await response.json()) as ChatResponse;
        if (body.ok) applyConversation(body.conversation, viewed);
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError("Не удалось обновить диалог. Проверьте соединение.");
        }
      }
    },
    [applyConversation],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadConversation(false, controller.signal);
    return () => controller.abort();
  }, [loadConversation]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    void loadConversation(true, controller.signal).finally(() => setLoading(false));
    const timer = window.setInterval(() => void loadConversation(true), 5_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [open, loadConversation]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, conversation?.messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return setError("Напишите сообщение.");
    if (!conversation && !name.trim()) return setError("Укажите имя.");
    if (!conversation && !contact.trim()) return setError("Укажите телефон или email.");
    if (!conversation && !consent) {
      return setError("Нужно согласие на обработку персональных данных.");
    }

    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          token: visitorToken(),
          name: name.trim(),
          contact: contact.trim(),
          text: draft.trim(),
        }),
      });
      const body = (await response.json()) as ChatResponse;
      if (!body.ok) return setError(body.error);
      applyConversation(body.conversation, true);
      setDraft("");
      setConsent(false);
    } catch {
      setError("Не удалось отправить сообщение. Проверьте соединение.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Поддержка MOMO"
          className="fixed bottom-[5.25rem] right-3 z-[140] flex h-[min(620px,calc(100dvh-6.5rem))] w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:right-5"
        >
          <header className="relative overflow-hidden bg-[#141416] px-5 py-4 text-white">
            <div className="pointer-events-none absolute -right-9 -top-11 h-32 w-32 rounded-full border-[18px] border-[#ff5500]/20" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/55">
                  <span className="h-2 w-2 rounded-full bg-[#ff5500] shadow-[0_0_12px_#ff5500]" />
                  MOMO / Support line
                </p>
                <h2 className="mt-1.5 font-display text-base font-extrabold uppercase">
                  Поддержка
                </h2>
                <p className="mt-1 text-[0.72rem] text-white/60">
                  Отвечаем в рабочее время
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть поддержку"
                className="tap-44 relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-[#ff5500] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-bg px-4 py-4" aria-live="polite">
            {loading && !conversation ? (
              <div className="grid h-full place-items-center text-muted-foreground">
                <Loader2 className="animate-spin" size={22} />
              </div>
            ) : conversation ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[0.7rem] text-muted-foreground">
                  Диалог <b className="font-mono text-foreground">{conversation.id}</b>
                  {conversation.status === "closed" && (
                    <span className="mt-1 block">Диалог завершён. Новое сообщение откроет его снова.</span>
                  )}
                </div>
                {conversation.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${item.author === "visitor" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-xl px-3.5 py-2.5 text-[0.82rem] leading-relaxed shadow-sm ${
                        item.author === "visitor"
                          ? "rounded-br-sm bg-signal text-white"
                          : "rounded-bl-sm border border-border bg-surface text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{item.text}</p>
                      <p className={`mt-1 text-[0.58rem] ${item.author === "visitor" ? "text-white/65" : "text-muted-foreground"}`}>
                        {item.author === "visitor" ? "Вы" : "MOMO"} · {time(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div>
                <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-signal/10 text-signal">
                    <Headphones size={19} />
                  </span>
                  <div>
                    <p className="text-[0.84rem] font-semibold">Чем можем помочь?</p>
                    <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
                      Подбор компонентов, заказ, доставка или установка — напишите вопрос менеджеру.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="text-[0.68rem] font-medium text-muted-foreground">
                    Ваше имя
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={120}
                      autoComplete="name"
                      className="mt-1.5 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-signal sm:text-sm"
                    />
                  </label>
                  <label className="text-[0.68rem] font-medium text-muted-foreground">
                    Телефон или email
                    <input
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      maxLength={160}
                      autoComplete="email"
                      className="mt-1.5 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-signal sm:text-sm"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={send} className="border-t border-border bg-surface p-3.5">
            <label htmlFor="support-message" className="sr-only">Сообщение</label>
            <div className="flex items-end gap-2">
              <textarea
                id="support-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2_000}
                rows={2}
                placeholder={conversation ? "Напишите сообщение…" : "Ваш вопрос…"}
                className="min-h-[48px] flex-1 resize-none rounded-sm border border-input bg-bg px-3 py-2.5 text-base text-foreground outline-none focus:border-signal sm:text-sm"
              />
              <button
                type="submit"
                disabled={sending}
                aria-label="Отправить сообщение"
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-signal text-white transition hover:bg-[#ff6a1f] disabled:opacity-60"
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
            {!conversation && (
              <ConsentCheckbox
                id="support-consent"
                checked={consent}
                onChange={setConsent}
                className="mt-3"
              />
            )}
            {error && <p className="mt-2 text-[0.72rem] text-signal" role="alert">{error}</p>}
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Закрыть поддержку" : "Открыть поддержку"}
        className="fixed bottom-4 right-3 z-[130] inline-flex h-14 items-center gap-3 rounded-full border border-white/10 bg-[#141416] px-4 text-white shadow-[0_12px_34px_rgba(20,20,22,0.32)] transition hover:-translate-y-0.5 hover:border-[#ff5500]/60 sm:right-5"
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#ff5500]">
          <MessageCircle size={17} />
          {newReply && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#141416] bg-white" />
          )}
        </span>
        <span className="pr-1 text-sm font-semibold">Поддержка</span>
      </button>
    </>
  );
}
