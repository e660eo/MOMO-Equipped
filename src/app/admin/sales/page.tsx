import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { salesRange } from "@/lib/sales";
import { formatPrice } from "@/lib/format";

function delta(current: number, previous: number): string {
  if (!previous) return current ? "+100%" : "0%";
  const value = Math.round(((current - previous) / previous) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdminPage();
  const params = await searchParams;
  const currentDate = new Date();
  const today = currentDate.toISOString().slice(0, 10);
  const monthAgoDate = new Date(currentDate);
  monthAgoDate.setUTCDate(monthAgoDate.getUTCDate() - 29);
  const monthAgo = monthAgoDate.toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from! : monthAgo;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to! : today;
  const report = salesRange(from <= to ? from : to, from <= to ? to : from);
  const metrics = [
    { label: "Сумма заказов", value: report.gross, compare: report.previousGross, note: "без отменённых" },
    { label: "Фактически оплачено", value: report.paid, compare: report.previousPaid, note: "боевые CAPTURED" },
    { label: "Отменено", value: report.canceled, note: "сумма отменённых заказов" },
    { label: "Средний чек", value: report.avg, note: `${report.orders.length} заказов в периоде` },
  ];
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-xl font-extrabold uppercase">Отчёты</h1><p className="mt-1 text-[0.85rem] text-muted-foreground">Заказы и реально полученные онлайн-оплаты считаются отдельно.</p></div><a href={`/admin/export/sales?from=${report.from}&to=${report.to}`} download className="rounded-sm border border-border px-4 py-2 text-[0.82rem] font-medium hover:border-signal hover:text-signal">Экспорт отчёта CSV</a></div>
    <form method="get" className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"><label className="grid gap-1 text-[0.72rem] text-muted-foreground">С даты<input type="date" name="from" defaultValue={report.from} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm text-foreground" /></label><label className="grid gap-1 text-[0.72rem] text-muted-foreground">По дату<input type="date" name="to" defaultValue={report.to} className="rounded-sm border border-input bg-bg px-3 py-2 text-sm text-foreground" /></label><button type="submit" className="rounded-sm bg-foreground px-4 py-2 text-[0.82rem] font-semibold text-bg">Построить</button></form>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-border bg-surface p-4"><p className="text-[0.72rem] uppercase tracking-wider text-muted-foreground">{metric.label}</p><p className="mt-1.5 font-display text-2xl font-extrabold">{formatPrice(metric.value)}</p><p className="mt-1 text-[0.75rem] text-muted-foreground">{metric.note}{metric.compare !== undefined && <> · <span className={metric.value >= metric.compare ? "text-green-700" : "text-signal"}>{delta(metric.value, metric.compare)} к прошлому периоду</span></>}</p></div>)}</div>
    <h2 className="mt-9 font-display text-base font-extrabold uppercase">Товары за период</h2>{report.top.length === 0 ? <p className="mt-4 text-[0.85rem] text-muted-foreground">Продаж за этот период нет.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-[0.85rem]"><thead><tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-3">Товар</th><th className="py-2 pr-3 text-right">Продано</th><th className="py-2 text-right">Сумма</th></tr></thead><tbody>{report.top.map((item) => <tr key={item.slug} className="border-b border-border"><td className="py-3 pr-3"><Link href={`/admin/products/${item.slug}`} className="font-medium hover:text-signal">{item.title}</Link></td><td className="py-3 pr-3 text-right">{item.qty} шт.</td><td className="py-3 text-right font-semibold">{formatPrice(item.revenue)}</td></tr>)}</tbody></table></div>}
  </div>;
}
