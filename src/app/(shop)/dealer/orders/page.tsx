import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, PackageOpen } from "lucide-react";
import { DealerCabinetShell } from "@/components/dealer-cabinet-shell";
import { DealerOrderProgress } from "@/components/dealer-order-progress";
import { DealerRepeatOrderButton } from "@/components/dealer-repeat-order-button";
import { currentDealer } from "@/lib/dealer-auth";
import { getDealerOrders } from "@/lib/dealers";
import {
  DEALER_ORDER_STATUS_LABELS,
  dealerOrderLastUpdated,
  dealerOrderUnitCount,
  isDealerOrderOpen,
} from "@/lib/dealer-order-ui";
import { formatPrice } from "@/lib/format";
import type { DealerOrder } from "@/lib/types";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Мои дилерские заказы", robots: { index: false, follow: false } };

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function OrderCard({ order }: { order: DealerOrder }) {
  return (
    <article className="rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-black uppercase">{order.id}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${order.status === "canceled" ? "bg-red-50 text-red-700" : order.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-[#fff0e7] text-[#c44100]"}`}>{DEALER_ORDER_STATUS_LABELS[order.status]}</span>
          </div>
          <p className="mt-1 text-xs text-black/40">Создан {formatDate(order.createdAt)}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-black">{formatPrice(order.total)}</p>
          <p className="mt-1 text-xs text-black/40">{order.items.length} {plural(order.items.length, "позиция", "позиции", "позиций")} · {dealerOrderUnitCount(order)} шт.</p>
        </div>
      </div>

      <div className="mt-6"><DealerOrderProgress status={order.status} /></div>

      <div className="mt-6 rounded-xl bg-[#f6f6f4] px-4 py-3 text-sm text-black/60">
        {order.items.slice(0, 3).map((item) => <p key={`${order.id}-${item.slug}`} className="truncate">{item.title} × {item.qty}</p>)}
        {order.items.length > 3 && <p className="mt-1 text-xs font-semibold text-black/40">Ещё {order.items.length - 3} поз.</p>}
      </div>

      <div className="mt-5 flex flex-col justify-between gap-3 border-t border-black/7 pt-5 sm:flex-row sm:items-center">
        <p className="text-xs text-black/40">Последнее изменение: {formatDate(dealerOrderLastUpdated(order))}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <DealerRepeatOrderButton items={order.items.map((item) => ({ slug: item.slug, qty: item.qty }))} />
          <Link href={`/dealer/orders/${encodeURIComponent(order.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#111214] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">Подробнее <ArrowRight size={15} aria-hidden /></Link>
        </div>
      </div>
    </article>
  );
}

export default async function DealerOrdersPage() {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");
  const orders = getDealerOrders(session.account.id);
  const openOrders = orders.filter((order) => isDealerOrderOpen(order.status));
  const archivedOrders = orders.filter((order) => !isDealerOrderOpen(order.status));

  return (
    <DealerCabinetShell session={session} active="orders">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[#d94700]">Закупки</p>
        <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">Мои заказы</h2>
        <p className="mt-2 text-sm leading-6 text-black/55">Следите за движением заказа, открывайте полный состав или повторяйте закупку в один клик.</p>
      </div>

      {!orders.length ? (
        <section className="mt-7 rounded-[24px] border border-black/8 bg-white px-5 py-14 text-center">
          <PackageOpen className="mx-auto text-black/20" size={34} aria-hidden />
          <h3 className="mt-4 font-display text-2xl font-black uppercase">Заказов пока нет</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/50">Соберите первый заказ из закрытого каталога — после отправки здесь появится его статус.</p>
          <Link href="/dealer/order" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#ff5500] px-5 text-sm font-bold text-white">Собрать заказ</Link>
        </section>
      ) : (
        <div className="mt-7 grid gap-8 lg:grid-cols-2 lg:items-start">
          <section>
            <div className="flex items-center justify-between gap-4"><h3 className="font-display text-2xl font-black uppercase">В работе</h3><span className="rounded-full bg-[#ff5500] px-2.5 py-1 text-xs font-bold text-white">{openOrders.length}</span></div>
            <div className="mt-4 grid gap-4">{openOrders.map((order) => <OrderCard key={order.id} order={order} />)}{!openOrders.length && <p className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-sm text-black/45">Активных заказов сейчас нет.</p>}</div>
          </section>
          <section>
            <div className="flex items-center justify-between gap-4"><h3 className="font-display text-2xl font-black uppercase">Завершённые</h3><span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-bold">{archivedOrders.length}</span></div>
            <div className="mt-4 grid gap-4">{archivedOrders.map((order) => <OrderCard key={order.id} order={order} />)}{!archivedOrders.length && <p className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-sm text-black/45">Завершённые и отменённые заказы появятся здесь.</p>}</div>
          </section>
        </div>
      )}
    </DealerCabinetShell>
  );
}
