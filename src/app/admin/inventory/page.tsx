import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getAllProducts } from "@/lib/data";
import { getOrders } from "@/lib/orders";
import { orderItemsForFulfillment } from "@/lib/bundle-cart";
import { getDealerStockReservations } from "@/lib/dealer-stock";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; page?: string }> }) {
  await requireAdminPage();
  const params = await searchParams;
  const reservations = getDealerStockReservations().filter((item) => item.status === "reserved");
  const retail = new Map<string, number>();
  for (const order of getOrders().filter((order) => order.stockDeducted && ["new", "in_work"].includes(order.status))) {
    for (const item of orderItemsForFulfillment(order.items)) retail.set(item.slug, (retail.get(item.slug) ?? 0) + item.qty);
  }
  const q = params.q?.trim().toLocaleLowerCase("ru") ?? "";
  const products = getAllProducts().map((product) => {
    const holds = reservations.flatMap((order) => order.items.filter((item) => item.slug === product.slug).map((item) => ({ id: order.orderId, qty: item.qty })));
    const dealer = holds.reduce((sum, item) => sum + item.qty, 0);
    const shop = retail.get(product.slug) ?? 0;
    return { ...product, holds, dealer, shop };
  }).filter((product) => (!q || `${product.title} ${product.slug}`.toLocaleLowerCase("ru").includes(q)) && (params.view !== "reserved" || product.dealer + product.shop > 0) && (params.view !== "unknown" || typeof product.stock !== "number"));
  const pages = Math.max(1, Math.ceil(products.length / 40));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.page) || 1)));
  const url = (next: number) => `/admin/inventory?${new URLSearchParams({ q: params.q ?? "", view: params.view ?? "", page: String(next) })}`;
  return <div>
    <h1 className="font-display text-3xl font-extrabold uppercase">Остатки и резервы</h1>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Дилерский резерв появляется после подтверждения полной оплаты. Отмена освобождает товар, отгрузка списывает резерв. «На складе» — расчётный остаток: доступное количество плюс действующие резервы.</p>
    <form className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <label className="w-full min-w-0 text-xs font-semibold sm:w-auto sm:flex-1">Товар<input name="q" defaultValue={params.q} maxLength={200} placeholder="Название или модель" className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm" /></label>
      <label className="text-xs font-semibold">Показать<select name="view" defaultValue={params.view} className="mt-1 block min-h-11 rounded-lg border border-border bg-bg px-3 text-sm"><option value="">Все товары</option><option value="reserved">С резервом</option><option value="unknown">Без числового остатка</option></select></label>
      <button className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-bold text-bg">Найти</button>
    </form>
    <p className="mt-4 text-sm text-muted-foreground">Найдено: {products.length}. Остаток в карточке товара указывается без резервов.</p>
    <div className="mt-3 grid gap-3 xl:grid-cols-2">{products.slice((page - 1) * 40, page * 40).map((product) => <article key={product.slug} className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <h2 className="break-words text-sm font-bold"><Link className="hover:underline" href={`/admin/products/${encodeURIComponent(product.slug)}`}>{product.title}</Link></h2>
      {typeof product.stock === "number" ? <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["На складе", product.stock + product.dealer + product.shop], ["Резерв дилеров", product.dealer], ["Резерв розницы", product.shop], ["Доступно", product.stock]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd></div>)}</dl> : <p className="mt-3 text-sm text-muted-foreground">Числовой остаток не указан. Заполните его в карточке перед подтверждением оплаты дилерского заказа.</p>}
      {product.holds.length > 0 && <div className="mt-3 flex flex-wrap gap-x-4">{product.holds.map((hold) => <Link key={hold.id} href={`/admin/dealers/orders/${encodeURIComponent(hold.id)}`} className="inline-flex min-h-11 items-center text-xs text-signal underline">{hold.id}: {hold.qty} шт.</Link>)}</div>}
    </article>)}</div>
    {!products.length && <p className="mt-4 text-sm text-muted-foreground">По этим условиям товаров нет.</p>}
    {pages > 1 && <nav aria-label="Страницы остатков" className="mt-4 flex items-center gap-4">{page > 1 && <Link className="inline-flex min-h-11 items-center underline" href={url(page - 1)}>← Назад</Link>}<span>{page} / {pages}</span>{page < pages && <Link className="inline-flex min-h-11 items-center underline" href={url(page + 1)}>Далее →</Link>}</nav>}
  </div>;
}
