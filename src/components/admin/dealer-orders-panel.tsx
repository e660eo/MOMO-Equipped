import Link from "next/link";
import { Package } from "lucide-react";
import { getDealerLocation } from "@/lib/dealers";
import { getDealerOrderAgreement } from "@/lib/dealer-order-management";
import { getDealerOrderNotifications } from "@/lib/dealer-order-notifications";
import { formatPrice } from "@/lib/format";
import type { DealerOrder } from "@/lib/types";
import { setDealerOrderStatus } from "@/app/admin/dealers/actions";

const ORDER_LABELS = { new: "Новый", confirmed: "Подтверждён", shipped: "Отгружен", done: "Выполнен", canceled: "Отменён" } as const;

export function DealerOrdersPanel({ orders }: { orders: DealerOrder[] }) {
  const inputClass = "min-h-11 rounded-md border border-border bg-surface px-2 text-xs";
  return (
    <section id="dealer-orders" className="mt-5 scroll-mt-40 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3"><Package className="text-signal" size={21} /><div><h2 className="font-display text-lg font-extrabold uppercase">Дилерские заказы</h2><p className="text-xs text-muted-foreground">Заявки из кабинетов дилеров, согласование и статусы.</p></div></div>
      <div className="mt-5 space-y-3">{orders.map((order) => {
        const dealer = getDealerLocation(order.dealerId);
        const agreement = getDealerOrderAgreement(order.id);
        const items = agreement?.items ?? order.items;
        const notificationIssue = getDealerOrderNotifications(order.id).some((job) => job.error || job.status === "failed");
        return <article key={order.id} className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-signal">{ORDER_LABELS[order.status]} · {new Date(order.createdAt).toLocaleString("ru-RU")}</p><h3 className="mt-1 font-bold"><Link href={`/admin/dealers/orders/${encodeURIComponent(order.id)}`} className="text-signal hover:underline">{order.id} · {dealer?.name ?? "Дилер"}</Link></h3>{notificationIssue && <Link href={`/admin/dealers/orders/${encodeURIComponent(order.id)}`} className="mt-2 block text-xs font-bold text-red-600">Не удалось отправить уведомление — проверить</Link>}<p className="mt-1 text-xs text-muted-foreground">{items.map((item) => `${item.title} × ${item.qty}`).join("; ")}</p>{order.comment && <p className="mt-2 text-xs">Комментарий: {order.comment}</p>}</div>
          <div className="text-right"><p className="text-lg font-black">{formatPrice(agreement?.total ?? order.total)}</p>{agreement && <p className="mt-1 text-xs text-muted-foreground">Согласовано, с доставкой · версия {agreement.revision}</p>}<form action={setDealerOrderStatus} className="mt-2 flex gap-2"><input type="hidden" name="id" value={order.id} /><input type="hidden" name="expectedStatus" value={order.status} /><select className={inputClass} aria-label={`Статус заказа ${order.id}`} name="status" defaultValue={order.status}><option value="new">Новый</option><option value="confirmed">Подтверждён</option><option value="shipped">Отгружен</option><option value="done">Выполнен</option><option value="canceled">Отменён</option></select><button className="rounded-md bg-black px-3 text-xs font-bold text-white">Сохранить</button></form></div>
        </div></article>;
      })}{!orders.length && <p className="rounded-lg bg-black/[.025] p-6 text-center text-sm text-muted-foreground">Дилерские заказы появятся после отправки из кабинета.</p>}</div>
    </section>
  );
}
