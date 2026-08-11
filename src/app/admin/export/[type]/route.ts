import { hasSession } from "@/lib/admin-auth";
import { getAdminOrders, STATUS_LABELS } from "@/lib/orders";
import { getCustomers } from "@/lib/customers";
import { PAYMENT_LABELS } from "@/lib/yandex-pay";
import { toCsv } from "@/lib/csv";

/*
  Выгрузка в CSV для бухгалтерии: /admin/export/orders и /admin/export/customers.

  Роут под /admin — middleware отсекает запросы без куки, но подпись проверяется
  здесь (hasSession): у роут-хендлера, в отличие от серверного действия, своей
  проверки нет. Файл отдаём с BOM, чтобы Excel не ломал кириллицу.
*/

function ordersCsv(): string {
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
      "Сумма, ₽",
      "Оплата",
      "Комментарий",
    ],
  ];
  for (const o of getAdminOrders()) {
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
      o.total,
      o.payment ? PAYMENT_LABELS[o.payment.status] : "",
      o.customer.comment ?? "",
    ]);
  }
  return toCsv(rows);
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
    ]);
  }
  return toCsv(rows);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  if (!(await hasSession())) {
    return new Response("Forbidden", { status: 403 });
  }

  const { type } = await params;
  const today = new Date().toISOString().slice(0, 10);

  let csv: string;
  let name: string;
  if (type === "orders") {
    csv = ordersCsv();
    name = `orders-${today}.csv`;
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
