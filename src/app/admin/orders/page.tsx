import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getOrders, STATUS_LABELS } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { plural, cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

/*
  Заказы с сайта. Новые сверху — за ними и приходят в этот раздел.
  Фильтр по статусу живёт в адресе, чтобы ссылку «что в работе» можно
  было сохранить в закладки.
*/

const TABS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_work", label: "В работе" },
  { value: "done", label: "Выполненные" },
  { value: "canceled", label: "Отменённые" },
];

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "border-signal text-signal",
  in_work: "border-border text-foreground",
  done: "border-border text-muted-foreground",
  canceled: "border-border text-muted-foreground line-through",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPage();

  const { status = "" } = await searchParams;
  const all = getOrders();
  const orders = status ? all.filter((o) => o.status === status) : all;

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">Заказы</h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Заявки с сайта. Заказ появляется здесь сразу, даже если покупатель не
        дописал в WhatsApp.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count =
            t.value === "" ? all.length : all.filter((o) => o.status === t.value).length;
          const active = status === t.value;
          return (
            <Link
              key={t.value}
              href={t.value ? `/admin/orders?status=${t.value}` : "/admin/orders"}
              className={cn(
                "rounded-sm border px-3.5 py-1.5 text-[0.82rem] transition-all active:scale-95",
                active
                  ? "border-signal bg-signal/10 font-semibold text-signal"
                  : "border-border text-muted-foreground hover:border-signal hover:text-signal",
              )}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <p className="py-14 text-center text-muted-foreground">
          {all.length === 0
            ? "Заказов пока нет. Как только покупатель оформит корзину, заявка появится здесь."
            : "В этой группе заказов нет."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[0.85rem]">
            <thead>
              <tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 pr-3 font-medium">Номер</th>
                <th className="py-2.5 pr-3 font-medium">Когда</th>
                <th className="py-2.5 pr-3 font-medium">Покупатель</th>
                <th className="py-2.5 pr-3 font-medium">Состав</th>
                <th className="py-2.5 pr-3 text-right font-medium">Сумма</th>
                <th className="py-2.5 pr-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="admin-row border-b border-border align-top">
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono font-medium transition-colors hover:text-signal"
                    >
                      {o.id}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                    {dateFmt(o.createdAt)}
                  </td>
                  <td className="py-3 pr-3">
                    {o.customer.name}
                    <span className="block text-[0.75rem] text-muted-foreground">
                      {o.customer.phone}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {o.items.length}{" "}
                    {plural(o.items.length, "позиция", "позиции", "позиций")}
                    <span className="block text-[0.75rem]">
                      {o.items[0]?.title.slice(0, 38)}
                      {o.items.length > 1 ? " …" : ""}
                    </span>
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap text-right font-medium">
                    {formatPrice(o.total)}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-sm border px-2 py-0.5 text-[0.72rem]",
                        STATUS_STYLE[o.status],
                      )}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
