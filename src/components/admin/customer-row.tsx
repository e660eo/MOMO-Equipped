"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { setOrderStatus } from "@/app/admin/orders/actions";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { saveCustomerAdmin } from "@/app/admin/customers/actions";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

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
}: {
  customer: CustomerRowData;
  spent: number;
  orders: MiniOrder[];
}) {
  const [open, setOpen] = useState(false);
  const count = orders.length;

  return (
    <>
      <tr className="admin-row border-b border-border">
        <td className="py-3 pr-3 font-medium">
          {customer.name}
          {customer.address && (
            <span className="block text-[0.75rem] font-normal text-muted-foreground">
              {customer.address}
            </span>
          )}
        </td>
        <td className="py-3 pr-3 text-muted-foreground">
          <a
            href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}
            className="hover:text-signal"
          >
            {customer.phone}
          </a>
          <span className="block text-[0.75rem]">{customer.email}</span>
        </td>
        <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
          {fmtDate(customer.createdAt)}
        </td>
        <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
          {fmtDate(customer.lastLoginAt)}
        </td>
        <td className="py-3 pr-3 text-right">
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
        <td className="py-3 pr-3 text-right font-medium">
          {spent > 0 ? formatPrice(spent) : "—"}
        </td>
        <td className="py-3 pr-3 text-right">
          <div className="flex items-center justify-end gap-3"><button type="button" onClick={() => setOpen((value) => !value)} className="font-medium text-signal">{open ? "Закрыть" : "Карточка"}</button><ResetPasswordButton customerId={customer.id} name={customer.name} /></div>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border">
          <td colSpan={7} className="bg-bg/40 px-3 py-4">
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
