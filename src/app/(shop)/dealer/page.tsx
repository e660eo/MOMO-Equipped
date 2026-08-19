import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Clock3,
  FileText,
  Headphones,
  PackageCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { DealerCabinetShell } from "@/components/dealer-cabinet-shell";
import { DealerDraftSummary } from "@/components/dealer-draft-summary";
import { DealerOrderProgress } from "@/components/dealer-order-progress";
import { getB2BPriceBook } from "@/lib/b2b-prices";
import { currentDealer } from "@/lib/dealer-auth";
import { getDealerOrders } from "@/lib/dealers";
import {
  DEALER_ORDER_STATUS_LABELS,
  dealerOrderLastUpdated,
  dealerOrderUnitCount,
  isDealerOrderOpen,
} from "@/lib/dealer-order-ui";
import { getProducts, getSiteConfig } from "@/lib/data";
import { formatPrice, isInStock } from "@/lib/format";
import { getSupportDocuments } from "@/lib/support-documents";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Кабинет дилера", robots: { index: false, follow: false } };

function formatDate(value: string, withTime = false): string {
  return new Date(value).toLocaleString("ru-RU", withTime
    ? { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "long", year: "numeric" });
}

export default async function DealerCabinetPage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");

  const products = getProducts().filter((product) => !product.isClearance && !product.hidden);
  const orders = getDealerOrders(session.account.id);
  const openOrders = orders.filter((order) => isDealerOrderOpen(order.status));
  const documents = getSupportDocuments("dealer");
  const priceBook = getB2BPriceBook();
  const { contacts } = getSiteConfig();
  const availableCount = products.filter((product) => isInStock(product) !== false).length;
  const lowStockCount = products.filter((product) => typeof product.stock === "number" && product.stock > 0 && product.stock <= 5).length;
  const newCount = products.filter((product) => product.isNew).length;
  const focusOrder = openOrders[0] ?? orders[0];
  const activated = (await searchParams).activated === "1";

  return (
    <DealerCabinetShell session={session} active="overview">
      {activated && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Добро пожаловать! Кабинет активирован — можно оформить первый заказ.
        </p>
      )}

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.17em] text-[#d94700]">Рабочий обзор</p>
          <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">Добрый день, {session.account.contactName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">Здесь видно, что требует внимания: заказы в работе, актуальность прайса и быстрый переход к новой закупке.</p>
        </div>
        <Link href="/dealer/order" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-5 text-sm font-bold text-white transition-colors hover:bg-[#ff6a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111214]">
          <ShoppingCart size={18} aria-hidden /> Новый заказ
        </Link>
      </section>

      <div className="mt-6"><DealerDraftSummary /></div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/dealer/order" className="group rounded-2xl border border-black/7 bg-white p-5 transition-colors hover:border-[#ff5500]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">
          <PackageCheck className="text-[#ff5500]" size={22} aria-hidden />
          <p className="mt-3 text-2xl font-black">{availableCount}</p>
          <p className="mt-1 text-sm text-black/50">{plural(availableCount, "товар доступен", "товара доступны", "товаров доступны")} к заказу</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#d94700]">Открыть каталог <ArrowRight size={14} aria-hidden /></span>
        </Link>
        <Link href="/dealer/orders" className="group rounded-2xl border border-black/7 bg-white p-5 transition-colors hover:border-[#ff5500]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">
          <Clock3 className="text-[#ff5500]" size={22} aria-hidden />
          <p className="mt-3 text-2xl font-black">{openOrders.length}</p>
          <p className="mt-1 text-sm text-black/50">{plural(openOrders.length, "заказ сейчас", "заказа сейчас", "заказов сейчас")} в работе</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#d94700]">Посмотреть статусы <ArrowRight size={14} aria-hidden /></span>
        </Link>
        <Link href="/dealer/materials" className="group rounded-2xl border border-black/7 bg-white p-5 transition-colors hover:border-[#ff5500]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">
          <FileText className="text-[#ff5500]" size={22} aria-hidden />
          <p className="mt-3 text-2xl font-black">{documents.length}</p>
          <p className="mt-1 text-sm text-black/50">{plural(documents.length, "материал доступен", "материала доступны", "материалов доступно")}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#d94700]">Открыть материалы <ArrowRight size={14} aria-hidden /></span>
        </Link>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
        <div className="rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94700]">{focusOrder && isDealerOrderOpen(focusOrder.status) ? "Сейчас в работе" : "Последний заказ"}</p>
              <h3 className="mt-1 font-display text-2xl font-black uppercase">{focusOrder ? focusOrder.id : "Заказов пока нет"}</h3>
            </div>
            {focusOrder && <p className="text-right"><strong className="block text-xl">{formatPrice(focusOrder.total)}</strong><span className="text-xs text-black/40">{dealerOrderUnitCount(focusOrder)} шт.</span></p>}
          </div>

          {focusOrder ? (
            <>
              <div className="mt-7"><DealerOrderProgress status={focusOrder.status} /></div>
              <div className="mt-6 flex flex-col justify-between gap-4 border-t border-black/7 pt-5 sm:flex-row sm:items-center">
                <p className="text-sm text-black/50">Обновлён {formatDate(dealerOrderLastUpdated(focusOrder), true)}</p>
                <Link href={`/dealer/orders/${encodeURIComponent(focusOrder.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#111214] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">Открыть заказ <ArrowRight size={15} aria-hidden /></Link>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-xl bg-[#f5f5f4] p-5">
              <p className="text-sm leading-6 text-black/55">Соберите первый заказ из закрытого каталога. Цены и остатки уже рассчитаны по вашим условиям.</p>
              <Link href="/dealer/order" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#111214] px-4 text-sm font-bold text-white">Собрать заказ <ArrowRight size={15} aria-hidden /></Link>
            </div>
          )}
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[24px] bg-[#111214] p-5 text-white sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff6a1f]">Актуальность</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-sm text-white/60"><Boxes size={17} aria-hidden />Прайс</span><b className="text-sm">{priceBook.updatedAt ? formatDate(priceBook.updatedAt) : "Базовые условия"}</b></div>
              <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-sm text-white/60"><Sparkles size={17} aria-hidden />Новинки</span><b>{newCount}</b></div>
              <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-sm text-white/60"><PackageCheck size={17} aria-hidden />Мало на складе</span><b>{lowStockCount}</b></div>
            </div>
            <Link href="/dealer/price.csv" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 hover:border-white/30 hover:text-white">Скачать свежий CSV</Link>
          </div>

          <div className="rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
            <Headphones className="text-[#ff5500]" size={22} aria-hidden />
            <h3 className="mt-3 font-display text-xl font-black uppercase">Нужна помощь?</h3>
            <p className="mt-2 text-sm leading-6 text-black/50">Менеджер поможет с наличием, совместимостью и отгрузкой.</p>
            <div className="mt-4 grid gap-2 text-sm font-semibold">
              <a href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center text-[#d94700] hover:underline">{contacts.phone}</a>
              <a href={`mailto:${contacts.email}`} className="inline-flex min-h-11 items-center text-[#d94700] hover:underline">{contacts.email}</a>
            </div>
          </div>
        </aside>
      </section>

      {orders.length > 1 && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d94700]">История</p><h3 className="mt-1 font-display text-2xl font-black uppercase">Недавние заказы</h3></div><Link href="/dealer/orders" className="text-sm font-bold text-[#d94700]">Все заказы →</Link></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {orders.slice(0, 3).map((order) => (
              <Link key={order.id} href={`/dealer/orders/${encodeURIComponent(order.id)}`} className="rounded-2xl border border-black/8 bg-white p-5 hover:border-[#ff5500]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">
                <div className="flex items-start justify-between gap-3"><b>{order.id}</b><span className="rounded-full bg-black/5 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide">{DEALER_ORDER_STATUS_LABELS[order.status]}</span></div>
                <p className="mt-4 text-xl font-black">{formatPrice(order.total)}</p>
                <p className="mt-1 text-xs text-black/40">{formatDate(order.createdAt)} · {dealerOrderUnitCount(order)} шт.</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </DealerCabinetShell>
  );
}
