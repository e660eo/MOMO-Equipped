import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { getDealerAccounts, getDealerLocation, getDealerOrders } from "@/lib/dealers";
import { getDealerOrderAgreement } from "@/lib/dealer-order-management";
import { getDealerOrderNotifications } from "@/lib/dealer-order-notifications";
import { DEALER_ORDER_STATUS_LABELS } from "@/lib/dealer-order-ui";
import { formatPrice } from "@/lib/format";
import { DealerOrderAgreementForm } from "@/components/admin/dealer-order-agreement-form";
import { setDealerOrderStatus } from "../../actions";
import { retryDealerOrderMailAction } from "./actions";
import { getDealerOrderNotes } from "@/lib/dealer-order-notes";
import { DealerOrderNoteForm } from "@/components/admin/dealer-order-note-form";
import { getDealerStockReservations } from "@/lib/dealer-stock";

export const dynamic = "force-dynamic";

const mailLabels = { pending: "Ожидает отправки", sending: "Отправляется", sent: "Принято почтовым сервером", failed: "Нужен повтор отправки" };

export default async function AdminDealerOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ statusConflict?: string; statusError?: string }> }) {
  await requireSession();
  const { id } = await params;
  const { statusConflict, statusError } = await searchParams;
  const order = getDealerOrders().find((item) => item.id === id);
  if (!order) notFound();
  const dealer = getDealerLocation(order.dealerId);
  const account = getDealerAccounts().find((item) => item.id === order.accountId);
  const agreement = getDealerOrderAgreement(id);
  const notifications = getDealerOrderNotifications(id);
  const needsRetry = notifications.some((item) => item.status === "failed" || (item.status === "pending" && item.error));
  const reservation = getDealerStockReservations().find((item) => item.orderId === id);
  return <div className="space-y-5">
    <Link href="/admin/dealers/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-signal">← Заказы дилеров</Link>
    {statusConflict && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Статус уже изменён в другом окне. Показаны актуальные данные; проверьте их перед сохранением.</p>}
    {statusError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">{statusError}</p>}
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-xs font-bold uppercase tracking-wider text-signal">Дилерский заказ</p><h1 className="mt-1 font-display text-3xl font-extrabold">{order.id}</h1><p className="mt-2 text-sm">{dealer?.name ?? "Дилер"} · {dealer?.city}</p><p className="mt-1 text-sm text-muted-foreground">{account?.contactName} {account?.email && <>· <a href={`mailto:${account.email}`} className="hover:text-signal">{account.email}</a></>} {dealer?.phone && <>· <a href={`tel:${dealer.phone}`} className="hover:text-signal">{dealer.phone}</a></>}</p></div>
        <form action={setDealerOrderStatus} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={order.id} /><input type="hidden" name="expectedStatus" value={order.status} /><label className="text-xs font-semibold">Статус заказа<select name="status" aria-label="Статус заказа" defaultValue={order.status} className="mt-1 block min-h-11 rounded-lg border border-border bg-bg px-3 text-sm">{Object.entries(DEALER_ORDER_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="min-h-11 rounded-lg border border-border px-4 text-sm font-bold">Сохранить статус</button></form>
      </div>
      <details className="mt-5 rounded-lg border border-border p-4"><summary className="cursor-pointer font-bold">Исходная заявка · {formatPrice(order.total)}</summary><ul className="mt-3 space-y-2 text-sm">{order.items.map((item) => <li key={item.slug}>{item.title} × {item.qty} · {formatPrice(item.price)} / шт. · {formatPrice(item.price * item.qty)}</li>)}</ul>{order.comment && <p className="mt-4 whitespace-pre-wrap text-sm">Комментарий дилера: {order.comment}</p>}</details>
      {agreement && <p className="mt-4 text-sm text-muted-foreground">Условия от {new Date(agreement.updatedAt).toLocaleString("ru-RU")} · версия {agreement.revision} · итого с доставкой <strong className="text-foreground">{formatPrice(agreement.total)}</strong></p>}
    </section>
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6"><DealerOrderAgreementForm key={order.id} order={order} agreement={agreement} /></section>
    <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-bold">Резерв товара</h2><p className="mt-2 text-sm">{reservation?.status === "reserved" ? "Товар зарезервирован после подтверждения полной оплаты и исключён из доступного остатка." : reservation?.status === "shipped" ? "Товар отгружен. Повторного списания при завершении заказа не будет." : "Активного резерва нет. Резерв создаётся при сохранении условий с оплатой «Оплачен»."}</p><p className="mt-2 text-xs text-muted-foreground">Частичная оплата не резервирует товар. Отмена до отгрузки освобождает резерв. Состав отгруженного заказа защищён от изменения.</p><Link href="/admin/inventory" className="mt-2 inline-flex min-h-11 items-center text-sm underline">Остатки и резервы</Link></section>
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6"><DealerOrderNoteForm orderId={order.id} saved={getDealerOrderNotes().find((note) => note.orderId === order.id)} /></section>
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-display text-xl font-extrabold uppercase">Уведомления по заказу</h2>
      <p className="mt-1 text-xs text-muted-foreground">При временной ошибке письмо отправится повторно. Статус подтверждает приём почтовым сервером, а не прочтение письма.</p>
      <div className="mt-4 space-y-3">{notifications.map((job) => <article key={job.id} className={`rounded-lg border p-3 ${job.error ? "border-amber-300 bg-amber-50 text-amber-950" : "border-border"}`}><p className="text-sm font-semibold">{job.recipient === "manager" ? "Менеджеру" : "Дилеру"} · {job.kind === "created" ? "Новая заявка" : job.kind === "status" ? "Изменение статуса" : "Согласованные условия"}</p><p className="mt-1 text-xs">{mailLabels[job.status]} · попыток: {job.attempts}{job.sentAt && ` · ${new Date(job.sentAt).toLocaleString("ru-RU")}`}</p>{job.error && <p className="mt-2 break-words text-xs">{job.error}{job.status === "pending" && ` Следующая попытка: ${new Date(job.runAt).toLocaleString("ru-RU")}.`}</p>}</article>)}</div>
      {!notifications.length && <p className="mt-4 text-sm text-muted-foreground">{order.notificationEvents?.length || agreement ? "Постановка писем в очередь ожидается. Фоновая проверка восстановит её автоматически." : "Для старой заявки автоматические письма не создавались. Новые изменения будут отправляться дилеру."}</p>}
      {(needsRetry || Boolean((order.notificationEvents?.length || agreement) && !notifications.length)) && <form action={retryDealerOrderMailAction} className="mt-4"><input type="hidden" name="orderId" value={order.id} /><button className="min-h-11 rounded-lg border border-border px-4 text-sm font-bold">Повторить отправку</button></form>}
    </section>
  </div>;
}
