import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { salesSummary } from "@/lib/sales";
import { formatPrice } from "@/lib/format";
import { plural } from "@/lib/utils";

export default async function SalesPage() {
  await requireAdminPage();

  const { periods, top, status, hasOrders } = salesSummary();

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">
        Сводка продаж
      </h1>
      <p className="mt-1 max-w-[680px] text-[0.85rem] leading-relaxed text-muted-foreground">
        По оформленным заказам, без отменённых. Онлайн-оплата не подключена —
        это суммы заказов, а не подтверждённые деньги.
      </p>

      {!hasOrders ? (
        <p className="mt-8 rounded-sm border border-border bg-surface px-4 py-8 text-center text-[0.9rem] text-muted-foreground">
          Заказов пока нет — как появятся, здесь будет статистика.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {periods.map((p) => (
              <div
                key={p.label}
                className="rounded-sm border border-border bg-surface p-4"
              >
                <p className="text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                  {p.label}
                </p>
                <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight">
                  {formatPrice(p.revenue)}
                </p>
                <p className="mt-1 text-[0.8rem] text-muted-foreground">
                  {p.orders} {plural(p.orders, "заказ", "заказа", "заказов")}
                  {p.orders > 0 && <> · средний {formatPrice(p.avg)}</>}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.82rem] text-muted-foreground">
            <span>
              Новые:{" "}
              <b className="font-semibold text-foreground">{status.new}</b>
            </span>
            <span>
              В работе:{" "}
              <b className="font-semibold text-foreground">{status.in_work}</b>
            </span>
            <span>
              Выполнено:{" "}
              <b className="font-semibold text-foreground">{status.done}</b>
            </span>
            <span>
              Отменено:{" "}
              <b className="font-semibold text-foreground">{status.canceled}</b>
            </span>
          </div>

          <h2 className="mt-10 font-display text-base font-extrabold uppercase">
            Топ товаров за 30 дней
          </h2>
          {top.length === 0 ? (
            <p className="mt-3 text-[0.85rem] text-muted-foreground">
              За 30 дней продаж не было.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[0.85rem]">
                <thead>
                  <tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-3 font-medium">Товар</th>
                    <th className="py-2.5 pr-3 text-right font-medium">Продано</th>
                    <th className="py-2.5 pr-3 text-right font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t) => (
                    <tr key={t.slug} className="border-b border-border">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/admin/products/${t.slug}`}
                          className="font-medium transition-colors hover:text-signal"
                        >
                          {t.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                        {t.qty} шт
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right font-semibold">
                        {formatPrice(t.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
