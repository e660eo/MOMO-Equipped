/*
  Форматирование цен и путей к фото.

  Модуль намеренно отделён от `data.ts`: тот читает файлы с диска и в браузере
  работать не может, а эти три функции нужны и клиентским компонентам
  (карточка товара, корзина, подсказки поиска, всплывающие уведомления).
*/

import type { Product } from "./types";

/** Базовый путь к фото товаров. Файлы отдаёт роут `/media/[...path]`. */
export const IMAGE_BASE = "/media/";

/**
 * Наличие товара: true — есть, false — под заказ, undefined — статус неизвестен.
 *
 * Остаток штук главнее флага: если склад посчитан, ноль означает «купить
 * нельзя», даже когда у товара когда-то стояло «в наличии». Само число
 * покупателю не показываем — это внутренний учёт.
 */
export function isInStock(product: Product): boolean | undefined {
  if (typeof product.stock === "number") return product.stock > 0;
  return product.inStock;
}

/** Сколько штук ещё можно положить в корзину. null — ограничения нет. */
export function stockLimit(product: Product): number | null {
  return typeof product.stock === "number" ? product.stock : null;
}

export function productImageUrl(image: string): string {
  // Абсолютные пути (например, /placeholder.svg) отдаём как есть.
  if (image.startsWith("/") || image.startsWith("http")) return image;
  return `${IMAGE_BASE}${image}`;
}

/** Платёж при оплате частями: 4 равных платежа, копейки округляются вверх. */
export function splitPayment(price: number): number {
  return Math.ceil(price / 4);
}

export function formatPrice(price: number): string {
  // Неразрывный пробел перед знаком рубля: в узких карточках «₽» уезжал
  // на следующую строку и цена читалась как оборванная.
  return `${price.toLocaleString("ru-RU")} ₽`;
}
