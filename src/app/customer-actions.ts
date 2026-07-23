"use server";

import { revalidatePath } from "next/cache";
import { clientIp } from "@/lib/client-ip";
import {
  registerCustomer,
  authenticate,
  updateCustomer,
  touchLogin,
  deleteCustomer,
} from "@/lib/customers";
import {
  startCustomerSession,
  endCustomerSession,
  currentCustomer,
} from "@/lib/customer-auth";
import type { PublicCustomer } from "@/lib/types";

/*
  Регистрация и вход покупателей.

  Аккаунт теперь общий для всех устройств: раньше он лежал в браузере, и
  «мои заказы» исчезали вместе с очисткой кэша, а владелец магазина своих
  клиентов вообще не видел.
*/

export type AuthResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: string };

/* Защита от перебора паролей — как на входе в панель. */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;
// Потолок на размер карты — она живёт всё время работы процесса.
const MAX_TRACKED = 5000;

function forget(): void {
  const now = Date.now();
  for (const [ip, rec] of attempts) {
    if (now > rec.until) attempts.delete(ip);
  }
  while (attempts.size >= MAX_TRACKED) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

function throttled(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec || Date.now() > rec.until) return false;
  return rec.count >= MAX_ATTEMPTS;
}

function noteFailure(ip: string): void {
  const rec = attempts.get(ip);
  if (!rec || Date.now() > rec.until) {
    if (!rec && attempts.size >= MAX_TRACKED) forget();
    attempts.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
    return;
  }
  rec.count += 1;
}

export async function signUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  if (!input.name.trim()) return { ok: false, error: "Впишите имя." };
  if (!input.email.includes("@")) return { ok: false, error: "Проверьте почту." };
  if (input.phone.replace(/\D/g, "").length < 11) {
    return { ok: false, error: "Проверьте телефон." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Пароль — от шести символов." };
  }

  try {
    const result = registerCustomer(input);
    if (!result.ok) return result;
    await startCustomerSession(result.customer.id);
    revalidatePath("/", "layout");
    return { ok: true, customer: result.customer };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error && e.message.includes("MOMO_DATA_DIR")
          ? "Регистрация сейчас недоступна — напишите нам в WhatsApp."
          : "Не получилось создать аккаунт.",
    };
  }
}

export async function signIn(
  login: string,
  password: string,
): Promise<AuthResult> {
  const ip = await clientIp();
  if (throttled(ip)) {
    return {
      ok: false,
      error: "Слишком много попыток входа. Подождите десять минут.",
    };
  }

  const customer = authenticate(login, password);
  if (!customer) {
    noteFailure(ip);
    return { ok: false, error: "Не подошли почта, телефон или пароль." };
  }

  attempts.delete(ip);
  await startCustomerSession(customer.id);
  touchLogin(customer.id);
  revalidatePath("/", "layout");
  return { ok: true, customer };
}

export async function signOut(): Promise<void> {
  await endCustomerSession();
  revalidatePath("/", "layout");
}

/**
 * Удаление аккаунта самим покупателем — по требованию закона о персональных
 * данных это должно работать без обращения к магазину.
 */
export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const me = await currentCustomer();
  if (!me) return { ok: false, error: "Нужно войти заново." };

  try {
    deleteCustomer(me.id);
    await endCustomerSession();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "Не получилось удалить аккаунт." };
  }
}

/** Данные доставки из личного кабинета. */
export async function saveProfile(patch: {
  name?: string;
  phone?: string;
  address?: string;
}): Promise<AuthResult> {
  const me = await currentCustomer();
  if (!me) return { ok: false, error: "Нужно войти заново." };

  if (typeof patch.phone === "string" && patch.phone.replace(/\D/g, "").length < 11) {
    return { ok: false, error: "Проверьте телефон." };
  }

  try {
    const result = updateCustomer(me.id, patch);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/profile");

    // Возвращаем то, что записалось на самом деле, а не присланное:
    // updateCustomer берёт из patch только три поля, и ответ не должен
    // показывать покупателю несуществующую правку.
    const saved = await currentCustomer();
    return { ok: true, customer: saved ?? me };
  } catch {
    return { ok: false, error: "Не получилось сохранить." };
  }
}
