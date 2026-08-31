import { getAllProducts } from "./data";
import { getAdminOrders, getOrders } from "./orders";
import { getIntegrationJobs } from "./job-queue";

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
  if (stale) alerts.push({ id: "stale-orders", level: "critical", title: `${stale} заказов ждут больше 2 часов`, detail: "Свяжитесь с покупателями и переведите заказы в работу.", href: "/admin/orders?status=new" });
  if (failedOzon) alerts.push({ id: "ozon-failed", level: "critical", title: `Ошибок Ozon: ${failedOzon}`, detail: "Откройте заказы и повторите отправку.", href: "/admin/orders?delivery=error" });
  if (failedJobs) alerts.push({ id: "jobs-failed", level: "critical", title: `Фоновые задачи остановились: ${failedJobs}`, detail: "Все автоматические попытки исчерпаны.", href: "/admin/settings#integrations" });
  if (out) alerts.push({ id: "out-of-stock", level: "warning", title: `Закончились товары: ${out}`, detail: "Обновите остатки или переведите товары в «Под заказ».", href: "/admin/products?availability=out" });
  if (low) alerts.push({ id: "low-stock", level: "warning", title: `Заканчиваются товары: ${low}`, detail: "Осталось от одной до трёх штук.", href: "/admin/products?availability=low" });
  if (unknown) alerts.push({ id: "unknown-stock", level: "warning", title: `Не указано наличие: ${unknown}`, detail: "Покупатель не видит срок доступности этих товаров.", href: "/admin/products?availability=unknown" });
  if (failedPayments) alerts.push({ id: "payment-failed", level: "info", title: `Неудачных оплат: ${failedPayments}`, detail: "Проверьте, нужна ли помощь покупателям.", href: "/admin/orders?payment=failed" });
  return alerts;
}
