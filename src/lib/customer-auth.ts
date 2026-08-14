import crypto from "node:crypto";
import { cookies } from "next/headers";
import { findCustomer, toPublic } from "./customers";
import type { PublicCustomer } from "./types";

/*
  Сессия покупателя.

  Устроена как у панели — подписанная кука, ничего серверного хранить не
  нужно, — но кука своя и с другим сроком: покупатель заходит редко, и
  разлогинивать его каждую неделю незачем.

  Подпись берёт тот же ADMIN_SESSION_SECRET: это просто секрет сервера, а не
  что-то относящееся к правам владельца. Подделать куку без него нельзя, а
  прав панели она всё равно не даёт — там отдельная кука и отдельная проверка.
*/

const COOKIE = "momo_customer";
const DAYS = 90;

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
}

/*
  В подпись входит назначение куки: у панели тот же секрет сервера и такой
  же вид «значения через точку», и без пометки одну куку можно было бы
  предъявить вместо другой.
*/
function sign(payload: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`customer:${payload}`)
    .digest("base64url");
}

/*
  Отпечаток пароля — двенадцать символов от хеша его хеша. Восстановить по
  нему ничего нельзя, но смена пароля меняет отпечаток, и все выданные до
  этого куки перестают подходить.

  Без него сброс пароля никого не выгонял: владелец выдавал покупателю
  новый пароль, а тот, кто уже вошёл в чужой аккаунт, оставался внутри
  ещё девяносто дней. Ради этого сброс обычно и делают.
*/
function fingerprint(passwordHash: string): string {
  return crypto
    .createHash("sha256")
    .update(passwordHash)
    .digest("base64url")
    .slice(0, 12);
}

function makeToken(customerId: string, fp: string): string {
  const payload = `${customerId}.${Date.now() + DAYS * 24 * 60 * 60 * 1000}.${fp}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(
  token: string | undefined,
): { id: string; fp: string } | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [id, expires, fp, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${expires}.${fp}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;

  return { id, fp };
}

export async function startCustomerSession(customerId: string): Promise<void> {
  const customer = findCustomer(customerId);
  if (!customer) return;

  /*
    Флаги те же, что у панели (admin-auth.ts), с одним отличием: sameSite
    здесь lax, а не strict. Покупатель возвращается на сайт с чужих страниц —
    со страницы оплаты Яндекса и по ссылкам из WhatsApp, — а strict в таком
    переходе куку не приложит, и вошедший увидел бы «Войти». CSRF это не
    открывает: строгую проверку источника Next делает сам на каждом серверном
    действии, а lax и без того не прикладывает куку к чужим POST-запросам.
  */
  (await cookies()).set(COOKIE, makeToken(customerId, fingerprint(customer.passwordHash)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export async function endCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Текущий покупатель или null. Без хеша пароля. */
export async function currentCustomer(): Promise<PublicCustomer | null> {
  const parsed = readToken((await cookies()).get(COOKIE)?.value);
  if (!parsed) return null;

  const customer = findCustomer(parsed.id);
  if (!customer) return null;

  // Пароль сменили — сбросом из панели или самим покупателем. Кука,
  // выданная до этого, больше не годится.
  if (fingerprint(customer.passwordHash) !== parsed.fp) return null;

  return toPublic(customer);
}

/* -------------------------- сброс пароля письмом ------------------------- */

const RESET_TTL_MS = 60 * 60 * 1000; // ссылка живёт час

/*
  Подпись токена сброса — с доменом «reset:», отдельным от сессии («customer:»).
  Тем же секретом сервера, но одну нельзя предъявить вместо другой.
*/
function resetSign(payload: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`reset:${payload}`)
    .digest("base64url");
}

/**
 * Токен для ссылки сброса пароля. Одноразовость — через отпечаток пароля:
 * как пароль сменится, отпечаток изменится и ссылка перестанет подходить,
 * даже если её перехватили. Ничего серверного хранить не нужно.
 */
export function makeResetToken(customerId: string): string | null {
  const customer = findCustomer(customerId);
  if (!customer || !secret()) return null;
  const payload = `${customerId}.${Date.now() + RESET_TTL_MS}.${fingerprint(customer.passwordHash)}`;
  return `${payload}.${resetSign(payload)}`;
}

/** Проверить токен сброса и вернуть id покупателя или null. */
export function verifyResetToken(token: string | undefined): string | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, expires, fp, signature] = parts;

  const expected = Buffer.from(resetSign(`${id}.${expires}.${fp}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;

  const customer = findCustomer(id);
  if (!customer) return null;
  // Отпечаток не сходится — пароль этой ссылкой уже меняли, токен отработан.
  if (fingerprint(customer.passwordHash) !== fp) return null;
  return id;
}

/* ----------------------- подтверждение email ---------------------------- */

const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;

function emailFingerprint(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("base64url").slice(0, 16);
}

function verificationSign(payload: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`verify-email:${payload}`)
    .digest("base64url");
}

export function makeEmailVerificationToken(customerId: string): string | null {
  const customer = findCustomer(customerId);
  if (!customer || !secret()) return null;
  const payload = `${customer.id}.${Date.now() + VERIFY_EMAIL_TTL_MS}.${emailFingerprint(customer.email)}`;
  return `${payload}.${verificationSign(payload)}`;
}

export function verifyEmailVerificationToken(token: string | undefined): string | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, expires, fp, signature] = parts;
  const payload = `${id}.${expires}.${fp}`;
  const expected = Buffer.from(verificationSign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;
  const customer = findCustomer(id);
  if (!customer || emailFingerprint(customer.email) !== fp) return null;
  return id;
}
