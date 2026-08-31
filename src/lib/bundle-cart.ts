import type { OrderItem } from "./types";

export const BUNDLE_CART_PREFIX = "bundle:";

export function bundleCartSlug(slug: string): string {
  return `${BUNDLE_CART_PREFIX}${slug}`;
}

export function bundleSlugFromCart(slug: string): string | null {
  if (!slug.startsWith(BUNDLE_CART_PREFIX)) return null;
  const bundleSlug = slug.slice(BUNDLE_CART_PREFIX.length).trim();
  return bundleSlug || null;
}

type FulfillmentLine = {
  slug: string;
  title: string;
  qty: number;
  /** Средняя цена единицы внутри заказа; нужна только Ozon. */
  price: number;
};

/**
 * Разворачивает виртуальную строку комплекта в реальные складские позиции.
 * Одинаковые товары из комплекта и обычных строк объединяются: остаток и
 * маршрут Ozon должны учитывать их общей суммой.
 */
export function orderItemsForFulfillment(items: OrderItem[]): FulfillmentLine[] {
  const totals = new Map<string, FulfillmentLine & { amount: number }>();

  const add = (slug: string, title: string, qty: number, amount: number) => {
    const current = totals.get(slug);
    if (current) {
      current.qty += qty;
      current.amount += amount;
      current.price = current.amount / current.qty;
      return;
    }
    totals.set(slug, { slug, title, qty, amount, price: amount / qty });
  };

  for (const item of items) {
    if (!item.bundle?.items.length) {
      add(item.slug, item.title, item.qty, item.price * item.qty);
      continue;
    }

    const components = item.bundle.items;
    const componentFullPrice = components.reduce(
      (sum, component) => sum + component.price * component.qty,
      0,
    );
    let allocated = 0;
    components.forEach((component, index) => {
      const perBundleAmount =
        index === components.length - 1
          ? item.price - allocated
          : Math.round(
              (item.price * component.price * component.qty) /
                Math.max(1, componentFullPrice),
            );
      allocated += perBundleAmount;
      add(
        component.slug,
        component.title,
        component.qty * item.qty,
        perBundleAmount * item.qty,
      );
    });
  }

  return [...totals.values()].map((line) => ({
    slug: line.slug,
    title: line.title,
    qty: line.qty,
    price: line.price,
  }));
}

type ClientBundleLine = {
  slug: string;
  qty: number;
  bundle?: { items: Array<{ slug: string; qty?: number }> };
};

/** Разворачивание клиентской корзины только для предварительного маршрута. */
export function cartItemsForFulfillment(items: ClientBundleLine[]): Array<{
  slug: string;
  qty: number;
}> {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.bundle?.items.length) {
      totals.set(item.slug, (totals.get(item.slug) ?? 0) + item.qty);
      continue;
    }
    for (const component of item.bundle.items) {
      const qty = Math.max(1, Math.round(component.qty ?? 1)) * item.qty;
      totals.set(component.slug, (totals.get(component.slug) ?? 0) + qty);
    }
  }
  return [...totals].map(([slug, qty]) => ({ slug, qty }));
}
