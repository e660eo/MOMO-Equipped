import { readJson, writeJson, assertWritable } from "./store";
import type { Order, OrderStatus } from "./types";

/*
  Заказы с сайта.

  Лежат в папке данных рядом с каталогом — отдельным файлом, чтобы правки
  каталога и поток заказов не спорили за одну запись. Внутри персональные
  данные покупателя, поэтому наружу они не отдаются никогда: только панель.
*/

const FILE = "orders.json";

export function getOrders(): Order[] {
  try {
    return readJson<Order[]>(FILE);
  } catch {
    // Файла ещё нет — заказов просто не было
    return [];
  }
}

export function getOrder(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

/**
 * Номер заказа: день, месяц и порядковый номер за этот день — «2607-003».
 * Такой проще продиктовать по телефону, чем случайный набор символов.
 */
function nextId(orders: Order[]): string {
  const now = new Date();
  const prefix = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayCount = orders.filter((o) => o.id.startsWith(`${prefix}-`)).length;
  return `${prefix}-${String(todayCount + 1).padStart(3, "0")}`;
}

export function addOrder(order: Omit<Order, "id" | "createdAt" | "status">): Order {
  assertWritable();
  const orders = getOrders();
  const full: Order = {
    ...order,
    id: nextId(orders),
    createdAt: new Date().toISOString(),
    status: "new",
  };
  // Свежие сверху: в панели интересны именно они
  writeJson(FILE, [full, ...orders]);
  return full;
}

export function updateOrder(
  id: string,
  patch: { status?: OrderStatus; note?: string },
): void {
  assertWritable();
  const orders = getOrders();
  writeJson(
    FILE,
    orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  );
}

/** Сколько заказов ждут обработки — для счётчика в панели. */
export function countNewOrders(): number {
  return getOrders().filter((o) => o.status === "new").length;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  in_work: "В работе",
  done: "Выполнен",
  canceled: "Отменён",
};
