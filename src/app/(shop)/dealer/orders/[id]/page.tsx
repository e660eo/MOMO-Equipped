import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageSquareText, Package, ReceiptText } from "lucide-react";
import { DealerCabinetShell } from "@/components/dealer-cabinet-shell";
import { DealerOrderProgress } from "@/components/dealer-order-progress";
import { DealerRepeatOrderButton } from "@/components/dealer-repeat-order-button";
import { currentDealer } from "@/lib/dealer-auth";
import { getDealerOrders } from "@/lib/dealers";
import {
  DEALER_ORDER_STATUS_LABELS,
  dealerOrderUnitCount,
} from "@/lib/dealer-order-ui";
import { formatPrice } from "@/lib/format";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Дилерский заказ", robots: { index: false, follow: false } };

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DealerOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");
  const { id } = await params;
  const order = getDealerOrders(session.account.id).find((item) => item.id === id);
  if (!order) notFound();

  return (
    <DealerCabinetShell session={session} active="orders">
      <Link href="/dealer/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-black/55 hover:text-[#d94700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]"><ArrowLeft size={16} aria-hidden /> Все заказы</Link>

      <section className="mt-3 rounded-[28px] border border-black/8 bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.17em] text-[#d94700]">Дилерский заказ</p>
            <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">{order.id}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-black/45"><CalendarDays size={15} aria-hidden /> Создан {formatDate(order.createdAt)}</p>
          </div>
          <div className="sm:text-right">
            <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${order.status === "canceled" ? "bg-red-50 text-red-700" : order.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-[#fff0e7] text-[#c44100]"}`}>{DEALER_ORDER_STATUS_LABELS[order.status]}</span>
            <p className="mt-3 text-3xl font-black">{formatPrice(order.total)}</p>
            <p className="mt-1 text-xs text-black/40">{order.items.length} {plural(order.items.length, "позиция", "позиции", "позиций")} · {dealerOrderUnitCount(order)} шт.</p>
          </div>
        </div>

        <div className="mt-8 border-y border-black/7 py-6"><DealerOrderProgress status={order.status} /></div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex items-center gap-3"><ReceiptText className="text-[#ff5500]" size={21} aria-hidden /><h3 className="font-display text-xl font-black uppercase">Состав заказа</h3></div>
            <div className="mt-4 divide-y divide-black/7 rounded-2xl border border-black/8">
              {order.items.map((item) => (
                <article key={item.slug} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_90px_120px] sm:items-center">
                  <div className="min-w-0">
                    <Link href={`/product/${item.slug}`} className="font-bold hover:text-[#d94700]">{item.title}</Link>
                    <p className="mt-1 truncate text-xs text-black/35">{item.slug}</p>
                  </div>
                  <p className="text-sm font-semibold sm:text-center">{item.qty} шт.</p>
                  <div className="col-span-2 text-right sm:col-span-1"><p className="font-black">{formatPrice(item.price * item.qty)}</p><p className="mt-0.5 text-[0.68rem] text-black/35">{formatPrice(item.price)} / шт.</p></div>
                </article>
              ))}
              <div className="flex items-center justify-between gap-4 bg-[#f6f6f4] px-4 py-4"><span className="text-sm font-semibold text-black/55">Итого</span><strong className="text-xl">{formatPrice(order.total)}</strong></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-black/40">Цены зафиксированы в момент отправки заказа. Итоговые условия отгрузки подтверждает менеджер.</p>
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-2xl bg-[#111214] p-5 text-white">
              <Package className="text-[#ff6a1f]" size={22} aria-hidden />
              <h3 className="mt-3 font-display text-xl font-black uppercase">Действия</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">Добавьте эти позиции в новый черновик. Недоступные товары будут исключены автоматически.</p>
              <DealerRepeatOrderButton items={order.items.map((item) => ({ slug: item.slug, qty: item.qty }))} className="mt-4 w-full border-white/15 bg-white/7 text-white hover:border-[#ff5500]" />
              <Link href="/dealer/order" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#ff5500] px-4 text-sm font-bold text-white">Открыть каталог</Link>
            </div>

            {order.comment && (
              <div className="rounded-2xl border border-black/8 bg-white p-5">
                <div className="flex items-center gap-2"><MessageSquareText className="text-[#ff5500]" size={19} aria-hidden /><h3 className="font-bold">Комментарий к заказу</h3></div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/55">{order.comment}</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="mt-6 rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
        <h3 className="font-display text-xl font-black uppercase">История статусов</h3>
        <ol className="mt-5 space-y-0">
          {order.history.slice().reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
              {index < order.history.length - 1 && <span aria-hidden className="absolute bottom-0 left-[9px] top-4 w-px bg-black/10" />}
              <span aria-hidden className={`relative mt-1.5 h-5 w-5 rounded-full border-4 border-white ${index === 0 ? "bg-[#ff5500]" : "bg-black/20"}`} />
              <div><p className="text-sm font-bold">{DEALER_ORDER_STATUS_LABELS[entry.to as keyof typeof DEALER_ORDER_STATUS_LABELS] ?? entry.to}</p><p className="mt-1 text-xs text-black/40">{formatDate(entry.at)} · {entry.actor}</p></div>
            </li>
          ))}
        </ol>
      </section>
    </DealerCabinetShell>
  );
}
