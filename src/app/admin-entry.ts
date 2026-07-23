"use server";

import { clientIp } from "@/lib/client-ip";
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
export type AdminLoginResult = "ok" | "wrong" | "throttled";

export async function attemptAdminLogin(
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  if (!isConfigured()) return "wrong";

  const ip = await clientIp();

  /*
    Счётчик попыток общий с отдельной страницей входа. Про исчерпанный лимит
    говорим прямо: молчаливый отказ владелец принимал за неверный пароль и
    пробовал снова, чем только продлевал ожидание. Подсказки о существовании
    панели тут нет — ограничение честно применимо к любому входу.
  */
  if (!canAttempt(ip)) return "throttled";

  if (!verifyAdminLogin(email, password)) {
    recordFailure(ip);
    return "wrong";
  }

  clearAttempts(ip);
  await startSession();
  return "ok";
}
