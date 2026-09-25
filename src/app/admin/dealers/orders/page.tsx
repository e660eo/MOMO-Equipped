import { requireSession } from "@/lib/admin-auth";
import Link from "next/link";
import { getDealerOrders, getDealerLocations, getDealerAccounts } from "@/lib/dealers";
import { getDealerOrderAgreementVersions } from "@/lib/dealer-order-management";
import { DEALER_WORK_TABS, dealerOrdersUrl, filterDealerOrders, matchesDealerView, type DealerOrderFilters } from "@/lib/dealer-order-worklist";
import { DealerOrdersPanel } from "@/components/admin/dealer-orders-panel";

export default async function AdminDealerOrdersPage({ searchParams }: { searchParams: Promise<DealerOrderFilters> }) {
  await requireSession();
  const orders = getDealerOrders();
  const params = await searchParams;
  const filters = { ...params, view: DEALER_WORK_TABS.some((tab) => tab.value === params.view) ? params.view : "" };
  const agreements = new Map(getDealerOrderAgreementVersions().map((item) => [item.orderId, item]));
  const filtered = filterDealerOrders(orders, agreements, getDealerLocations(false), getDealerAccounts(), filters);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.page) || 1)));
  const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg px-3 text-sm";
  return <div>
    <p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--signal-text)]">Дилеры</p>
    <h1 className="mt-2 font-display text-3xl font-extrabold uppercase">Заказы дилеров</h1>
    <p className="mt-2 text-sm text-muted-foreground">Откройте заказ, чтобы согласовать состав, доставку и оплату, прикрепить счёт и отправить сообщение дилеру.</p>
    <nav aria-label="Состояние дилерских заказов" className="mt-5 flex flex-wrap gap-2">{DEALER_WORK_TABS.map((tab) => <Link key={tab.value} aria-current={(filters.view || "") === tab.value ? "page" : undefined} href={dealerOrdersUrl({ ...filters, view: tab.value, page: "" })} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${(filters.view || "") === tab.value ? "border-signal bg-signal/10 font-bold text-[var(--signal-text)]" : "border-border"}`}>{tab.label}<span className="text-xs tabular-nums">{orders.filter((order) => matchesDealerView(order, agreements.get(order.id), tab.value)).length}</span></Link>)}</nav>
    <form method="get" className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="view" value={filters.view ?? ""} />
      <label className="text-xs font-semibold sm:col-span-2">Поиск по номеру, дилеру, городу, телефону или email<input name="q" defaultValue={filters.q} maxLength={200} className={inputClass} /></label>
      <label className="text-xs font-semibold">Дата от<input type="date" name="from" defaultValue={filters.from} className={inputClass} /></label>
      <label className="text-xs font-semibold">Дата до<input type="date" name="to" defaultValue={filters.to} className={inputClass} /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4"><button className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-bold text-bg">Найти</button><Link href="/admin/dealers/orders" className="inline-flex min-h-11 items-center text-sm underline">Сбросить</Link><p role="status" className="text-sm text-muted-foreground">Найдено: {filtered.length}</p></div>
    </form>
    <DealerOrdersPanel orders={filtered.slice((page - 1) * 25, page * 25)} />
    {pages > 1 && <nav aria-label="Страницы заказов" className="mt-4 flex items-center gap-4">{page > 1 && <Link className="inline-flex min-h-11 items-center underline" href={dealerOrdersUrl({ ...filters, page: String(page - 1) })}>← Назад</Link>}<span className="text-sm">{page} / {pages}</span>{page < pages && <Link className="inline-flex min-h-11 items-center underline" href={dealerOrdersUrl({ ...filters, page: String(page + 1) })}>Далее →</Link>}</nav>}
  </div>;
}
