"use client";

/*
  История заказов НА ЭТОМ УСТРОЙСТВЕ. Заказ уходит менеджеру в WhatsApp,
  сервера нет — поэтому здесь только локальная квитанция: что и когда
  сформировано с этого браузера. Статусов у заказа нет и не выдумываем.
*/

export interface LocalOrderItem {
  slug: string;
  title: string;
  price: number;
  qty: number;
}

export interface LocalOrder {
  id: string;
  date: string; // ISO
  total: number;
  items: LocalOrderItem[];
}

const KEY = "momo-orders";
const LIMIT = 50;

export function readOrders(): LocalOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalOrder[]) : [];
  } catch {
    return [];
  }
}

/** Записывает заказ первым в списке и возвращает его с номером и датой. */
export function recordOrder(
  order: Omit<LocalOrder, "id" | "date">,
): LocalOrder {
  const full: LocalOrder = {
    ...order,
    id: `MO-${Date.now().toString(36).toUpperCase()}`,
    date: new Date().toISOString(),
  };
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([full, ...readOrders()].slice(0, LIMIT)),
    );
  } catch {}
  return full;
}

export function clearOrders() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
