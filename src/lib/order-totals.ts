import type { Order, OrderItem } from "./types";

export function orderItemsSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/** Стоимость товаров после промокода и бонусов, без доставки. */
export function orderGoodsPayable(order: Pick<Order, "items" | "promo" | "bonus">): number {
  return Math.max(
    0,
    orderItemsSubtotal(order.items) - (order.promo?.discount ?? 0) - (order.bonus?.spent ?? 0),
  );
}

export function orderGoodsFactor(order: Pick<Order, "items" | "promo" | "bonus">): number {
  const subtotal = orderItemsSubtotal(order.items);
  return subtotal > 0 ? orderGoodsPayable(order) / subtotal : 0;
}

/**
 * Распределяет скидки по строкам чека до копейки. Остаток округления уходит в
 * последнюю строку, поэтому сумма позиций всегда равна сумме заказа.
 */
export function allocatedGoodsLineTotals(
  order: Pick<Order, "items" | "promo" | "bonus">,
): number[] {
  const subtotal = orderItemsSubtotal(order.items);
  if (subtotal <= 0) return order.items.map(() => 0);
  const targetCents = Math.round(orderGoodsPayable(order) * 100);
  let allocated = 0;
  return order.items.map((item, index) => {
    const cents = index === order.items.length - 1
      ? targetCents - allocated
      : Math.round(targetCents * (item.price * item.qty) / subtotal);
    allocated += cents;
    return cents / 100;
  });
}
