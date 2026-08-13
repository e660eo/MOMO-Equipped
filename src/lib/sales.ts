import { getAdminOrders } from "./orders";
import type { Order, OrderStatus } from "./types";

/*
  Сводка продаж для панели.

  Выручку считаем по заказам БЕЗ отменённых. Онлайн-оплата не подключена,
  поэтому это суммы оформленных заказов, а не подтверждённые деньги — так и
  подписано на странице, чтобы владелец не принял одно за другое.
*/

export interface PeriodStat {
  label: string;
  revenue: number;
  orders: number;
  avg: number;
}

export interface TopProduct {
  slug: string;
  title: string;
  qty: number;
  revenue: number;
}

export type StatusCounts = Record<OrderStatus, number>;

export interface SalesSummary {
  periods: PeriodStat[];
  top: TopProduct[];
  status: StatusCounts;
  hasOrders: boolean;
}

export interface RangeSales {
  from: string;
  to: string;
  orders: Order[];
  gross: number;
  paid: number;
  canceled: number;
  avg: number;
  previousGross: number;
  previousPaid: number;
  top: TopProduct[];
}

const DAY = 86_400_000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

/** Начало сегодняшнего дня по Москве (UTC+3, без перехода) как UTC-метка. */
function moscowTodayIso(): string {
  const shifted = new Date(Date.now() + 3 * 3_600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 3 * 3_600_000).toISOString();
}

function stat(label: string, orders: Order[]): PeriodStat {
  const active = orders.filter((o) => o.status !== "canceled");
  const revenue = active.reduce((sum, o) => sum + o.total, 0);
  return {
    label,
    revenue,
    orders: active.length,
    avg: active.length ? Math.round(revenue / active.length) : 0,
  };
}

export function salesSummary(): SalesSummary {
  const all = getAdminOrders();
  const today = moscowTodayIso();
  const d7 = daysAgoIso(7);
  const d30 = daysAgoIso(30);

  const periods = [
    stat("Сегодня", all.filter((o) => o.createdAt >= today)),
    stat("7 дней", all.filter((o) => o.createdAt >= d7)),
    stat("30 дней", all.filter((o) => o.createdAt >= d30)),
    stat("Всё время", all),
  ];

  // Топ товаров за 30 дней: суммируем количество и выручку по позициям.
  const recent = all.filter(
    (o) => o.status !== "canceled" && o.createdAt >= d30,
  );
  const map = new Map<string, TopProduct>();
  for (const o of recent) {
    for (const it of o.items) {
      const cur =
        map.get(it.slug) ?? { slug: it.slug, title: it.title, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.price * it.qty;
      map.set(it.slug, cur);
    }
  }
  const top = [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const status: StatusCounts = { new: 0, in_work: 0, done: 0, canceled: 0 };
  for (const o of all) status[o.status] += 1;

  return { periods, top, status, hasOrders: all.length > 0 };
}

function rangeOrders(all: Order[], from: string, to: string): Order[] {
  return all.filter((order) => order.createdAt.slice(0, 10) >= from && order.createdAt.slice(0, 10) <= to);
}

function gross(orders: Order[]): number {
  return orders.filter((order) => order.status !== "canceled").reduce((sum, order) => sum + order.total, 0);
}

function paid(orders: Order[]): number {
  return orders.filter((order) => order.payment?.status === "CAPTURED" && !order.payment.sandbox).reduce((sum, order) => sum + (order.payment?.amount ?? 0), 0);
}

export function salesRange(from: string, to: string): RangeSales {
  const all = getAdminOrders();
  const orders = rangeOrders(all, from, to);
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const previousToDate = new Date(start.getTime() - DAY);
  const previousFromDate = new Date(previousToDate.getTime() - (days - 1) * DAY);
  const previous = rangeOrders(all, previousFromDate.toISOString().slice(0, 10), previousToDate.toISOString().slice(0, 10));
  const active = orders.filter((order) => order.status !== "canceled");
  const map = new Map<string, TopProduct>();
  for (const order of active) for (const item of order.items) {
    const current = map.get(item.slug) ?? { slug: item.slug, title: item.title, qty: 0, revenue: 0 };
    current.qty += item.qty;
    current.revenue += item.price * item.qty;
    map.set(item.slug, current);
  }
  const grossValue = gross(orders);
  return {
    from, to, orders, gross: grossValue, paid: paid(orders),
    canceled: orders.filter((order) => order.status === "canceled").reduce((sum, order) => sum + order.total, 0),
    avg: active.length ? Math.round(grossValue / active.length) : 0,
    previousGross: gross(previous), previousPaid: paid(previous),
    top: [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  };
}
