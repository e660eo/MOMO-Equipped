"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { NewsItem } from "@/lib/types";
import { saveNews, type ActionState } from "@/app/admin/news/actions";

const field =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none";
const label = "block text-[0.78rem] font-medium";

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
        Текст
      </label>
      <textarea
        id="excerpt"
        name="excerpt"
        rows={5}
        defaultValue={item?.excerpt}
        required
        className={`${field} mt-1.5`}
      />
      <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
        Пара предложений: этот текст видно и в списке новостей, и на самой
        странице заметки.
      </p>

      {state.error && (
        <p className="mt-5 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
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
