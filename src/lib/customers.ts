import crypto from "node:crypto";
import { readJson, updateJson, assertWritable } from "./store";
import { hashPassword, verifyPassword } from "./password";
import type { Customer, PublicCustomer } from "./types";

/*
  Покупатели с аккаунтом на сайте.

  До этого регистрация жила в браузере покупателя: на сервере этих людей
  физически не существовало, а «мои заказы» пропадали вместе с очисткой
  кэша. Теперь аккаунт общий для всех устройств, а владелец видит клиентов
  в панели.

  В файле — персональные данные (имя, почта, телефон, адрес), поэтому он
  никогда не попадает в репозиторий и наружу не отдаётся: страницы получают
  только `PublicCustomer` без хеша пароля.
*/

const FILE = "customers.json";

export function getCustomers(): Customer[] {
  try {
    return readJson<Customer[]>(FILE);
  } catch {
    return [];
  }
}

/** Без хеша пароля — то, что можно отдать в браузер. */
export function toPublic(c: Customer): PublicCustomer {
  const { passwordHash: _hash, ...rest } = c;
  return rest;
}

export function findCustomer(id: string): Customer | undefined {
  return getCustomers().find((c) => c.id === id);
}

/** Поиск по почте или телефону — по ним и входят. */
export function findByLogin(login: string): Customer | undefined {
  const value = login.trim().toLowerCase();
  const digits = value.replace(/\D/g, "");
  return getCustomers().find(
    (c) =>
      c.email.toLowerCase() === value ||
      (digits.length >= 10 && c.phone.replace(/\D/g, "") === digits),
  );
}

export type RegisterResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: string };

export function registerCustomer(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): RegisterResult {
  assertWritable();

  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  if (findByLogin(email)) {
    return { ok: false, error: "Аккаунт с такой почтой уже есть — войдите." };
  }
  if (findByLogin(phone)) {
    return { ok: false, error: "Аккаунт с таким телефоном уже есть — войдите." };
  }

  const customer: Customer = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    phone,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(input.password),
  };

  updateJson<Customer[]>(FILE, (all) => [...all, customer]);
  return { ok: true, customer: toPublic(customer) };
}

/** Проверка пары «логин + пароль». Возвращает клиента без хеша. */
export function authenticate(
  login: string,
  password: string,
): PublicCustomer | null {
  const customer = findByLogin(login);
  if (!customer) return null;
  if (!verifyPassword(password, customer.passwordHash)) return null;
  return toPublic(customer);
}

/** Правка данных доставки из личного кабинета. */
export function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "name" | "phone" | "address">>,
): void {
  assertWritable();
  updateJson<Customer[]>(FILE, (all) =>
    all.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  );
}

/**
 * Удаление аккаунта по требованию покупателя — прямое право по закону
 * о персональных данных, поэтому без обращения к владельцу магазина.
 *
 * Сведения об уже оформленных заказах остаются: их хранение держится на
 * другом основании — гарантия и бухгалтерский учёт. Связь с аккаунтом при
 * этом рвётся, так что «все заказы этого клиента» больше не собрать.
 */
export function deleteCustomer(id: string): void {
  assertWritable();
  updateJson<Customer[]>(FILE, (all) => all.filter((c) => c.id !== id));
}

/**
 * Временный пароль вместо забытого. Писем сайт не отправляет, поэтому
 * владелец выдаёт пароль лично — в переписке или по телефону.
 * Возвращается один раз: на сервере остаётся только хеш.
 */
export function resetPassword(id: string): string | null {
  assertWritable();
  const customers = getCustomers();
  if (!customers.some((c) => c.id === id)) return null;

  // Без похожих символов: пароль диктуют голосом, а «0» и «O» на слух одно и то же
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const temp = Array.from(
    crypto.randomBytes(10),
    (b) => alphabet[b % alphabet.length],
  ).join("");

  updateJson<Customer[]>(FILE, (all) =>
    all.map((c) => (c.id === id ? { ...c, passwordHash: hashPassword(temp) } : c)),
  );
  return temp;
}

export function touchLogin(id: string): void {
  try {
    assertWritable();
    updateJson<Customer[]>(FILE, (all) =>
      all.map((c) =>
        c.id === id ? { ...c, lastLoginAt: new Date().toISOString() } : c,
      ),
    );
  } catch {
    // Отметка о входе — приятная мелочь для панели, ради неё вход ломать незачем
  }
}
