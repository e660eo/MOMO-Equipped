"use client";

import { useActionState } from "react";
import { sendTestMail, type MailTestState } from "@/app/admin/settings/actions";

/*
  Состояние почтовых уведомлений о заказах.

  Настройки ящика лежат в окружении сервера и из панели не правятся — пароль
  почты не место хранить рядом с каталогом. Но видеть, работает ли отправка,
  владелец должен: неверный пароль иначе всплывёт только на потерянном заказе.
*/

export interface MailStatus {
  configured: boolean;
  to: string[];
  host: string;
  /** Итог последней отправки за время работы сервера. */
  last: { ok: boolean; at: string; detail: string } | null;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MailStatusPanel({ status }: { status: MailStatus }) {
  const [state, formAction, pending] = useActionState<MailTestState, FormData>(
    sendTestMail,
    {},
  );

  return (
    <section className="max-w-[680px] rounded-sm border border-border bg-surface p-5">
      <h2 className="font-display text-base font-extrabold uppercase">
        Письма о заказах
      </h2>

      {status.configured ? (
        <>
          <p className="mt-2 text-[0.85rem] leading-relaxed">
            Каждый новый заказ уходит письмом на{" "}
            <b className="font-semibold">{status.to.join(", ")}</b>. Отправляет{" "}
            <span className="font-mono text-[0.8rem]">{status.host}</span>.
          </p>
          <p className="mt-1.5 text-[0.78rem] text-muted-foreground">
            Заказ не зависит от почты: он сохраняется в разделе «Заказы» в любом
            случае, письмо — чтобы не заглядывать туда постоянно.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[0.85rem] leading-relaxed">
          Ящик не подключён — заказы видно только здесь, в разделе «Заказы».
          Чтобы они приходили на почту, на сервере в файле{" "}
          <code className="font-mono text-[0.8rem]">.env.local</code> нужны
          переменные <code className="font-mono text-[0.8rem]">SMTP_USER</code> и{" "}
          <code className="font-mono text-[0.8rem]">SMTP_PASS</code>. Пошагово —
          в разделе «Письма о заказах» файла DEPLOY.md.
        </p>
      )}

      {status.last && (
        <p
          className={`mt-3 text-[0.78rem] leading-relaxed ${
            status.last.ok ? "text-muted-foreground" : "text-[var(--signal-text)]"
          }`}
        >
          Последняя отправка {when(status.last.at)} —{" "}
          {status.last.ok ? "успешно" : `ошибка: ${status.last.detail}`}
        </p>
      )}

      <form action={formAction} className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border border-border px-4 py-2 text-[0.82rem] font-medium transition-all hover:border-signal hover:text-signal active:scale-95 disabled:opacity-60"
        >
          {pending ? "Отправляю…" : "Отправить пробное письмо"}
        </button>
      </form>

      {state.ok && (
        <p className="mt-2.5 text-[0.82rem] text-muted-foreground">{state.ok}</p>
      )}
      {state.error && (
        <p className="mt-2.5 text-[0.82rem] leading-relaxed text-[var(--signal-text)]">
          {state.error}
        </p>
      )}
    </section>
  );
}
