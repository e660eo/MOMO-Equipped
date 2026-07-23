import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSiteConfig } from "./data";

/*
  Вход в панель управления: один общий пароль владельца магазина.

  Пароль на сервере не хранится — только scrypt-хеш в переменной окружения
  ADMIN_PASSWORD_HASH (генерируется скриптом scripts/admin-password.mjs).
  Сессия — подписанная HMAC кука, ничего серверного хранить не нужно:
  перезапуск сайта не разлогинивает, а базы под панель заводить незачем.
*/

export const SESSION_COOKIE = "momo_admin";
const SESSION_DAYS = 7;

/** Пароль задан и панель вообще может работать. */
export function isConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH && sessionSecret());
}

/**
 * Почта-логин владельца. По умолчанию — почта магазина из настроек сайта,
 * чтобы вход работал без правки окружения на сервере. ADMIN_EMAIL
 * перекрывает её, если логин нужен отдельный от публичного адреса.
 */
export function adminEmail(): string {
  const fromEnv = process.env.ADMIN_EMAIL?.trim();
  return (fromEnv || getSiteConfig().contacts.email).toLowerCase();
}

/** Пара «почта + пароль» с формы входа на сайте. */
export function verifyAdminLogin(email: string, password: string): boolean {
  if (email.trim().toLowerCase() !== adminEmail()) return false;
  return verifyPassword(password);
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
}

/* --------------------------------- пароль -------------------------------- */

/*
  Хеш для .env.local. Формат: scrypt:<соль hex>:<хеш hex>.
  Разделитель именно двоеточие: значения из .env проходят подстановку
  переменных, и «$» внутри хеша съедался бы как ссылка на другую переменную.
*/
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!stored) return false;

  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  // Сравнение постоянного времени: обычное === подсказывало бы подбирающему,
  // сколько первых байт он уже угадал.
  return crypto.timingSafeEqual(expected, actual);
}

/* --------------------------------- сессия -------------------------------- */

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

function createToken(): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !sessionSecret()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  if (!crypto.timingSafeEqual(expected, actual)) return false;

  return Number(payload) > Date.now();
}

export async function startSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Проверка для серверных действий. Middleware отсекает лишь запросы без куки,
 * подпись проверяется здесь — на действия записи middleware не распространяется.
 */
export async function requireSession(): Promise<void> {
  if (!(await hasSession())) {
    throw new Error("Нужно войти заново — сессия истекла.");
  }
}

/**
 * Проверка для страниц панели. Вызывается в каждой странице, а не в layout:
 * layout не может прервать рендер дочерней страницы, поэтому с подделанной
 * кукой содержимое всё равно отрисовывалось бы (сам proxy проверяет только
 * наличие куки, не подпись).
 */
export async function requireAdminPage(): Promise<void> {
  if (!(await hasSession())) redirect("/admin/login");
}

/* ---------------------------- защита от подбора --------------------------- */

const attempts = new Map<string, { count: number; until: number }>();
// Восемь попыток: пароль владельца длинный, промахнуться по клавише легко,
// а перебирать его вслепую всё равно бессмысленно.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
/*
  Потолок на размер карты: она живёт всё время работы процесса, и поток
  попыток с разных адресов иначе раздувал бы её до перезапуска по
  max_memory_restart — а перезапуск обнуляет и сами счётчики.
*/
const MAX_TRACKED = 5000;

function forget(): void {
  const now = Date.now();
  for (const [ip, rec] of attempts) {
    if (now > rec.until) attempts.delete(ip);
  }
  // Просроченных не нашлось — расстаёмся с самыми давними записями
  // (Map отдаёт ключи в порядке добавления).
  while (attempts.size >= MAX_TRACKED) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

/** Осталось ли право на попытку входа с этого адреса. */
export function canAttempt(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return true;
  if (Date.now() > rec.until) {
    attempts.delete(ip);
    return true;
  }
  return rec.count < MAX_ATTEMPTS;
}

export function recordFailure(ip: string): void {
  const rec = attempts.get(ip);
  if (!rec || Date.now() > rec.until) {
    if (!rec && attempts.size >= MAX_TRACKED) forget();
    attempts.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
    return;
  }
  rec.count += 1;
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
