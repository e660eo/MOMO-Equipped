"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit-log";
import { currentDealer, endDealerSession, startDealerSession } from "@/lib/dealer-auth";
import { notifyDealerOrder } from "@/lib/dealer-mail";
import {
  accountForInvite,
  activateDealerAccount,
  createDealerOrder,
  dealerPriceFor,
  findDealerAccountByEmail,
  markDealerLogin,
} from "@/lib/dealers";
import { getProducts } from "@/lib/data";
import { ExpectedError, messageFor } from "@/lib/errors";
import { isInStock, stockLimit } from "@/lib/format";
import { verifyPassword } from "@/lib/password";
import type { OrderItem } from "@/lib/types";

export type DealerAuthState = { error?: string };
export type DealerOrderState = { error?: string; ok?: boolean; orderId?: string };

const loginAttempts = new Map<string, { count: number; startedAt: number }>();

async function loginKey(email: string): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${forwarded}:${email}`;
}

function checkLoginLimit(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt > 15 * 60_000) {
    loginAttempts.set(key, { count: 1, startedAt: now });
    return;
  }
  if (entry.count >= 10) throw new ExpectedError("Слишком много попыток. Повторите вход через 15 минут.");
  entry.count += 1;
}

export async function loginDealer(_state: DealerAuthState, formData: FormData): Promise<DealerAuthState> {
  try {
    const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
    const password = String(formData.get("password") ?? "");
    const key = await loginKey(email);
    checkLoginLimit(key);
    const account = findDealerAccountByEmail(email);
    if (!account || account.disabled || !account.activatedAt || !verifyPassword(password, account.passwordHash)) {
      throw new ExpectedError("Неверный логин или пароль.");
    }
    loginAttempts.delete(key);
    markDealerLogin(account.id);
    await startDealerSession(account.id);
  } catch (error) {
    return { error: messageFor(error, "Не удалось выполнить вход.", "loginDealer") };
  }
  redirect("/dealer");
}

export async function activateDealer(_state: DealerAuthState, formData: FormData): Promise<DealerAuthState> {
  try {
    const token = String(formData.get("token") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (!accountForInvite(token)) throw new ExpectedError("Ссылка недействительна или уже использована. Запросите новую у менеджера.");
    if (password.length < 10) throw new ExpectedError("Пароль должен содержать не менее 10 символов.");
    if (password !== confirm) throw new ExpectedError("Пароли не совпадают.");
    const account = activateDealerAccount(token, password);
    if (!account) throw new ExpectedError("Не удалось активировать доступ. Запросите новую ссылку.");
    await startDealerSession(account.id);
    audit({ entity: "dealer", entityId: account.id, action: "account_activated", summary: `Дилер активировал кабинет: ${account.email}`, actor: account.contactName });
  } catch (error) {
    return { error: messageFor(error, "Не удалось активировать кабинет.", "activateDealer") };
  }
  redirect("/dealer?activated=1");
}

export async function logoutDealer(): Promise<void> {
  await endDealerSession();
  redirect("/dealer/login");
}

export async function submitDealerOrder(
  _state: DealerOrderState,
  formData: FormData,
): Promise<DealerOrderState> {
  try {
    const session = await currentDealer();
    if (!session) throw new ExpectedError("Сессия закончилась. Войдите в кабинет заново.");
    const raw = JSON.parse(String(formData.get("items") ?? "[]")) as Array<{ slug?: unknown; qty?: unknown }>;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) throw new ExpectedError("Добавьте товары в заказ.");
    const requested = new Map<string, number>();
    for (const row of raw) {
      const slug = typeof row.slug === "string" ? row.slug : "";
      const qty = Number(row.qty);
      if (!slug || !Number.isSafeInteger(qty) || qty < 1 || qty > 999) throw new ExpectedError("Проверьте количество товаров.");
      requested.set(slug, (requested.get(slug) ?? 0) + qty);
    }
    const products = new Map(getProducts().filter((product) => !product.isClearance).map((product) => [product.slug, product]));
    const items: OrderItem[] = [];
    for (const [slug, qty] of requested) {
      const product = products.get(slug);
      if (!product) throw new ExpectedError("Один из товаров больше недоступен.");
      if (isInStock(product) === false) throw new ExpectedError(`${product.title}: сейчас нет в наличии.`);
      const limit = stockLimit(product);
      if (limit !== null && qty > limit) throw new ExpectedError(`${product.title}: доступно ${limit} шт.`);
      items.push({ slug, title: product.title, price: dealerPriceFor(product, session.account), qty });
    }
    const comment = String(formData.get("comment") ?? "").trim().slice(0, 700);
    const order = createDealerOrder({ account: session.account, items, ...(comment ? { comment } : {}) });
    audit({ entity: "dealer", entityId: order.id, action: "order_created", summary: `Создан дилерский заказ ${order.id}`, actor: session.account.contactName, after: order });
    try {
      await notifyDealerOrder(order, session.dealer);
    } catch (mailError) {
      console.error("notifyDealerOrder:", mailError);
    }
    revalidatePath("/dealer");
    revalidatePath("/admin/dealers");
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { error: messageFor(error, "Не удалось отправить заказ. Попробуйте ещё раз.", "submitDealerOrder") };
  }
}
