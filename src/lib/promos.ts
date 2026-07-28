import { readJson, updateJson, assertWritable } from "./store";
import type { Promo } from "./types";

/*
  Промокоды. Скидка в процентах, ограничение по числу активаций. Файл в папке
  данных — правится из панели, в репозиторий не попадает.

  Проверка и применение всегда на сервере: присланному из браузера проценту
  верить нельзя, иначе скидку в 100% подставит кто угодно.
*/

const FILE = "promos.json";

export function getPromos(): Promo[] {
  try {
    return readJson<Promo[]>(FILE);
  } catch {
    return [];
  }
}

/** Код в канонический вид: без пробелов по краям, верхним регистром. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Действующий промокод по названию или null: нет такого, или лимит активаций
 * исчерпан.
 */
export function findValidPromo(code: string): Promo | null {
  const norm = normalizeCode(typeof code === "string" ? code : "");
  if (!norm) return null;
  const promo = getPromos().find((p) => p.code === norm);
  if (!promo) return null;
  if (promo.limit > 0 && promo.used >= promo.limit) return null;
  return promo;
}

/** Сумма скидки в рублях по проценту (целые рубли — цены у нас целые). */
export function discountFor(subtotal: number, percent: number): number {
  return Math.round((subtotal * percent) / 100);
}

/** Списать одну активацию — после того как код применён к заказу. */
export function usePromo(code: string): void {
  const norm = normalizeCode(code);
  updateJson<Promo[]>(FILE, (all) =>
    all.map((p) => (p.code === norm ? { ...p, used: p.used + 1 } : p)),
  );
}

/* ------------------------------- панель --------------------------------- */

export type PromoResult = { ok: true } | { ok: false; error: string };

/**
 * Создать или изменить промокод (upsert по коду). used и дата создания у
 * существующего сохраняются — правка процента и лимита их не сбрасывает.
 */
export function savePromo(input: {
  code: string;
  percent: number;
  limit: number;
}): PromoResult {
  assertWritable();

  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Впишите код." };
  if (!/^[A-Za-zА-Яа-я0-9_-]{2,32}$/.test(code)) {
    return { ok: false, error: "Код: 2–32 символа, буквы, цифры, дефис." };
  }
  if (!Number.isFinite(input.percent) || input.percent < 1 || input.percent > 100) {
    return { ok: false, error: "Скидка — от 1 до 100 процентов." };
  }
  if (!Number.isFinite(input.limit) || input.limit < 0) {
    return { ok: false, error: "Лимит активаций — 0 (без ограничения) или больше." };
  }

  const percent = Math.round(input.percent);
  const limit = Math.round(input.limit);

  updateJson<Promo[]>(FILE, (all) => {
    const existing = all.find((p) => p.code === code);
    if (existing) {
      return all.map((p) => (p.code === code ? { ...p, percent, limit } : p));
    }
    return [
      { code, percent, limit, used: 0, createdAt: new Date().toISOString() },
      ...all,
    ];
  });
  return { ok: true };
}

export function deletePromo(code: string): void {
  assertWritable();
  const norm = normalizeCode(code);
  updateJson<Promo[]>(FILE, (all) => all.filter((p) => p.code !== norm));
}
