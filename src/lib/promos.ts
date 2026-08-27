import { readJson, updateJson, assertWritable } from "./store";
import type { OrderItem, Product, Promo } from "./types";
import { audit } from "./audit-log";
import { ExpectedError } from "./errors";

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
export function findValidPromo(code: string, context?: { subtotal?: number; customerKey?: string }): Promo | null {
  const norm = normalizeCode(typeof code === "string" ? code : "");
  if (!norm) return null;
  const promo = getPromos().find((p) => p.code === norm);
  if (!promo) return null;
  const now = new Date().toISOString();
  if (promo.active === false) return null;
  if (promo.startsAt && promo.startsAt > now) return null;
  if (promo.endsAt && promo.endsAt < now) return null;
  if (promo.limit > 0 && promo.used >= promo.limit) return null;
  if (promo.minSubtotal && (context?.subtotal ?? 0) < promo.minSubtotal) return null;
  if (promo.perCustomerLimit && context?.customerKey && (promo.customerUses?.[context.customerKey] ?? 0) >= promo.perCustomerLimit) return null;
  return promo;
}

/** Сумма скидки в рублях по проценту (целые рубли — цены у нас целые). */
export function discountFor(subtotal: number, percent: number): number {
  return Math.round((subtotal * percent) / 100);
}

export function discountForPromo(subtotal: number, promo: Promo): number {
  const discount = discountFor(subtotal, promo.percent);
  return promo.maxDiscount ? Math.min(discount, promo.maxDiscount) : discount;
}

export function promoAppliesToProduct(promo: Promo, product: { slug: string; category: string }): boolean {
  const hasProducts = Boolean(promo.productSlugs?.length);
  const hasCategories = Boolean(promo.categories?.length);
  if (!hasProducts && !hasCategories) return true;
  return Boolean(promo.productSlugs?.includes(product.slug) || promo.categories?.includes(product.category));
}

/** Один расчёт для предпросмотра корзины и окончательного заказа. */
export function promoDiscountForItems(
  promo: Promo,
  items: Pick<OrderItem, "slug" | "price" | "qty">[],
  products: Pick<Product, "slug" | "category">[],
): { eligibleSubtotal: number; discount: number } {
  const catalog = new Map(products.map((product) => [product.slug, product]));
  const eligibleSubtotal = items.reduce((sum, item) => {
    const product = catalog.get(item.slug);
    return product && promoAppliesToProduct(promo, product)
      ? sum + item.price * item.qty
      : sum;
  }, 0);
  return { eligibleSubtotal, discount: discountForPromo(eligibleSubtotal, promo) };
}

type PromoReservationContext = { subtotal: number; customerKey?: string };

/**
 * Резервирует одну активацию непосредственно перед записью заказа.
 * Проверка и инкремент происходят внутри одного синхронного updateJson, поэтому
 * две параллельные заявки не могут обе забрать последнюю активацию.
 */
export function reservePromo(
  code: string,
  redemptionId: string,
  context: PromoReservationContext,
): void {
  assertWritable();
  const norm = normalizeCode(code);
  updateJson<Promo[]>(FILE, (all) => {
    const promo = all.find((item) => item.code === norm);
    if (!promo) throw new ExpectedError("Промокод больше не действует.");
    if (promo.redemptions?.[redemptionId] !== undefined) return all;

    const now = new Date().toISOString();
    const customerUses = context.customerKey
      ? promo.customerUses?.[context.customerKey] ?? 0
      : 0;
    const unavailable =
      promo.active === false ||
      Boolean(promo.startsAt && promo.startsAt > now) ||
      Boolean(promo.endsAt && promo.endsAt < now) ||
      (promo.limit > 0 && promo.used >= promo.limit) ||
      Boolean(promo.minSubtotal && context.subtotal < promo.minSubtotal) ||
      Boolean(
        promo.perCustomerLimit &&
        context.customerKey &&
        customerUses >= promo.perCustomerLimit,
      );
    if (unavailable) throw new ExpectedError("Промокод больше не действует.");

    return all.map((item) => item.code === norm ? {
      ...item,
      used: item.used + 1,
      redemptions: {
        ...(item.redemptions ?? {}),
        [redemptionId]: context.customerKey ?? "",
      },
      ...(context.customerKey ? {
        customerUses: {
          ...(item.customerUses ?? {}),
          [context.customerKey]: customerUses + 1,
        },
      } : {}),
    } : item);
  });
}

/** Освобождает конкретную активацию; повторный вызов ничего не меняет. */
export function releasePromo(code: string, redemptionId: string): boolean {
  assertWritable();
  const norm = normalizeCode(code);
  let changed = false;
  updateJson<Promo[]>(FILE, (all) => all.map((promo) => {
    if (promo.code !== norm) return promo;
    const customerKey = promo.redemptions?.[redemptionId];
    if (customerKey === undefined) return promo;
    changed = true;

    const redemptions = { ...(promo.redemptions ?? {}) };
    delete redemptions[redemptionId];
    const customerUses = { ...(promo.customerUses ?? {}) };
    if (customerKey) {
      const next = Math.max(0, (customerUses[customerKey] ?? 0) - 1);
      if (next > 0) customerUses[customerKey] = next;
      else delete customerUses[customerKey];
    }
    return {
      ...promo,
      used: Math.max(0, promo.used - 1),
      ...(Object.keys(redemptions).length ? { redemptions } : { redemptions: undefined }),
      ...(Object.keys(customerUses).length ? { customerUses } : { customerUses: undefined }),
    };
  }));
  return changed;
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
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
  minSubtotal?: number;
  maxDiscount?: number;
  productSlugs?: string[];
  categories?: string[];
  perCustomerLimit?: number;
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
  const cleanOptionalNumber = (value?: number) => Number.isFinite(value) && (value ?? 0) > 0 ? Math.round(value!) : undefined;
  const advanced = {
    active: input.active !== false,
    ...(input.startsAt ? { startsAt: new Date(input.startsAt).toISOString() } : {}),
    ...(input.endsAt ? { endsAt: new Date(`${input.endsAt}T23:59:59.999Z`).toISOString() } : {}),
    ...(cleanOptionalNumber(input.minSubtotal) ? { minSubtotal: cleanOptionalNumber(input.minSubtotal) } : {}),
    ...(cleanOptionalNumber(input.maxDiscount) ? { maxDiscount: cleanOptionalNumber(input.maxDiscount) } : {}),
    ...(cleanOptionalNumber(input.perCustomerLimit) ? { perCustomerLimit: cleanOptionalNumber(input.perCustomerLimit) } : {}),
    ...(input.productSlugs?.length ? { productSlugs: input.productSlugs } : {}),
    ...(input.categories?.length ? { categories: input.categories } : {}),
  };

  const before = getPromos().find((promo) => promo.code === code);

  updateJson<Promo[]>(FILE, (all) => {
    const existing = all.find((p) => p.code === code);
    if (existing) {
      return all.map((p) => (p.code === code ? { ...p, percent, limit, ...advanced } : p));
    }
    return [
      { code, percent, limit, used: 0, createdAt: new Date().toISOString(), ...advanced },
      ...all,
    ];
  });
  audit({ entity: "promo", entityId: code, action: before ? "updated" : "created", summary: `${before ? "Изменён" : "Создан"} промокод ${code}`, ...(before ? { before } : {}), after: { percent, limit, ...advanced } });
  return { ok: true };
}

export function deletePromo(code: string): void {
  assertWritable();
  const norm = normalizeCode(code);
  const before = getPromos().find((promo) => promo.code === norm);
  updateJson<Promo[]>(FILE, (all) => all.filter((p) => p.code !== norm));
  if (before) audit({ entity: "promo", entityId: norm, action: "deleted", summary: `Удалён промокод ${norm}`, before });
}
