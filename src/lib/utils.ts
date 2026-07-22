import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Русское склонение существительного под число: plural(3, "товар", "товара",
 * "товаров") → «товара». Счётчики каталога считаются по данным, поэтому число
 * заранее неизвестно и «145 позиций» не подставить строкой.
 */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}
