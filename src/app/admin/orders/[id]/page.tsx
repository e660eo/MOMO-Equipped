import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import { getOrder, STATUS_LABELS } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, isPaid } from "@/lib/yandex-pay";
import { cn } from "@/lib/utils";
import { retryOrderIntegration, retryOzonShipment, setOrderArchivedAction, setOrderStatus, setOrderNote } from "../actions";
import type { OrderStatus } from "@/lib/types";
import { getIntegrationJobsForEntity } from "@/lib/job-queue";

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
  const integrationJobs = getIntegrationJobsForEntity(order.id);

  const { customer } = order;
  const waText = encodeURIComponent(
    `Здравствуйте! По заказу №${order.id} с сайта MOMO.`,
  );

  return (
    <div className="max-w-[760px]">
      <Link
        href={order.archivedAt ? "/admin/orders?archived=1" : "/admin/orders"}
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← {order.archivedAt ? "В архив заказов" : "Ко всем заказам"}
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-xl font-extrabold uppercase">
          Заказ {order.id}
        </h1>
        <span className="text-[0.85rem] text-muted-foreground">
          {new Date(order.createdAt).toLocaleString("ru-RU")}
        </span>
      </div>

      <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3", order.archivedAt ? "border-signal/40 bg-signal/5" : "border-border bg-surface")}>
        <div>
          <p className="text-sm font-semibold">{order.archivedAt ? "Заказ находится в архиве" : "Рабочий список заказов"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{order.archivedAt ? `Перемещён ${new Date(order.archivedAt).toLocaleString("ru-RU")}. Все данные сохранены.` : "После завершения заказ можно скрыть в архиве и при необходимости восстановить."}</p>
        </div>
        <form action={setOrderArchivedAction}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="archived" value={order.archivedAt ? "false" : "true"} />
          <button type="submit" className={cn("inline-flex min-h-11 items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition-colors", order.archivedAt ? "border-signal text-signal hover:bg-signal/10" : "border-border text-muted-foreground hover:border-signal hover:text-signal")}>
            {order.archivedAt ? <ArchiveRestore size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
            {order.archivedAt ? "Восстановить" : "Переместить в архив"}
          </button>
        </form>
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
          <dt className="text-muted-foreground">Email</dt>
          <dd>{customer.email ? <a href={`mailto:${customer.email}`} className="hover:text-signal">{customer.email}</a> : <span className="text-[var(--signal-text)]">Не указан — письмо и чек по email не отправить</span>}</dd>
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
        {(order.promo || order.bonus?.spent) && (
          <dl className="mt-3 ml-auto grid max-w-[320px] grid-cols-[1fr_auto] gap-x-5 gap-y-1 text-[0.8rem]">
            {order.promo && (
              <>
                <dt className="text-muted-foreground">Промокод {order.promo.code}</dt>
                <dd className="text-signal">−{formatPrice(order.promo.discount)}</dd>
              </>
            )}
            {order.bonus?.spent ? (
              <>
                <dt className="text-muted-foreground">Оплачено бонусами</dt>
                <dd className="text-signal">−{formatPrice(order.bonus.spent)}</dd>
              </>
            ) : null}
          </dl>
        )}
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
            {order.delivery
              ? `В сумму включена доставка Ozon: ${order.delivery.customerPrice > 0 ? formatPrice(order.delivery.customerPrice) : "бесплатно"}.`
              : "Доставку согласуйте отдельно."}
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

      {order.payment?.receipt && (
        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-extrabold uppercase">Электронный чек</h2>
          <p className={`mt-2 text-sm font-semibold ${order.payment.receipt.status === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {order.payment.receipt.status === "payment_confirmed"
              ? "Оплата подтверждена, реквизиты чека приняты"
              : order.payment.receipt.status === "submitted"
                ? "Реквизиты чека переданы в Yandex Pay"
                : "Ошибка проверки реквизитов чека"}
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[190px_1fr]">
            <dt className="text-muted-foreground">Контакт для чека</dt><dd>{order.payment.receipt.contact}</dd>
            <dt className="text-muted-foreground">Передано</dt><dd>{new Date(order.payment.receipt.submittedAt).toLocaleString("ru-RU")}</dd>
            <dt className="text-muted-foreground">Последняя сверка</dt><dd>{order.payment.receipt.checkedAt ? new Date(order.payment.receipt.checkedAt).toLocaleString("ru-RU") : "Ещё не выполнялась"}</dd>
            <dt className="text-muted-foreground">Операция Yandex Pay</dt><dd className="break-all font-mono">{order.payment.receipt.operationId ?? "Пока не получена"}{order.payment.receipt.operationStatus ? ` · ${order.payment.receipt.operationStatus}` : ""}</dd>
            <dt className="text-muted-foreground">Номер кассового чека</dt><dd>Merchant API Yandex Pay его не возвращает; для номера нужен API АТОЛ/CloudKassir.</dd>
            <dt className="text-muted-foreground">Доставка письма ОФД</dt><dd>Yandex Pay не передаёт подтверждение доставки. Ниже отдельно виден результат письма магазина.</dd>
          </dl>
          {order.payment.receipt.error && <p className="mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700">{order.payment.receipt.error}</p>}
          <form action={retryOrderIntegration} className="mt-4">
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="type" value="fiscal_check" />
            <button className="rounded-sm border border-border px-4 py-2 text-xs font-semibold hover:border-signal hover:text-signal">Повторно сверить с Yandex Pay</button>
          </form>
        </section>
      )}

      {order.delivery && (
        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-extrabold uppercase">
            Ozon Доставка
          </h2>
          <p className="mt-2 text-sm font-semibold">{order.delivery.pointName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{order.delivery.address}</p>
          <p className="mt-3 text-sm">
            <b>Откуда:</b> склад MOMO по FBS
            {order.delivery.splits.length
              ? ` · Ozon ID ${[...new Set(order.delivery.splits.map((split) => split.warehouseId))].join(", ")}`
              : ""}
          </p>
          <p className="mt-1 text-sm">
            <b>Куда:</b> {order.delivery.address}
          </p>
          <p className="mt-2 text-sm">
            Для покупателя:{" "}
            <b>{order.delivery.customerPrice > 0 ? formatPrice(order.delivery.customerPrice) : "бесплатно"}</b>
          </p>
          {order.delivery.shipment?.status === "created" ? (
            <p className="mt-2 text-sm font-semibold text-[var(--signal-text)]">
              Создано в Ozon по FBS · № {order.delivery.shipment.orderNumber}
            </p>
          ) : order.delivery.shipment?.status === "failed" ? (
            <div className="mt-3 rounded-sm border border-signal/60 bg-signal/5 p-3">
              <p className="text-sm text-signal">Не создалось автоматически: {order.delivery.shipment.error}</p>
              <form action={retryOzonShipment} className="mt-3"><input type="hidden" name="id" value={order.id} /><button type="submit" className="rounded-sm bg-signal px-4 py-2 text-[0.82rem] font-semibold text-white">Повторить отправку в Ozon</button></form>
              <p className="mt-2 text-[0.75rem] text-muted-foreground">Если Ozon снова не ответит, задача повторится автоматически до пяти раз.</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Отправление создаётся после подтверждённой оплаты.
            </p>
          )}
        </section>
      )}

      <section className="mt-5 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">Письма и интеграции</h2>
        {integrationJobs.length ? <div className="mt-4 space-y-3">{integrationJobs.map((job) => {
          const labels = { order_mail: "Письмо администратору", support_message_mail: "Уведомление о чате", customer_payment_mail: "Письмо покупателю", ozon_shipment: "Отправление Ozon", fiscal_check: "Проверка чека", customer_welcome: "Приветственное письмо", customer_email_verification: "Подтверждение email" } as const;
          return <article key={job.id} className="rounded-lg border border-border p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{labels[job.type]}</b><span className={job.status === "done" ? "text-emerald-700" : job.status === "failed" ? "text-red-600" : "text-amber-700"}>{job.status === "done" ? "Выполнено" : job.status === "failed" ? "Ошибка" : job.status === "running" ? "Выполняется" : "В очереди"} · попыток {job.attempts}</span></div>
            <p className="mt-1 text-muted-foreground">Обновлено {new Date(job.updatedAt).toLocaleString("ru-RU")}</p>
            {job.lastResult && <p className="mt-2 text-emerald-700">{job.lastResult}</p>}
            {job.lastError && <p className="mt-2 text-red-600">{job.lastError}</p>}
            {job.status === "failed" && ["order_mail", "customer_payment_mail", "fiscal_check"].includes(job.type) && <form action={retryOrderIntegration} className="mt-2"><input type="hidden" name="id" value={order.id} /><input type="hidden" name="type" value={job.type} /><input type="hidden" name="kind" value={job.payload?.kind ?? ""} /><button className="font-semibold text-signal hover:underline">Повторить сейчас</button></form>}
          </article>;
        })}</div> : <p className="mt-3 text-sm text-muted-foreground">Для старого заказа задачи интеграций не записаны.</p>}
      </section>

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

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">История заказа</h2>
        <ol className="mt-4 space-y-3 border-l border-border pl-4">
          {(order.history ?? [{ at: order.createdAt, actor: "Система", type: "created" as const, detail: "Заказ создан" }]).slice().reverse().map((event, index) => (
            <li key={`${event.at}-${index}`} className="relative text-[0.82rem] before:absolute before:-left-[20px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-signal">
              <p className="font-medium">
                {event.type === "status" ? `Статус: ${STATUS_LABELS[(event.from ?? "new") as OrderStatus]} → ${STATUS_LABELS[(event.to ?? order.status) as OrderStatus]}` : event.type === "payment" ? `Оплата: ${event.to}` : event.type === "delivery" ? `Ozon: ${event.to}` : event.detail ?? "Заказ создан"}
              </p>
              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">{new Date(event.at).toLocaleString("ru-RU")} · {event.actor}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
