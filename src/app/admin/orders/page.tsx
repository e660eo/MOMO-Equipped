import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getAdminOrders, STATUS_LABELS } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, isPaid } from "@/lib/yandex-pay";
import { plural, cn } from "@/lib/utils";
import { bulkSetOrderStatus } from "./actions";
import type { OrderStatus } from "@/lib/types";

const PAGE_SIZE = 25;
const TABS = [{ value: "", label: "Все" }, { value: "new", label: "Новые" }, { value: "in_work", label: "В работе" }, { value: "done", label: "Выполненные" }, { value: "canceled", label: "Отменённые" }];
const STATUS_STYLE: Record<OrderStatus, string> = { new: "border-signal text-signal", in_work: "border-border text-foreground", done: "border-border text-muted-foreground", canceled: "border-border text-muted-foreground line-through" };

type Params = { status?: string; customer?: string; q?: string; payment?: string; delivery?: string; from?: string; to?: string; page?: string };

function withParams(params: Params, patch: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...patch })) if (value) query.set(key, value);
  const value = query.toString();
  return value ? `/admin/orders?${value}` : "/admin/orders";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdminPage();
  const params = await searchParams;
  const { status = "", customer = "", q = "", payment = "", delivery = "", from = "", to = "" } = params;
  const query = q.trim().toLowerCase();
  const source = customer ? getAdminOrders().filter((order) => order.customerId === customer) : getAdminOrders();
  const filtered = source.filter((order) => {
    if (status && order.status !== status) return false;
    if (query && ![order.id, order.customer.name, order.customer.phone].join(" ").toLowerCase().includes(query)) return false;
    if (from && order.createdAt.slice(0, 10) < from) return false;
    if (to && order.createdAt.slice(0, 10) > to) return false;
    if (payment === "paid" && (!order.payment || !isPaid(order.payment.status))) return false;
    if (payment === "unpaid" && order.payment && isPaid(order.payment.status)) return false;
    if (payment === "failed" && order.payment?.status !== "FAILED" && order.payment?.status !== "VOIDED") return false;
    if (payment === "refunded" && order.payment?.status !== "REFUNDED" && order.payment?.status !== "PARTIALLY_REFUNDED") return false;
    if (delivery === "ozon" && !order.delivery) return false;
    if (delivery === "error" && order.delivery?.shipment?.status !== "failed") return false;
    if (delivery === "none" && order.delivery) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pages);
  const orders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dateFmt = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-xl font-extrabold uppercase">Заказы</h1><p className="mt-1 text-[0.85rem] text-muted-foreground">{filtered.length} {plural(filtered.length, "заказ", "заказа", "заказов")} · по {PAGE_SIZE} на странице</p></div><a href={`/admin/export/orders?${new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][]).toString()}`} download className="rounded-sm border border-border px-4 py-2 text-[0.82rem] font-medium hover:border-signal hover:text-signal">Скачать выбранные CSV</a></div>

    <div className="mt-5 flex flex-wrap gap-2">{TABS.map((tab) => { const count = tab.value ? source.filter((order) => order.status === tab.value).length : source.length; const active = status === tab.value; return <Link key={tab.value} href={withParams(params, { status: tab.value, page: "" })} className={cn("rounded-sm border px-3.5 py-1.5 text-[0.82rem]", active ? "border-signal bg-signal/10 font-semibold text-signal" : "border-border text-muted-foreground hover:border-signal hover:text-signal")}>{tab.label}<span className="ml-1.5 tabular-nums opacity-70">{count}</span></Link>; })}</div>

    <form method="get" className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-6">
      {status && <input type="hidden" name="status" value={status} />}{customer && <input type="hidden" name="customer" value={customer} />}
      <input name="q" defaultValue={q} placeholder="Номер, имя или телефон…" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none xl:col-span-2" />
      <select name="payment" defaultValue={payment} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm"><option value="">Любая оплата</option><option value="paid">Оплачено</option><option value="unpaid">Не оплачено</option><option value="failed">Ошибка оплаты</option><option value="refunded">Возврат</option></select>
      <select name="delivery" defaultValue={delivery} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm"><option value="">Любая доставка</option><option value="ozon">Ozon</option><option value="error">Ошибка Ozon</option><option value="none">Без Ozon</option></select>
      <input type="date" name="from" defaultValue={from} aria-label="Дата от" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm" />
      <input type="date" name="to" defaultValue={to} aria-label="Дата до" className="rounded-sm border border-input bg-bg px-3 py-2 text-sm" />
      <div className="flex gap-2 md:col-span-2 xl:col-span-6"><button type="submit" className="rounded-sm bg-foreground px-4 py-2 text-[0.82rem] font-semibold text-bg">Показать</button><Link href={status ? `/admin/orders?status=${status}` : "/admin/orders"} className="rounded-sm border border-border px-4 py-2 text-[0.82rem]">Сбросить</Link></div>
    </form>

    {orders.length === 0 ? <p className="py-14 text-center text-muted-foreground">Заказов по выбранным условиям нет.</p> : <form action={bulkSetOrderStatus} className="mt-5">
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-surface px-4 py-3"><span className="text-[0.8rem] text-muted-foreground">Отметьте заказы ниже</span><select name="status" required className="rounded-sm border border-input bg-bg px-3 py-2 text-[0.82rem]"><option value="">Изменить статус…</option><option value="new">Новый</option><option value="in_work">В работе</option><option value="done">Выполнен</option><option value="canceled">Отменён</option></select><button type="submit" className="rounded-sm bg-foreground px-4 py-2 text-[0.82rem] font-semibold text-bg">Применить</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-[0.85rem]"><thead><tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground"><th className="w-10 py-2.5 pr-3" /><th className="py-2.5 pr-3">Номер</th><th className="py-2.5 pr-3">Когда</th><th className="py-2.5 pr-3">Покупатель</th><th className="py-2.5 pr-3">Состав</th><th className="py-2.5 pr-3 text-right">Сумма</th><th className="py-2.5">Статус</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="admin-row border-b border-border align-top"><td className="py-3 pr-3"><input type="checkbox" name="ids" value={order.id} aria-label={`Выбрать заказ ${order.id}`} /></td><td className="py-3 pr-3"><Link href={`/admin/orders/${order.id}`} className="font-mono font-medium hover:text-signal">{order.id}</Link>{order.delivery?.shipment?.status === "failed" && <span className="mt-1 block text-[0.7rem] text-signal">ошибка Ozon</span>}</td><td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{dateFmt(order.createdAt)}</td><td className="py-3 pr-3"><span className="font-medium">{order.customer.name}</span><span className="mt-0.5 block text-[0.75rem] text-muted-foreground">{order.customer.phone}</span></td><td className="max-w-[280px] py-3 pr-3 text-[0.78rem] text-muted-foreground">{order.items.map((item) => `${item.title} × ${item.qty}`).join(", ")}</td><td className="whitespace-nowrap py-3 pr-3 text-right font-medium">{formatPrice(order.total)}{order.payment && <span className="block text-[0.7rem] font-normal text-muted-foreground">{PAYMENT_LABELS[order.payment.status]}</span>}</td><td className="py-3"><span className={cn("inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.72rem]", STATUS_STYLE[order.status])}>{STATUS_LABELS[order.status]}</span></td></tr>)}</tbody></table></div>
    </form>}

    {pages > 1 && <nav className="mt-6 flex items-center justify-center gap-3"><Link aria-disabled={page === 1} href={withParams(params, { page: String(Math.max(1, page - 1)) })} className={cn("rounded-sm border border-border px-4 py-2 text-sm", page === 1 && "pointer-events-none opacity-35")}>← Назад</Link><span className="text-sm text-muted-foreground">Страница {page} из {pages}</span><Link aria-disabled={page === pages} href={withParams(params, { page: String(Math.min(pages, page + 1)) })} className={cn("rounded-sm border border-border px-4 py-2 text-sm", page === pages && "pointer-events-none opacity-35")}>Дальше →</Link></nav>}
  </div>;
}
