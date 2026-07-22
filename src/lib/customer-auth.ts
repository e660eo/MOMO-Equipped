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

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function makeToken(customerId: string): string {
  const payload = `${customerId}.${Date.now() + DAYS * 24 * 60 * 60 * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [id, expires, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;

  return id;
}

export async function startCustomerSession(customerId: string): Promise<void> {
  (await cookies()).set(COOKIE, makeToken(customerId), {
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
  const id = readToken((await cookies()).get(COOKIE)?.value);
  if (!id) return null;
  const customer = findCustomer(id);
  return customer ? toPublic(customer) : null;
}
