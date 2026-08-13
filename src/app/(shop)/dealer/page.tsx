import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileText, LogOut, MapPin, PackageCheck, ShoppingBag } from "lucide-react";
import { DealerOrderCatalog, type DealerCatalogItem } from "@/components/dealer-order-catalog";
import { currentDealer } from "@/lib/dealer-auth";
import { dealerPriceFor, getDealerOrders } from "@/lib/dealers";
import { getProducts } from "@/lib/data";
import { formatPrice, isInStock, productImageUrl } from "@/lib/format";
import { getSupportDocuments } from "@/lib/support-documents";
import { logoutDealer } from "./actions";

export const metadata: Metadata = { title: "Кабинет дилера", robots: { index: false, follow: false } };

const ORDER_LABELS = { new: "Новый", confirmed: "Подтверждён", shipped: "Отгружен", done: "Выполнен", canceled: "Отменён" } as const;
const CATEGORY_LABELS = { instruction: "Инструкция", scheme: "Схема", certificate: "Сертификат", warranty: "Гарантия", catalog: "Каталог", marketing: "Рекламные материалы" } as const;

export default async function DealerCabinetPage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");

  const products = getProducts().filter((product) => !product.isClearance);
  const catalog: DealerCatalogItem[] = products.map((product) => ({
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    category: product.category,
    image: productImageUrl(product.image),
    price: dealerPriceFor(product, session.account),
    stock: typeof product.stock === "number" ? product.stock : null,
    available: isInStock(product) !== false,
  }));
  const orders = getDealerOrders(session.account.id);
  const documents = getSupportDocuments("dealer");
  const activated = (await searchParams).activated === "1";

  return <main className="bg-[#f4f4f2] pb-20">
    <section className="bg-[#111214] text-white">
      <div className="mx-auto max-w-[1280px] px-5 py-10 sm:py-14">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff5500]">MOMO / ZEUS · партнёрская сеть</p><h1 className="mt-3 font-display text-4xl font-black uppercase tracking-[-.04em] sm:text-6xl">{session.dealer.name}</h1><p className="mt-3 flex items-center gap-2 text-sm text-white/50"><MapPin size={15} /> {session.dealer.city} · {session.account.contactName}</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/dealer/price.csv" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#ff5500] px-5 text-sm font-bold"><Download size={17} /> Скачать прайс</Link><form action={logoutDealer}><button className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white/65 hover:text-white"><LogOut size={17} /> Выйти</button></form></div>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1280px] px-5">
      {activated && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Добро пожаловать! Кабинет активирован, можно оформлять первый заказ.</p>}
      <section className="grid gap-3 py-7 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/7 bg-white p-5"><PackageCheck className="text-[#ff5500]" size={22} /><p className="mt-3 text-2xl font-black">{catalog.filter((item) => item.available).length}</p><p className="text-xs text-black/45">товаров доступны к заказу</p></div>
        <div className="rounded-2xl border border-black/7 bg-white p-5"><ShoppingBag className="text-[#ff5500]" size={22} /><p className="mt-3 text-2xl font-black">{orders.length}</p><p className="text-xs text-black/45">заказов в истории</p></div>
        <div className="rounded-2xl border border-black/7 bg-white p-5"><FileText className="text-[#ff5500]" size={22} /><p className="mt-3 text-2xl font-black">{documents.length}</p><p className="text-xs text-black/45">файлов и материалов</p></div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#ff5500]">Закрытый каталог</p><h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em]">Цены и остатки</h2></div><Link href="/dealer/price.csv" className="hidden text-sm font-bold text-[#ff5500] sm:block">Прайс в CSV →</Link></div>
        <DealerOrderCatalog products={catalog} />
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[24px] border border-black/8 bg-white p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-black uppercase">История заказов</h2><span className="text-xs text-black/40">{orders.length}</span></div>
          {orders.length ? <div className="mt-5 divide-y divide-black/7">{orders.map((order) => <article key={order.id} className="py-4 first:pt-0"><div className="flex items-center justify-between gap-4"><div><b>{order.id}</b><p className="mt-1 text-xs text-black/40">{new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })} · {order.items.reduce((sum, item) => sum + item.qty, 0)} шт.</p></div><div className="text-right"><span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{ORDER_LABELS[order.status]}</span><p className="mt-2 text-sm font-black">{formatPrice(order.total)}</p></div></div></article>)}</div> : <p className="mt-5 rounded-xl bg-[#f5f5f4] p-5 text-sm text-black/45">Здесь появятся отправленные заказы и их статусы.</p>}
        </div>

        <div className="rounded-[24px] border border-black/8 bg-white p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-black uppercase">Материалы</h2><Link href="/support" className="text-xs font-bold text-[#ff5500]">Центр поддержки →</Link></div>
          {documents.length ? <div className="mt-5 divide-y divide-black/7">{documents.map((document) => {
            const href = document.audience === "dealer" ? `/dealer/files/${document.id}` : productImageUrl(document.file);
            return <a key={document.id} href={href} download={document.originalName} className="group flex items-center justify-between gap-4 py-4 first:pt-0"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ff5500]">{CATEGORY_LABELS[document.category]}</p><b className="mt-1 block text-sm group-hover:text-[#ff5500]">{document.title}</b><p className="mt-1 text-xs text-black/35">{document.originalName} · {(document.size / 1024 / 1024).toFixed(1)} МБ</p></div><Download className="shrink-0 text-black/25 group-hover:text-[#ff5500]" size={19} /></a>;
          })}</div> : <p className="mt-5 rounded-xl bg-[#f5f5f4] p-5 text-sm text-black/45">Закрытые прайсы, сертификаты и рекламные материалы появятся здесь после загрузки менеджером.</p>}
        </div>
      </section>
    </div>
  </main>;
}
