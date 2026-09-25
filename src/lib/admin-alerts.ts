import { getAllProducts } from "./data";
import { getAdminOrders, getOrders } from "./orders";
import { getIntegrationJobs } from "./job-queue";
import { getDealerApplications, getDealerOrders } from "./dealers";
import { getDealerOrderNotes } from "./dealer-order-notes";
import { moscowDate } from "./dealer-order-worklist";
import { getAllDealerOrderNotifications } from "./dealer-order-notifications";
import { getDealerOrderAgreementVersions } from "./dealer-order-management";
import { getDealerStockReservations } from "./dealer-stock";

export interface AdminAlert {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export function getAdminAlerts(now = Date.now()): AdminAlert[] {
  const products = getAllProducts();
  const orders = getAdminOrders().filter((order) => !order.archivedAt);
  const allOrders = getOrders().filter((order) => !order.archivedAt);
  const jobs = getIntegrationJobs(500);
  const unknown = products.filter((p) => typeof p.stock !== "number" && p.inStock === undefined).length;
  const out = products.filter((p) => p.stock === 0).length;
  const low = products.filter((p) => typeof p.stock === "number" && p.stock > 0 && p.stock <= 3).length;
  const stale = orders.filter((o) => o.status === "new" && now - Date.parse(o.createdAt) > 2 * 60 * 60 * 1_000).length;
  const failedOzon = orders.filter((o) => o.delivery?.shipment?.status === "failed").length;
  const failedPayments = allOrders.filter((o) => o.payment?.status === "FAILED" || o.payment?.status === "VOIDED").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const alerts: AdminAlert[] = [];
  const failedDealerMail = getAllDealerOrderNotifications().filter((job) => job.status === "failed").length;
  if (failedDealerMail) alerts.push({ id: "dealer-mail-failed", level: "warning", title: `Не отправлены дилерские уведомления: ${failedDealerMail}`, detail: "Проверьте причину в журнале уведомлений и повторите отправку.", href: "/admin/notifications?view=errors" });
  const dealerOrders = getDealerOrders();
  const agreements = new Map(getDealerOrderAgreementVersions().map((item) => [item.orderId, item]));
  const reservedIds = new Set(getDealerStockReservations().filter((item) => item.status === "reserved").map((item) => item.orderId));
  const missingHolds = dealerOrders.filter((order) => ["new", "confirmed"].includes(order.status) && agreements.get(order.id)?.paymentStatus === "paid" && !reservedIds.has(order.id));
  if (missingHolds.length) alerts.push({ id: "dealer-missing-holds", level: "warning", title: `Оплаченные заказы без резерва: ${missingHolds.length}`, detail: "Проверьте остатки и повторно сохраните условия ранее оплаченных заказов, чтобы создать резерв.", href: "/admin/dealers/orders?view=ready" });
  const staleDealers = dealerOrders.filter((order) => order.status === "new" && now - Date.parse(order.createdAt) > 2 * 60 * 60 * 1000).length;
  if (staleDealers) alerts.push({ id: "stale-dealer-orders", level: "critical", title: `Дилерские заказы ждут больше 2 часов: ${staleDealers}`, detail: "Проверьте наличие и согласуйте условия с дилерами.", href: "/admin/dealers/orders?view=new" });
  const applications = getDealerApplications().filter((item) => item.status === "new" && !item.archivedAt).length;
  if (applications) alerts.push({ id: "dealer-applications", level: "info", title: `Новые заявки на дилерство: ${applications}`, detail: "Свяжитесь с кандидатами и обработайте заявки.", href: "/admin/dealers#dealer-applications" });
  const activeIds = new Set(dealerOrders.filter((order) => !["done", "canceled"].includes(order.status)).map((order) => order.id));
  const dueNotes = getDealerOrderNotes().filter((item) => activeIds.has(item.orderId) && item.followUpDate && item.followUpDate <= moscowDate(new Date(now).toISOString()));
  for (const item of dueNotes.slice(0, 10)) alerts.push({ id: `dealer-follow-up:${item.orderId}`, level: "info", title: `Связаться с дилером: ${item.orderId}`, detail: `Запланировано на ${item.followUpDate.split("-").reverse().join(".")}.`, href: `/admin/dealers/orders/${encodeURIComponent(item.orderId)}` });
  if (stale) alerts.push({ id: "stale-orders", level: "critical", title: `${stale} заказов ждут больше 2 часов`, detail: "Свяжитесь с покупателями и переведите заказы в работу.", href: "/admin/orders?status=new" });
  if (failedOzon) alerts.push({ id: "ozon-failed", level: "critical", title: `Ошибок Ozon: ${failedOzon}`, detail: "Откройте заказы и повторите отправку.", href: "/admin/orders?delivery=error" });
  if (failedJobs) alerts.push({ id: "jobs-failed", level: "critical", title: `Фоновые задачи остановились: ${failedJobs}`, detail: "Все автоматические попытки исчерпаны.", href: "/admin/settings#integrations" });
  if (out) alerts.push({ id: "out-of-stock", level: "warning", title: `Закончились товары: ${out}`, detail: "Обновите остатки или переведите товары в «Под заказ».", href: "/admin/products?availability=out" });
  if (low) alerts.push({ id: "low-stock", level: "warning", title: `Заканчиваются товары: ${low}`, detail: "Осталось от одной до трёх штук.", href: "/admin/products?availability=low" });
  if (unknown) alerts.push({ id: "unknown-stock", level: "warning", title: `Не указано наличие: ${unknown}`, detail: "Покупатель не видит срок доступности этих товаров.", href: "/admin/products?availability=unknown" });
  if (failedPayments) alerts.push({ id: "payment-failed", level: "info", title: `Неудачных оплат: ${failedPayments}`, detail: "Проверьте, нужна ли помощь покупателям.", href: "/admin/orders?payment=failed" });
  return alerts;
}
