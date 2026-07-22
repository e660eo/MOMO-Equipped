"use server";

import { headers } from "next/headers";
import {
  verifyAdminLogin,
  startSession,
  canAttempt,
  recordFailure,
  clearAttempts,
  isConfigured,
} from "@/lib/admin-auth";

/*
  Вход в панель из обычной формы входа на сайте.

  Владельцу не нужно помнить адрес /admin: он вводит свою почту и пароль там
  же, где покупатели входят в кабинет, и попадает в панель. Для всех
  остальных форма ведёт себя как раньше — по несовпавшей паре мы не подаём
  вида, что какая-то почта особенная.
*/
export async function attemptAdminLogin(
  email: string,
  password: string,
): Promise<boolean> {
  if (!isConfigured()) return false;

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  // Форма открыта всему интернету, поэтому счётчик попыток тот же, что и на
  // отдельной странице входа: пять за десять минут с адреса.
  if (!canAttempt(ip)) return false;

  if (!verifyAdminLogin(email, password)) {
    recordFailure(ip);
    return false;
  }

  clearAttempts(ip);
  await startSession();
  return true;
}
