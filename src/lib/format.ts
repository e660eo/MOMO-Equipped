/*
  Форматирование цен и путей к фото.

  Модуль намеренно отделён от `data.ts`: тот читает файлы с диска и в браузере
  работать не может, а эти три функции нужны и клиентским компонентам
  (карточка товара, корзина, подсказки поиска, всплывающие уведомления).
*/

/** Базовый путь к фото товаров. Файлы отдаёт роут `/media/[...path]`. */
export const IMAGE_BASE = "/media/";

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
