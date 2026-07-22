"use client";

import { useActionState } from "react";
import type { SiteConfig } from "@/lib/types";
import { saveSettings, type ActionState } from "@/app/admin/settings/actions";

const field =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none";
const label = "block text-[0.78rem] font-medium";

export function SettingsForm({ site }: { site: SiteConfig }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveSettings,
    {},
  );
  const { contacts, trust } = site;

  const rows: [string, string, string, string?][] = [
    ["phone", "Телефон", contacts.phone, "Показывается в шапке и на всех страницах"],
    ["phoneSecondary", "Второй телефон", contacts.phoneSecondary, "Только в реквизитах"],
    ["email", "Почта", contacts.email],
    ["address", "Адрес", contacts.address],
    ["hours", "Режим работы", contacts.hours],
    ["whatsapp", "Ссылка WhatsApp", contacts.whatsapp],
    ["telegram", "Ссылка Telegram", contacts.telegram],
  ];

  const numbers: [string, string, number, string][] = [
    ["warrantyMonths", "Гарантия, месяцев", trust.warrantyMonths, ""],
    ["returnDays", "Возврат, дней", trust.returnDays, ""],
    ["processingDays", "Обработка заказа, дней", trust.processingDays, ""],
    [
      "freeShippingFrom",
      "Бесплатная доставка от, ₽",
      trust.freeShippingFrom,
      "Порог виден в корзине и в верхней плашке",
    ],
  ];

  return (
    <form action={formAction} className="max-w-[680px]">
      <div className="grid gap-5 sm:grid-cols-2">
        {rows.map(([name, title, value, hint]) => (
          <div key={name} className={name === "address" ? "sm:col-span-2" : ""}>
            <label className={label} htmlFor={name}>
              {title}
            </label>
            <input
              id={name}
              name={name}
              defaultValue={value}
              className={`${field} mt-1.5`}
            />
            {hint && (
              <p className="mt-1 text-[0.72rem] text-muted-foreground">{hint}</p>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-9 font-display text-[1rem] font-semibold uppercase">
        Условия
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {numbers.map(([name, title, value, hint]) => (
          <div key={name}>
            <label className={label} htmlFor={name}>
              {title}
            </label>
            <input
              id={name}
              name={name}
              inputMode="numeric"
              defaultValue={value}
              className={`${field} mt-1.5`}
            />
            {hint && (
              <p className="mt-1 text-[0.72rem] text-muted-foreground">{hint}</p>
            )}
          </div>
        ))}
      </div>

      {state.error && (
        <p className="mt-6 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-7 rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_20px_-6px_rgba(255,85,0,0.6)] active:scale-95 disabled:opacity-60"
      >
        {pending ? "Сохраняю…" : "Сохранить"}
      </button>
    </form>
  );
}
