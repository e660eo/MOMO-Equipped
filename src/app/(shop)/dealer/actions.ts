"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit-log";
import { currentDealer, endDealerSession, startDealerSession } from "@/lib/dealer-auth";
import { endCustomerSession } from "@/lib/customer-auth";
import { ensureDealerOrderNotifications, processDealerOrderNotifications } from "@/lib/dealer-order-notifications";
import { parseDealerOrderSubmission, type DealerPriceChange } from "@/lib/dealer-order-submission";
import { getB2BPriceBook } from "@/lib/b2b-prices";
import {
  accountForInvite,
  activateDealerAccount,
  createDealerOrder,
  dealerPriceFor,
  findDealerAccountByEmail,
  getDealerOrders,
  markDealerLogin,
} from "@/lib/dealers";
import { getProducts } from "@/lib/data";
import { ExpectedError, messageFor } from "@/lib/errors";
import { isInStock, stockLimit } from "@/lib/format";
import { verifyPassword } from "@/lib/password";
import type { OrderItem } from "@/lib/types";

export type DealerAuthState = { error?: string };
export type DealerOrderState = { error?: string; ok?: boolean; orderId?: string; priceChanges?: DealerPriceChange[] };

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
  await endCustomerSession();
  redirect("/dealer/login");
}

export async function submitDealerOrder(
  _state: DealerOrderState,
  formData: FormData,
): Promise<DealerOrderState> {
  try {
    const session = await currentDealer();
    if (!session) throw new ExpectedError("Сессия закончилась. Войдите в кабинет заново.");
    if (String(formData.get("accountId") ?? "") !== session.account.id) throw new ExpectedError("Аккаунт изменился. Обновите страницу заказа.");
    const input = parseDealerOrderSubmission(formData);
    const existing = getDealerOrders(session.account.id).find((order) => order.requestId === input.requestId);
    if (existing) {
      if (existing.requestFingerprint !== input.fingerprint) throw new ExpectedError("Эта заявка уже отправлена с другим составом. Обновите страницу перед новым заказом.");
      try { ensureDealerOrderNotifications(existing); } catch (error) { console.error("dealer notification queue:", error); }
      void processDealerOrderNotifications().catch((error) => console.error("dealer notification delivery:", error));
      return { ok: true, orderId: existing.id };
    }
    const products = new Map(getProducts().filter((product) => !product.isClearance && !product.hidden).map((product) => [product.slug, product]));
    const priceBook = getB2BPriceBook();
    const items: OrderItem[] = [];
    const priceChanges: DealerPriceChange[] = [];
    for (const { slug, qty, quotedPrice } of input.items) {
      const product = products.get(slug);
      if (!product) throw new ExpectedError("Один из товаров больше недоступен.");
      if (isInStock(product) === false) throw new ExpectedError(`${product.title}: сейчас нет в наличии.`);
      const limit = stockLimit(product);
      if (limit !== null && qty > limit) throw new ExpectedError(`${product.title}: доступно ${limit} шт.`);
      const price = dealerPriceFor(product, session.account, priceBook);
      if (price === undefined) throw new ExpectedError(`${product.title}: дилерская цена пока не указана. Уберите товар из заказа.`);
      if (price !== quotedPrice) priceChanges.push({ slug, title: product.title, previousPrice: quotedPrice, price });
      items.push({ slug, title: product.title, price, qty });
    }
    if (priceChanges.length) return { error: "Дилерский прайс изменился. Проверьте новые цены перед отправкой.", priceChanges };
    const order = createDealerOrder({ account: session.account, items, requestId: input.requestId, requestFingerprint: input.fingerprint, ...(input.comment ? { comment: input.comment } : {}) });
    try {
      audit({ entity: "dealer", entityId: order.id, action: "order_created", summary: `Создан дилерский заказ ${order.id}`, actor: session.account.contactName, after: order });
    } catch (error) { console.error("dealer order audit:", error); }
    try {
      ensureDealerOrderNotifications(order);
    } catch (mailError) {
      console.error("dealer notification queue:", mailError);
    }
    void processDealerOrderNotifications().catch((error) => console.error("dealer notification delivery:", error));
    try {
      revalidatePath("/dealer");
      revalidatePath("/admin/dealers");
    } catch (error) { console.error("dealer order revalidation:", error); }
    return { ok: true, orderId: order.id };
  } catch (error) {
    // An IO failure may happen after the atomic write. Let the client retain its
    // request token and recover, rather than treating that request as rejected.
    if (!(error instanceof ExpectedError)) throw error;
    return { error: messageFor(error, "Не удалось отправить заказ. Попробуйте ещё раз.", "submitDealerOrder") };
  }
}
