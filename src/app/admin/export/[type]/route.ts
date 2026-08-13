import { hasSession } from "@/lib/admin-auth";
import { getAdminOrders, STATUS_LABELS } from "@/lib/orders";
import { getCustomers } from "@/lib/customers";
import { PAYMENT_LABELS, isPaid } from "@/lib/yandex-pay";
import { toCsv } from "@/lib/csv";
import { salesRange } from "@/lib/sales";
import type { Order } from "@/lib/types";
import { getBonusSummary } from "@/lib/bonus-ledger";

/*
  Выгрузка в CSV для бухгалтерии: /admin/export/orders и /admin/export/customers.

  Роут под /admin — middleware отсекает запросы без куки, но подпись проверяется
  здесь (hasSession): у роут-хендлера, в отличие от серверного действия, своей
  проверки нет. Файл отдаём с BOM, чтобы Excel не ломал кириллицу.
*/

function ordersCsv(orders: Order[]): string {
  const rows: (string | number)[][] = [
    [
      "Номер",
      "Дата",
      "Статус",
      "Покупатель",
      "Телефон",
      "Адрес",
      "Состав",
      "Промокод",
      "Скидка, ₽",
      "Бонусы, ₽",
      "Сумма, ₽",
      "Оплата",
      "Комментарий",
    ],
  ];
  for (const o of orders) {
    rows.push([
      o.id,
      new Date(o.createdAt).toLocaleString("ru-RU"),
      STATUS_LABELS[o.status],
      o.customer.name,
      o.customer.phone,
      o.customer.address,
      o.items.map((i) => `${i.title} ×${i.qty}`).join("; "),
      o.promo?.code ?? "",
      o.promo?.discount ?? "",
      o.bonus?.spent ?? "",
      o.total,
      o.payment ? PAYMENT_LABELS[o.payment.status] : "",
      o.customer.comment ?? "",
    ]);
  }
  return toCsv(rows);
}

function filteredOrders(url: URL): Order[] {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "";
  const payment = url.searchParams.get("payment") ?? "";
  const delivery = url.searchParams.get("delivery") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  return getAdminOrders().filter((order) => {
    if (status && order.status !== status) return false;
    if (q && ![order.id, order.customer.name, order.customer.phone].join(" ").toLowerCase().includes(q)) return false;
    if (from && order.createdAt.slice(0, 10) < from) return false;
    if (to && order.createdAt.slice(0, 10) > to) return false;
    if (payment === "paid" && (!order.payment || !isPaid(order.payment.status))) return false;
    if (payment === "unpaid" && order.payment && isPaid(order.payment.status)) return false;
    if (payment === "failed" && order.payment?.status !== "FAILED" && order.payment?.status !== "VOIDED") return false;
    if (delivery === "error" && order.delivery?.shipment?.status !== "failed") return false;
    if (delivery === "ozon" && !order.delivery) return false;
    if (delivery === "none" && order.delivery) return false;
    return true;
  });
}

function salesCsv(from: string, to: string): string {
  const report = salesRange(from, to);
  return toCsv([
    ["Период", "Заказов", "Сумма заказов, ₽", "Оплачено, ₽", "Отменено, ₽", "Средний чек, ₽"],
    [`${from} — ${to}`, report.orders.length, report.gross, report.paid, report.canceled, report.avg],
    [],
    ["Товар", "Количество", "Сумма, ₽"],
    ...report.top.map((item) => [item.title, item.qty, item.revenue]),
  ]);
}

function customersCsv(): string {
  const orders = getAdminOrders();
  const rows: (string | number)[][] = [
    [
      "Имя",
      "Email",
      "Телефон",
      "Адрес",
      "Регистрация",
      "Последний вход",
      "Заказов",
      "Куплено на, ₽",
      "Бонусный баланс",
      "Сегменты",
      "Заметка менеджера",
    ],
  ];
  const date = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU") : "";
  for (const c of getCustomers()) {
    const mine = orders.filter((o) => o.customerId === c.id);
    const spent = mine
      .filter((o) => o.status !== "canceled")
      .reduce((sum, o) => sum + o.total, 0);
    rows.push([
      c.name,
      c.email,
      c.phone,
      c.address ?? "",
      date(c.createdAt),
      date(c.lastLoginAt),
      mine.length,
      spent,
      getBonusSummary(c.id).balance,
      c.admin?.tags?.join(", ") ?? "",
      c.admin?.note ?? "",
    ]);
  }
  return toCsv(rows);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  if (!(await hasSession())) {
    return new Response("Forbidden", { status: 403 });
  }

  const { type } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const url = new URL(req.url);

  let csv: string;
  let name: string;
  if (type === "orders") {
    csv = ordersCsv(filteredOrders(url));
    name = `orders-${today}.csv`;
  } else if (type === "sales") {
    const from = url.searchParams.get("from") || today;
    const to = url.searchParams.get("to") || today;
    csv = salesCsv(from, to);
    name = `sales-${from}-${to}.csv`;
  } else if (type === "customers") {
    csv = customersCsv();
    name = `customers-${today}.csv`;
  } else {
    return new Response("Not found", { status: 404 });
  }

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
