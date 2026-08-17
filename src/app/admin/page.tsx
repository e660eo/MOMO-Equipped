import Link from "next/link";
import { AlertTriangle, ArrowRight, PackagePlus, RefreshCw, ShoppingBag } from "lucide-react";
import { getAllProducts } from "@/lib/data";
import { isRepoData } from "@/lib/store";
import { requireAdminPage } from "@/lib/admin-auth";
import { getAdminOrders } from "@/lib/orders";
import { lastMailResult } from "@/lib/mailer";
import { getHealthReport } from "@/lib/health";
import { hasOzonTokens, isOzonOAuthConfigured } from "@/lib/ozon-auth";
import { getAdminAlerts } from "@/lib/admin-alerts";
import { getIntegrationJobs } from "@/lib/job-queue";
import { formatPrice } from "@/lib/format";
import { countWaitingSupportConversations } from "@/lib/support-conversations";

function moscowDay(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
export default async function AdminHomePage() {
  await requireAdminPage();
  const products = getAllProducts();
  const orders = getAdminOrders();
  const today = moscowDay(new Date().toISOString());
  const todayOrders = orders.filter((order) => moscowDay(order.createdAt) === today && order.status !== "canceled");
  const grossToday = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const paidToday = todayOrders.filter((order) => order.payment?.status === "CAPTURED" && !order.payment.sandbox).reduce((sum, order) => sum + (order.payment?.amount ?? 0), 0);
  const average = todayOrders.length ? Math.round(grossToday / todayOrders.length) : 0;
  const lowStock = products.filter((product) => typeof product.stock === "number" && product.stock > 0 && product.stock <= 3).length;
  const waitingSupport = countWaitingSupportConversations();
  const alerts = getAdminAlerts();
  const jobs = getIntegrationJobs(500);
  const pendingJobs = jobs.filter((job) => job.status === "pending" || job.status === "running").length;
  const mail = lastMailResult();
  const health = await getHealthReport();
  const healthFail = health.status === "fail" ? health.checks.filter((check) => check.level === "fail") : [];
  const ozonConfigured = isOzonOAuthConfigured();
  const ozonConnected = ozonConfigured && hasOzonTokens();
  const metrics = [
    { label: "Заказы сегодня", value: String(todayOrders.length), note: `${orders.filter((order) => order.status === "new").length} ждут обработки`, href: "/admin/orders?status=new" },
    { label: "Сумма заказов", value: formatPrice(grossToday), note: "без отменённых", href: "/admin/sales" },
    { label: "Получено оплат", value: formatPrice(paidToday), note: "боевые оплаты на сайте", href: "/admin/orders?payment=paid" },
    { label: "Средний чек", value: formatPrice(average), note: "по заказам сегодня", href: "/admin/sales" },
    { label: "Заканчивается", value: String(lowStock), note: "остаток от 1 до 3", href: "/admin/products?availability=low" },
    { label: "Фоновые задачи", value: String(pendingJobs), note: pendingJobs ? "в очереди или выполняются" : "очередь свободна", href: "/admin/settings#integrations" },
    { label: "Чаты поддержки", value: String(waitingSupport), note: waitingSupport ? "клиенты ждут ответа" : "все обращения обработаны", href: "/admin/messages" },
  ];

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-signal">Рабочий центр MOMO</p><h1 className="mt-1 font-display text-2xl font-extrabold uppercase">Сегодня в магазине</h1><p className="mt-1 text-[0.85rem] text-muted-foreground">Продажи, остатки и интеграции в одном месте.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/products/new" className="inline-flex items-center gap-2 rounded-sm bg-signal px-4 py-2.5 text-[0.82rem] font-semibold text-white"><PackagePlus size={16} /> Добавить товар</Link><Link href="/admin/orders?status=new" className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-[0.82rem] font-semibold hover:border-signal"><ShoppingBag size={16} /> Обработать заказы</Link><Link href="/admin/products?availability=unknown" className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-[0.82rem] font-semibold hover:border-signal"><RefreshCw size={16} /> Обновить остатки</Link></div></div>

    {process.env.NODE_ENV === "production" && isRepoData() && <p className="mt-5 rounded-sm border border-signal px-4 py-3 text-[0.85rem] text-signal">Не задана постоянная папка данных MOMO_DATA_DIR. Правки могут пропасть после обновления сайта.</p>}
    {(healthFail.length > 0 || mail && !mail.ok) && <div className="mt-5 rounded-sm border border-signal bg-signal/5 px-4 py-3 text-[0.85rem] text-[var(--signal-text)]"><p className="font-semibold">Техническое состояние требует внимания</p><ul className="mt-2 list-disc space-y-1 pl-5">{healthFail.map((check) => <li key={check.id}>{check.label}: {check.detail}</li>)}{mail && !mail.ok && <li>Последнее письмо не отправлено: {mail.error}</li>}</ul><Link href="/admin/settings#health" className="mt-2 inline-block underline">Открыть состояние системы</Link></div>}

    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <Link key={metric.label} href={metric.href} className="group rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-signal"><p className="font-display text-2xl font-extrabold tabular-nums">{metric.value}</p><p className="mt-1 font-medium">{metric.label}</p><p className="mt-0.5 text-[0.75rem] text-muted-foreground">{metric.note}</p><ArrowRight size={16} className="mt-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-signal" /></Link>)}</div>

    <section className="mt-7 rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-base font-extrabold uppercase">Требует внимания</h2><p className="mt-1 text-[0.78rem] text-muted-foreground">Список обновляется автоматически по данным магазина.</p></div><span className="rounded-full bg-signal/10 px-3 py-1 text-[0.78rem] font-semibold text-signal">{alerts.length}</span></div>{alerts.length === 0 ? <p className="mt-5 rounded-sm border border-green-600/30 bg-green-600/5 px-4 py-3 text-[0.85rem] text-green-700">Критичных событий нет. Заказы и интеграции работают штатно.</p> : <div className="mt-4 grid gap-2">{alerts.map((alert) => <Link key={alert.id} href={alert.href} className="flex items-start gap-3 rounded-sm border border-border px-4 py-3 hover:border-signal"><AlertTriangle size={17} className={alert.level === "critical" ? "mt-0.5 shrink-0 text-signal" : "mt-0.5 shrink-0 text-amber-600"} /><span className="min-w-0 flex-1"><span className="block text-[0.85rem] font-semibold">{alert.title}</span><span className="mt-0.5 block text-[0.75rem] text-muted-foreground">{alert.detail}</span></span><ArrowRight size={15} className="mt-1 shrink-0 text-muted-foreground" /></Link>)}</div>}</section>

    <section id="integrations" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4"><div><p className="font-semibold">Ozon Доставка</p><p className="mt-0.5 text-[0.78rem] text-muted-foreground">{!ozonConfigured ? "OAuth-реквизиты не добавлены." : ozonConnected ? "Подключена, токен защищён." : "Нужно разрешить доступ в Ozon."}</p></div>{ozonConfigured && !ozonConnected ? <a href="/api/ozon/oauth/start" className="rounded-sm bg-signal px-4 py-2 text-[0.82rem] font-semibold text-white">Подключить Ozon</a> : <span className={`rounded-full border px-3 py-1 text-[0.78rem] font-semibold ${ozonConnected ? "border-green-600/40 text-green-700" : "border-border text-muted-foreground"}`}>{ozonConnected ? "Подключена" : "Не подключена"}</span>}</section>
  </div>;
}
