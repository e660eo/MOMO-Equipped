import { requireSession } from "@/lib/admin-auth";
import { getDealerOrders } from "@/lib/dealers";
import { DealerOrdersPanel } from "@/components/admin/dealer-orders-panel";

export default async function AdminDealerOrdersPage() {
  await requireSession();
  const orders = getDealerOrders();
  return <div>
    <p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--signal-text)]">Дилеры</p>
    <h1 className="mt-2 font-display text-3xl font-extrabold uppercase">Заказы дилеров</h1>
    <p className="mt-2 text-sm text-muted-foreground">Откройте заказ, чтобы согласовать состав, доставку и оплату, прикрепить счёт и отправить сообщение дилеру.</p>
    <DealerOrdersPanel orders={orders} />
  </div>;
}
