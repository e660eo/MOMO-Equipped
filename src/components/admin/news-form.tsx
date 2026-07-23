"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { NewsItem } from "@/lib/types";
import { saveNews, type ActionState } from "@/app/admin/news/actions";

const field =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none";
const label = "block text-[0.78rem] font-medium";

/*
  Подсказка в пустом поле — заодно и образец разметки: показать её на живом
  примере короче, чем объяснить словами.
*/
const PLACEHOLDER = `Здесь пишется сама статья.

## Подзаголовок

Абзац текста. Строки внутри абзаца можно переносить как удобно — на странице
они склеятся в один абзац.

- первый пункт списка
- второй пункт`;

export function NewsForm({ item }: { item?: NewsItem }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveNews,
    {},
  );

  // У новой заметки дата по умолчанию — сегодня: так её не забудут проставить.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="max-w-[680px]">
      {item && <input type="hidden" name="slug" value={item.slug} />}

      <label className={label} htmlFor="title">
        Заголовок
      </label>
      <input
        id="title"
        name="title"
        defaultValue={item?.title}
        required
        className={`${field} mt-1.5`}
      />

      <label className={`${label} mt-5`} htmlFor="date">
        Дата
      </label>
      <input
        id="date"
        name="date"
        type="date"
        defaultValue={item?.date ?? today}
        required
        className={`${field} mt-1.5 max-w-[220px]`}
      />

      <label className={`${label} mt-5`} htmlFor="excerpt">
        Анонс
      </label>
      <textarea
        id="excerpt"
        name="excerpt"
        rows={3}
        defaultValue={item?.excerpt}
        required
        className={`${field} mt-1.5`}
      />
      <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
        Пара предложений. Их видно в списке новостей и в начале статьи — по
        ним решают, читать ли дальше.
      </p>

      <label className={`${label} mt-5`} htmlFor="body">
        Полный текст{" "}
        <span className="font-normal text-muted-foreground">
          — можно не заполнять
        </span>
      </label>
      <textarea
        id="body"
        name="body"
        rows={18}
        defaultValue={item?.body}
        placeholder={PLACEHOLDER}
        className={`${field} mt-1.5 leading-relaxed`}
      />
      <div className="mt-2 rounded-sm border border-border bg-bg px-4 py-3 text-[0.75rem] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Как оформить текст</p>
        <ul className="mt-1.5 space-y-1">
          <li>
            Пустая строка — новый абзац. Внутри абзаца можно переносить строки
            как удобно.
          </li>
          <li>
            <code className="font-mono text-foreground">## Подзаголовок</code>{" "}
            — две решётки и пробел в начале строки.
          </li>
          <li>
            <code className="font-mono text-foreground">- пункт</code> — список;{" "}
            <code className="font-mono text-foreground">1. пункт</code> —
            нумерованный.
          </li>
        </ul>
        <p className="mt-2">
          Больше ничего учить не нужно: остальное — обычный текст. Оставите
          поле пустым — на странице останется один анонс.
        </p>
      </div>

      {state.error && (
        <p className="mt-5 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_20px_-6px_rgba(255,85,0,0.6)] active:scale-95 disabled:opacity-60"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <Link
          href="/admin/news"
          className="text-[0.85rem] text-muted-foreground transition-colors hover:text-signal"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
