import crypto from "node:crypto";
import { cookies } from "next/headers";
import { ExpectedError } from "./errors";
import { findDealerAccount, getDealerLocation } from "./dealers";

const COOKIE = "momo_dealer";
const DAYS = 30;

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
}
function fingerprint(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("base64url").slice(0, 12);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(`dealer:${payload}`).digest("base64url");
}

function tokenFor(id: string, fp: string): string {
  const payload = `${id}.${Date.now() + DAYS * 86400_000}.${fp}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): { id: string; fp: string } | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, expires, fp, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${expires}.${fp}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;
  return { id, fp };
}

export async function startDealerSession(accountId: string): Promise<void> {
  const account = findDealerAccount(accountId);
  if (!account || account.disabled || !account.activatedAt) return;
  (await cookies()).set(COOKIE, tokenFor(account.id, fingerprint(account.passwordHash)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function endDealerSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/" });
}

export async function currentDealer() {
  const parsed = readToken((await cookies()).get(COOKIE)?.value);
  if (!parsed) return null;
  const account = findDealerAccount(parsed.id);
  if (!account || account.disabled || !account.activatedAt) return null;
  if (fingerprint(account.passwordHash) !== parsed.fp) return null;
  const dealer = getDealerLocation(account.dealerId);
  if (!dealer) return null;
  return { account, dealer };
}

export async function requireDealer() {
  const session = await currentDealer();
  if (!session) throw new ExpectedError("Войдите в дилерский кабинет заново.");
  return session;
}
