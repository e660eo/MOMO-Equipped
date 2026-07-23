import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { getOrder, STATUS_LABELS } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, isPaid } from "@/lib/yandex-pay";
import { cn } from "@/lib/utils";
import { setOrderStatus, setOrderNote } from "../actions";
import type { OrderStatus } from "@/lib/types";

/* Карточка заказа: состав, контакты, статус и заметка менеджера. */

const FLOW: OrderStatus[] = ["new", "in_work", "done", "canceled"];

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();

  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();

  const { customer } = order;
  const waText = encodeURIComponent(
    `Здравствуйте! По заказу №${order.id} с сайта MOMO.`,
  );

  return (
    <div className="max-w-[760px]">
      <Link
        href="/admin/orders"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← Ко всем заказам
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-xl font-extrabold uppercase">
          Заказ {order.id}
        </h1>
        <span className="text-[0.85rem] text-muted-foreground">
          {new Date(order.createdAt).toLocaleString("ru-RU")}
        </span>
      </div>

      {/* Статус */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FLOW.map((s) => (
          <form key={s} action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value={s} />
            <button
              type="submit"
              disabled={order.status === s}
              className={
                order.status === s
                  ? "cursor-default rounded-sm border border-signal bg-signal/10 px-3.5 py-1.5 text-[0.82rem] font-semibold text-signal"
                  : "rounded-sm border border-border px-3.5 py-1.5 text-[0.82rem] text-muted-foreground transition-all hover:border-signal hover:text-signal active:scale-95"
              }
            >
              {STATUS_LABELS[s]}
            </button>
          </form>
        ))}
      </div>

      {/* Покупатель */}
      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-[1rem] font-semibold uppercase">
          Покупатель
        </h2>
        <dl className="mt-3 grid gap-2 text-[0.88rem] sm:grid-cols-[150px_1fr]">
          <dt className="text-muted-foreground">Имя</dt>
          <dd>{customer.name}</dd>
          <dt className="text-muted-foreground">Телефон</dt>
          <dd>
            <a href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`} className="hover:text-signal">
              {customer.phone}
            </a>
            {" · "}
            <a
              href={`https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${waText}`}
              target="_blank"
              rel="noopener"
              className="text-[var(--signal-text)] hover:underline"
            >
              написать в WhatsApp
            </a>
          </dd>
          <dt className="text-muted-foreground">Адрес</dt>
          <dd>{customer.address}</dd>
          {customer.comment && (
            <>
              <dt className="text-muted-foreground">Комментарий</dt>
              <dd>{customer.comment}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Состав */}
      <section className="mt-5 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-[1rem] font-semibold uppercase">Состав</h2>
        <ul className="mt-3 divide-y divide-border">
          {order.items.map((i) => (
            <li key={i.slug} className="flex flex-wrap gap-x-4 py-2.5 text-[0.88rem]">
              <Link
                href={`/admin/products/${i.slug}`}
                className="flex-1 transition-colors hover:text-signal"
              >
                {i.title}
              </Link>
              <span className="text-muted-foreground">
                {i.qty} × {formatPrice(i.price)}
              </span>
              <span className="w-24 text-right font-medium">
                {formatPrice(i.price * i.qty)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-right font-display text-lg font-semibold">
          Итого: {formatPrice(order.total)}
        </p>
        <p className="mt-1 text-right text-[0.75rem] text-muted-foreground">
          Цены — на момент оформления заказа
        </p>
      </section>

      {/* Оплата на сайте — только если её заводили */}
      {order.payment && (
        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-extrabold uppercase">
            Оплата на сайте
          </h2>
          <p
            className={cn(
              "mt-2 text-[0.9rem] font-semibold",
              isPaid(order.payment.status)
                ? "text-[var(--signal-text)]"
                : "text-foreground",
            )}
          >
            {PAYMENT_LABELS[order.payment.status]} ·{" "}
            {formatPrice(order.payment.amount)}
          </p>
          {order.payment.sandbox && (
            <p className="mt-1 text-[0.78rem] text-muted-foreground">
              Тестовый режим — настоящие деньги не списывались.
            </p>
          )}
          <p className="mt-2 text-[0.78rem] text-muted-foreground">
            Оплачен только товар. Доставку согласуйте отдельно.
          </p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            Обновлено{" "}
            {new Date(order.payment.updatedAt).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </section>
      )}

      {/* Заметка */}
      <form action={setOrderNote} className="mt-5">
        <input type="hidden" name="id" value={order.id} />
        <label className="block text-[0.78rem] font-medium" htmlFor="note">
          Заметка менеджера
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={order.note}
          placeholder="Договорились о доставке в субботу, оплата при получении…"
          className="mt-1.5 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
        />
        <button
          type="submit"
          className="mt-3 rounded-sm border border-border px-5 py-2 text-[0.85rem] font-medium transition-all hover:border-signal hover:text-signal active:scale-95"
        >
          Сохранить заметку
        </button>
      </form>
    </div>
  );
}
