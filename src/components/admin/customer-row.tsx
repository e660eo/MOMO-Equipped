"use client";

import { useActionState, useState } from "react";
import { formatPrice } from "@/lib/format";
import { setOrderStatus } from "@/app/admin/orders/actions";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import {
  adjustCustomerBonusAction,
  saveCustomerAdmin,
  type BonusActionState,
} from "@/app/admin/customers/actions";
import { cn } from "@/lib/utils";
import type { BonusTransaction, OrderStatus } from "@/lib/types";

/*
  Строка клиента в панели.

  Раньше «Заказы» были просто числом-ссылкой на отфильтрованный список. Теперь
  по клику строка разворачивается: виден полный состав каждого заказа и кнопки
  статуса (Новый / В работе / Выполнен / Отменён) — менеджер меняет статус прямо
  отсюда, не уходя в раздел заказов.

  Кнопки — формы с серверным действием setOrderStatus (оно обновляет и этот
  раздел, см. orders/actions.ts). Раскрытие — клиентское состояние, оно
  переживает обновление данных после смены статуса.
*/

export type MiniOrder = {
  id: string;
  createdAt: string;
  total: number;
  status: OrderStatus;
  items: { title: string; qty: number }[];
};

export type CustomerRowData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  createdAt: string;
  lastLoginAt?: string;
  bonusBalance: number;
  bonusExpiresAt?: string;
  admin?: { note?: string; tags?: string[]; history?: Array<{ at: string; text: string }> };
};

const STATUS: { value: OrderStatus; label: string }[] = [
  { value: "new", label: "Новый" },
  { value: "in_work", label: "В работе" },
  { value: "done", label: "Выполнен" },
  { value: "canceled", label: "Отменён" },
];

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU") : "—";

export function CustomerRow({
  customer,
  spent,
  orders,
  bonusHistory,
}: {
  customer: CustomerRowData;
  spent: number;
  orders: MiniOrder[];
  bonusHistory: BonusTransaction[];
}) {
  const [open, setOpen] = useState(false);
  const count = orders.length;

  return (
    <>
      <tr className="responsive-record admin-row border-b border-border">
        <td data-label="Покупатель" className="py-3 pr-3 font-medium">
          {customer.name}
          {customer.address && (
            <span className="block text-[0.75rem] font-normal text-muted-foreground">
              {customer.address}
            </span>
          )}
        </td>
        <td data-label="Контакты" className="py-3 pr-3 text-muted-foreground">
          <a
            href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}
            className="hover:text-signal"
          >
            {customer.phone}
          </a>
          <span className="block text-[0.75rem]">{customer.email}</span>
        </td>
        <td data-label="Был" className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
          {fmtDate(customer.createdAt)}
        </td>
        <td data-label="Регистрация" className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
          {fmtDate(customer.lastLoginAt)}
        </td>
        <td data-label="Бонусы" className="py-3 pr-3 text-right font-semibold tabular-nums text-signal">
          {customer.bonusBalance}
        </td>
        <td data-label="Действия" className="py-3 pr-3 text-right">
          {count > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="font-medium underline decoration-dotted underline-offset-4 transition-colors hover:text-signal"
            >
              {count} {open ? "▲" : "▾"}
            </button>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </td>
        <td data-label="Куплено на" className="py-3 pr-3 text-right font-medium">
          {spent > 0 ? formatPrice(spent) : "—"}
        </td>
        <td data-label="Заказы" className="py-3 pr-3 text-right">
          <div className="flex items-center justify-end gap-3"><button type="button" onClick={() => setOpen((value) => !value)} className="font-medium text-signal">{open ? "Закрыть" : "Карточка"}</button><ResetPasswordButton customerId={customer.id} name={customer.name} /></div>
        </td>
      </tr>

      {open && (
        <tr className="responsive-expanded border-b border-border">
          <td colSpan={8} className="bg-bg/40 px-3 py-4">
            <BonusEditor customer={customer} history={bonusHistory} />
            <form action={saveCustomerAdmin} className="mb-4 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
              <input type="hidden" name="id" value={customer.id} />
              <label className="grid gap-1 text-[0.75rem] text-muted-foreground">Теги и сегменты<input name="tags" defaultValue={customer.admin?.tags?.join(", ")} placeholder="VIP, установочный центр, опт" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm text-foreground" /></label>
              <label className="grid gap-1 text-[0.75rem] text-muted-foreground">Добавить событие<input name="event" placeholder="Позвонил, интересуется новой поставкой" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm text-foreground" /></label>
              <label className="grid gap-1 text-[0.75rem] text-muted-foreground md:col-span-2">Заметка менеджера<textarea name="note" rows={3} defaultValue={customer.admin?.note} placeholder="Предпочтения, договорённости, подходящее время для связи…" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm text-foreground" /></label>
              <div className="md:col-span-2"><button type="submit" className="rounded-sm bg-foreground px-4 py-2 text-[0.8rem] font-semibold text-bg">Сохранить карточку клиента</button></div>
              {customer.admin?.history?.length ? <div className="md:col-span-2"><p className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">История взаимодействий</p><ul className="mt-2 space-y-1 text-[0.78rem]">{customer.admin.history.slice().reverse().map((event, index) => <li key={`${event.at}-${index}`}>{fmtDate(event.at)} · {event.text}</li>)}</ul></div> : null}
            </form>
            <div className="flex flex-col gap-3">
              {orders.length === 0 && <p className="text-[0.82rem] text-muted-foreground">Заказов у этого клиента пока нет.</p>}
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-sm border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[0.8rem]">
                      №{o.id} · {fmtDate(o.createdAt)}
                    </span>
                    <span className="font-medium">{formatPrice(o.total)}</span>
                  </div>

                  <ul className="mt-2 flex flex-col gap-0.5 text-[0.8rem] text-muted-foreground">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.title} × {it.qty}
                      </li>
                    ))}
                  </ul>

                  {/* Кнопки статуса — текущий подсвечен */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {STATUS.map((s) => (
                      <form key={s.value} action={setOrderStatus}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="status" value={s.value} />
                        <button
                          type="submit"
                          disabled={o.status === s.value}
                          className={cn(
                            "rounded-sm border px-3 py-1.5 text-[0.78rem] font-medium transition-all active:scale-95",
                            o.status === s.value
                              ? "cursor-default border-signal bg-signal/10 text-signal"
                              : "border-border hover:border-signal hover:text-signal",
                          )}
                        >
                          {s.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BonusEditor({
  customer,
  history,
}: {
  customer: CustomerRowData;
  history: BonusTransaction[];
}) {
  const [state, action, pending] = useActionState<BonusActionState, FormData>(
    adjustCustomerBonusAction,
    {},
  );
  return (
    <section className="mb-4 rounded-xl border border-signal/30 bg-signal/[0.035] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">Бонусный счёт</p>
          <p className="mt-1 font-display text-xl font-extrabold text-signal">{customer.bonusBalance} бонусов</p>
        </div>
        {customer.bonusExpiresAt && customer.bonusBalance > 0 && (
          <p className="text-[0.72rem] text-muted-foreground">Ближайшее сгорание: {fmtDate(customer.bonusExpiresAt)}</p>
        )}
      </div>
      <form action={action} className="mt-4 grid gap-2 md:grid-cols-[130px_150px_1fr_auto]">
        <input type="hidden" name="customerId" value={customer.id} />
        <select name="operation" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm">
          <option value="credit">Начислить</option>
          <option value="debit">Списать</option>
        </select>
        <input name="amount" type="number" min={1} max={1_000_000} step={1} required placeholder="Количество" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm" />
        <input name="reason" required minLength={3} maxLength={240} placeholder="Причина: подарок, компенсация…" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm" />
        <button type="submit" disabled={pending} className="rounded-sm bg-signal px-4 py-2 text-[0.8rem] font-semibold text-white disabled:opacity-60">
          {pending ? "Сохраняю…" : "Применить"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-[0.78rem] text-signal">{state.error}</p>}
      {state.ok && <p className="mt-2 text-[0.78rem] text-green-700">{state.ok}</p>}
      {history.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[0.75rem] font-semibold text-muted-foreground">История бонусов ({history.length})</summary>
          <ul className="mt-2 divide-y divide-border text-[0.76rem]">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <span>{fmtDate(entry.createdAt)} · {entry.reason}{entry.orderId ? ` · №${entry.orderId}` : ""}</span>
                <b className={entry.amount > 0 ? "text-green-700" : "text-signal"}>{entry.amount > 0 ? "+" : ""}{entry.amount}</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
