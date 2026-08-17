import Link from "next/link";
import { CheckCircle2, Clock3, Mail, MessageCircle, Phone, RotateCw } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import {
  getSupportConversation,
  getSupportConversations,
  isSupportConversationWaiting,
} from "@/lib/support-conversations";
import { changeSupportConversationStatus, replySupportConversation } from "./actions";

export const dynamic = "force-dynamic";

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function contactHref(contact: string): string {
  return contact.includes("@") ? `mailto:${contact}` : `tel:${contact.replace(/[^+\d]/g, "")}`;
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const conversations = getSupportConversations();
  const selected =
    (params.chat ? getSupportConversation(params.chat) : undefined) ??
    conversations.find(isSupportConversationWaiting) ??
    conversations[0];
  const waiting = conversations.filter(isSupportConversationWaiting).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-signal">
            Диалоги с сайтом
          </p>
          <h1 className="mt-1 font-display text-xl font-extrabold uppercase">Поддержка клиентов</h1>
          <p className="mt-1 text-[0.82rem] text-muted-foreground">
            {waiting ? `${waiting} обращений ожидают ответа` : "Все обращения обработаны"}
          </p>
        </div>
        <Link
          href={selected ? `/admin/messages?chat=${encodeURIComponent(selected.id)}` : "/admin/messages"}
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-[0.8rem] font-semibold hover:border-signal hover:text-signal"
        >
          <RotateCw size={15} /> Обновить
        </Link>
      </div>

      {!conversations.length ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-10 text-center">
          <MessageCircle className="mx-auto text-signal" size={30} />
          <p className="mt-4 font-display text-base font-bold uppercase">Обращений пока нет</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Новые сообщения из виджета на сайте появятся здесь.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid min-h-[650px] overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[340px_1fr]">
          <aside className="border-b border-border lg:border-b-0 lg:border-r">
            <div className="border-b border-border px-4 py-3 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
              Диалоги · {conversations.length}
            </div>
            <div className="max-h-[330px] overflow-y-auto lg:max-h-[610px]">
              {conversations.map((conversation) => {
                const active = selected?.id === conversation.id;
                const awaits = isSupportConversationWaiting(conversation);
                const last = conversation.messages.at(-1);
                return (
                  <Link
                    key={conversation.id}
                    href={`/admin/messages?chat=${encodeURIComponent(conversation.id)}`}
                    className={`block border-b border-border px-4 py-4 transition-colors ${
                      active ? "bg-signal/8" : "hover:bg-bg"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <b className="truncate text-[0.86rem]">{conversation.name}</b>
                      {awaits ? (
                        <span className="shrink-0 rounded-full bg-signal px-2 py-0.5 text-[0.62rem] font-semibold text-white">
                          ждёт ответа
                        </span>
                      ) : conversation.status === "closed" ? (
                        <CheckCircle2 size={15} className="shrink-0 text-green-600" />
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-[0.74rem] text-muted-foreground">
                      {last?.author === "admin" ? "Вы: " : ""}{last?.text}
                    </span>
                    <span className="mt-2 flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground">
                      <Clock3 size={11} /> {dateTime(conversation.updatedAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </aside>

          {selected && (
            <section className="flex min-w-0 flex-col">
              <header className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold">{selected.name}</h2>
                    <a
                      href={contactHref(selected.contact)}
                      className="mt-1 inline-flex items-center gap-1.5 text-[0.78rem] text-signal hover:underline"
                    >
                      {selected.contact.includes("@") ? <Mail size={13} /> : <Phone size={13} />}
                      {selected.contact}
                    </a>
                    <p className="mt-1 font-mono text-[0.62rem] text-muted-foreground">
                      {selected.id}{selected.customerId ? " · зарегистрированный клиент" : " · гость"}
                    </p>
                  </div>
                  <form action={changeSupportConversationStatus}>
                    <input type="hidden" name="id" value={selected.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={selected.status === "closed" ? "open" : "closed"}
                    />
                    <button className="rounded-sm border border-border px-3 py-2 text-[0.75rem] font-semibold hover:border-signal hover:text-signal">
                      {selected.status === "closed" ? "Открыть диалог" : "Закрыть диалог"}
                    </button>
                  </form>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-bg/60 px-4 py-5 sm:px-6">
                {selected.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.author === "admin" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[84%] rounded-xl px-4 py-3 text-[0.84rem] leading-relaxed shadow-sm ${
                        message.author === "admin"
                          ? "rounded-br-sm bg-[#17171a] text-white"
                          : "rounded-bl-sm border border-border bg-surface"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      <p className={`mt-1.5 font-mono text-[0.58rem] ${message.author === "admin" ? "text-white/50" : "text-muted-foreground"}`}>
                        {message.author === "admin" ? "MOMO" : selected.name} · {dateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form action={replySupportConversation} className="border-t border-border p-4">
                <input type="hidden" name="id" value={selected.id} />
                <label htmlFor="support-reply" className="sr-only">Ответ клиенту</label>
                <div className="flex items-end gap-2">
                  <textarea
                    id="support-reply"
                    name="text"
                    required
                    maxLength={2_000}
                    rows={3}
                    placeholder="Напишите ответ клиенту…"
                    className="min-h-20 flex-1 resize-y rounded-sm border border-input bg-bg px-3.5 py-3 text-sm outline-none focus:border-signal"
                  />
                  <button className="min-h-20 rounded-sm bg-signal px-5 text-sm font-semibold text-white transition hover:bg-[#ff6a1f]">
                    Ответить
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
