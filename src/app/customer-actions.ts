"use server";

import { revalidatePath } from "next/cache";
import { clientIp } from "@/lib/client-ip";
import { ExpectedError } from "@/lib/errors";
import {
  registerCustomer,
  authenticate,
  updateCustomer,
  touchLogin,
  deleteCustomer,
  findByLogin,
  setCustomerPassword,
  markCustomerEmailVerified,
} from "@/lib/customers";
import {
  startCustomerSession,
  endCustomerSession,
  currentCustomer,
  makeResetToken,
  verifyResetToken,
  verifyEmailVerificationToken,
} from "@/lib/customer-auth";
import { endDealerSession, startDealerSession } from "@/lib/dealer-auth";
import {
  findDealerAccountByEmail,
  getDealerLocation,
  issueDealerInvite,
  markDealerLogin,
  recordDealerAccessMail,
} from "@/lib/dealers";
import { sendDealerPasswordReset } from "@/lib/dealer-mail";
import { verifyPassword } from "@/lib/password";
import {
  sendMailWithRetry,
  isMailerConfigured,
  type Letter,
} from "@/lib/mailer";
import { SITE_URL } from "@/lib/site-url";
import { escapeHtml } from "@/lib/sanitize";
import type { PublicCustomer } from "@/lib/types";
import { enqueueIntegrationJob, runIntegrationQueue } from "@/lib/job-queue";

/*
  Регистрация и вход покупателей.

  Аккаунт теперь общий для всех устройств: раньше он лежал в браузере, и
  «мои заказы» исчезали вместе с очисткой кэша, а владелец магазина своих
  клиентов вообще не видел.
*/

export type AuthResult =
  | { ok: true; customer: PublicCustomer; dealer?: false }
  | { ok: true; dealer: true }
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

/*
  Почта: одна собака, что-то до неё, домен с точкой и без пробелов.
  Строже проверять смысла нет — настоящую проверку даёт письмо, а его мы
  пока не шлём. Задача здесь другая: не пускать в файл мусор и простыни.
*/
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function signUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  /*
    Счётчик тот же, что у входа. Раньше регистрация не ограничивалась
    ничем: customers.json набивался скриптом до отказа диска, и каждая
    запись — это ещё и scrypt, то есть процессорное время сервера.
  */
  const ip = await clientIp();
  if (throttled(ip)) {
    return {
      ok: false,
      error: "Слишком много попыток. Подождите десять минут.",
    };
  }

  // Считаем каждую регистрацию, а не только дубликаты. Иначе бот с новой
  // почтой и телефоном на каждом запросе никогда не достигал лимита, хотя
  // каждая успешная попытка выполняет scrypt, пишет JSON и ставит письмо в очередь.
  noteFailure(ip);

  const name = typeof input.name === "string" ? input.name.trim().slice(0, 100) : "";
  const email = typeof input.email === "string" ? input.email.trim().slice(0, 120) : "";
  const phone = typeof input.phone === "string" ? input.phone.trim().slice(0, 30) : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!name) return { ok: false, error: "Впишите имя." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Проверьте почту." };
  if (phone.replace(/\D/g, "").length < 11) {
    return { ok: false, error: "Проверьте телефон." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Пароль — от ${MIN_PASSWORD_LENGTH} символов.` };
  }
  // Потолок на пароль: scrypt считает тем дольше, чем он длиннее, и
  // мегабайтная строка на входе — это способ занять сервер надолго.
  if (password.length > 200) {
    return { ok: false, error: "Пароль слишком длинный." };
  }

  try {
    const result = registerCustomer({ name, email, phone, password });
    if (!result.ok) {
      return result;
    }
    await startCustomerSession(result.customer.id);
    enqueueIntegrationJob("customer_email_verification", result.customer.id, { kind: "welcome" });
    void runIntegrationQueue();
    revalidatePath("/", "layout");
    return { ok: true, customer: result.customer };
  } catch (e) {
    /*
      Покупателю — только человеческий текст: про переменные окружения и
      устройство сервера ему знать незачем. Настоящая причина уходит в лог,
      иначе сломанная регистрация была бы совершенно невидимой.
    */
    console.error("signUp:", e);
    return {
      ok: false,
      error:
        e instanceof ExpectedError
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

  // Потолки на длину: scrypt считается на каждую попытку, и простыня на
  // входе — способ занять сервер, даже когда пароль заведомо неверный.
  if (typeof login !== "string" || typeof password !== "string") {
    return { ok: false, error: "Не подошли почта, телефон или пароль." };
  }
  if (login.length > 120 || password.length > 200) {
    noteFailure(ip);
    return { ok: false, error: "Не подошли почта, телефон или пароль." };
  }

  /*
    Одна форма обслуживает и розничный, и дилерский вход. Дилера проверяем
    именно по его отдельному хешу пароля, а не просто по совпавшему email:
    почта покупателя пока не подтверждается, и одно совпадение не должно
    открывать закрытые B2B-цены.
  */
  const normalizedLogin = login.trim().toLowerCase();
  const dealer = normalizedLogin.includes("@")
    ? findDealerAccountByEmail(normalizedLogin)
    : undefined;
  if (
    dealer &&
    !dealer.disabled &&
    dealer.activatedAt &&
    verifyPassword(password, dealer.passwordHash)
  ) {
    attempts.delete(ip);
    await startDealerSession(dealer.id);
    markDealerLogin(dealer.id);
    revalidatePath("/", "layout");
    return { ok: true, dealer: true };
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
  // Обычная кнопка выхода завершает и дилерскую сессию, если обе были
  // открыты в одном браузере.
  await endDealerSession();
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
    const affectedReviewSlugs = deleteCustomer(me.id);
    await endCustomerSession();
    revalidatePath("/", "layout");
    for (const slug of affectedReviewSlugs) revalidatePath(`/product/${slug}`);
    return { ok: true };
  } catch (e) {
    // Удаление своих данных — право по закону: молча терять отказ нельзя.
    console.error("deleteMyAccount:", e);
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
  } catch (e) {
    console.error("saveProfile:", e);
    return { ok: false, error: "Не получилось сохранить." };
  }
}

/* ---------------------- сброс пароля письмом со ссылкой ------------------- */

async function sendResetEmail(
  email: string,
  name: string,
  link: string,
): Promise<void> {
  if (!isMailerConfigured()) return;
  const hi = name ? `, ${escapeHtml(name)}` : "";
  const letter: Letter = {
    to: [email],
    subject: "Сброс пароля — Modern Original Music Organization",
    text: [
      `Здравствуйте${name ? ", " + name : ""}!`,
      "",
      "Вы запросили смену пароля на momo-eq.ru.",
      "Откройте ссылку и задайте новый пароль (действует один час):",
      link,
      "",
      "Если это были не вы — просто не открывайте ссылку, пароль останется прежним.",
    ].join("\n"),
    html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#151515;">
  <p>Здравствуйте${hi}!</p>
  <p>Вы запросили смену пароля на <b>momo-eq.ru</b>. Нажмите кнопку и задайте новый пароль — ссылка действует один час.</p>
  <p style="margin:20px 0;"><a href="${link}" style="display:inline-block;background:#e2571f;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px;">Задать новый пароль</a></p>
  <p style="color:#767676;font-size:13px;">Если это были не вы — не открывайте ссылку, пароль останется прежним.</p>
</div>`,
  };
  try {
    await sendMailWithRetry(letter);
  } catch (e) {
    console.error("sendResetEmail:", e);
  }
}

/**
 * Запрос сброса пароля. Всегда отвечает «ок»: есть аккаунт с такой почтой или
 * нет — не сообщаем, иначе форма превращается в проверку «зарегистрирован ли
 * человек». Письмо со ссылкой уходит, только если аккаунт найден.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true }> {
  const ip = await clientIp();
  // Тот же лимит, что у входа: не даём слать письма пачками на чужой ящик.
  if (throttled(ip)) return { ok: true };
  noteFailure(ip);

  const login = typeof email === "string" ? email.trim() : "";
  if (login) {
    const normalized = login.toLowerCase();
    const dealer = normalized.includes("@")
      ? findDealerAccountByEmail(normalized)
      : undefined;
    if (dealer && !dealer.disabled && dealer.activatedAt) {
      try {
        const location = getDealerLocation(dealer.dealerId);
        const token = issueDealerInvite(dealer.id);
        if (location && token) {
          void sendDealerPasswordReset(dealer, location, token).then((result) => {
            try {
              recordDealerAccessMail(dealer.id, result);
            } catch (error) {
              console.error("dealer reset status:", error);
            }
          });
        }
      } catch (error) {
        // Форма всегда отвечает одинаково, но настоящая причина остаётся в логе.
        console.error("dealer password reset:", error);
      }
    } else {
      const customer = findByLogin(login);
      if (customer?.email) {
        const token = makeResetToken(customer.id);
        if (token) {
          const link = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
          void sendResetEmail(customer.email, customer.name, link);
        }
      }
    }
  }
  return { ok: true };
}

/** Повторно отправить письмо подтверждения текущему покупателю. */
export async function resendEmailVerification(): Promise<{ ok: boolean; error?: string }> {
  const me = await currentCustomer();
  if (!me) return { ok: false, error: "Сначала войдите в аккаунт." };
  if (me.emailVerifiedAt) return { ok: true };
  enqueueIntegrationJob("customer_email_verification", me.id, { kind: "resend" });
  void runIntegrationQueue();
  return { ok: true };
}

/** Подтверждение по подписанной ссылке из письма. */
export async function confirmEmailByToken(token: string): Promise<boolean> {
  const id = verifyEmailVerificationToken(typeof token === "string" ? token : "");
  if (!id) return false;
  const ok = markCustomerEmailVerified(id);
  if (ok) revalidatePath("/", "layout");
  return ok;
}

/** Установить новый пароль по токену из письма и сразу войти. */
export async function resetPassword(
  token: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = verifyResetToken(typeof token === "string" ? token : "");
  if (!id) {
    return {
      ok: false,
      error: "Ссылка недействительна или истекла. Запросите сброс заново.",
    };
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Пароль — от ${MIN_PASSWORD_LENGTH} символов.` };
  }
  if (password.length > 200) {
    return { ok: false, error: "Пароль слишком длинный." };
  }

  try {
    if (!setCustomerPassword(id, password)) {
      return { ok: false, error: "Аккаунт не найден." };
    }
    // Ссылка пришла на этот email, поэтому успешный сброс одновременно
    // доказывает владение адресом и не требует второго письма.
    markCustomerEmailVerified(id);
    // Смена пароля рвёт старые сессии (отпечаток), поэтому сразу выдаём новую.
    await startCustomerSession(id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("resetPassword:", e);
    return { ok: false, error: "Не получилось изменить пароль." };
  }
}
