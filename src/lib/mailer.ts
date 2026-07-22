import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/*
  Отправка писем с сайта.

  Нужна ровно для одного: владелец должен узнавать о заказе, не открывая
  панель. Раньше заказ был виден только в `/admin/orders` — если покупатель
  не дожал кнопку в WhatsApp, заявка лежала незамеченной.

  Доступ к ящику берётся из окружения: пароль почты в репозитории не хранится
  никогда. Ящик не подключён — модуль честно возвращает отказ, а сайт работает
  как раньше: заказ всё равно сохранён и открыт в WhatsApp.
*/

/** Яндекс.Почта — у магазина почта на домене живёт там (MX mx.yandex.net). */
const DEFAULT_HOST = "smtp.yandex.ru";
const DEFAULT_PORT = 465;

export interface MailerConfig {
  host: string;
  port: number;
  user: string;
  from: string;
  to: string[];
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Настройки почты или null, если ящик не подключён.
 *
 * Пароль наружу не отдаём даже внутри процесса — его знает только `sendMail`.
 */
export function mailerConfig(): MailerConfig | null {
  const user = env("SMTP_USER");
  if (!user || !env("SMTP_PASS")) return null;

  // Кому шлём: список через запятую. По умолчанию — сам ящик отправителя,
  // то есть письмо приходит само себе. Так работает сразу после подключения,
  // без второй переменной.
  const to = (env("ORDER_NOTIFY_TO") || user)
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  return {
    host: env("SMTP_HOST") || DEFAULT_HOST,
    port: Number(env("SMTP_PORT")) || DEFAULT_PORT,
    user,
    // Яндекс отвергает письмо, если адрес отправителя не тот, под которым мы
    // вошли. Поэтому меняем только подпись, адрес оставляем свой.
    from: env("SMTP_FROM") || `MOMO — сайт <${user}>`,
    to,
  };
}

export function isMailerConfigured(): boolean {
  return mailerConfig() !== null;
}

/*
  Транспорт держим один на процесс: nodemailer переиспользует соединение,
  а на каждое письмо заново здороваться с сервером незачем. При ошибке
  сбрасываем — соединение могло развалиться вместе с ней.
*/
let transport: Transporter | null = null;

function transporter(config: MailerConfig): Transporter {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 — TLS с первого байта, 587 — STARTTLS уже внутри соединения.
    secure: config.port === 465,
    auth: { user: config.user, pass: env("SMTP_PASS") },
    // Без таймаутов зависший почтовый сервер держал бы отправку минутами.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

/*
  Почтовые ошибки приходят строкой от чужого сервера и на английском:
  «Invalid login: 535 5.7.8», «connect ECONNREFUSED». Владельцу магазина это
  не говорит ничего, а чинить настройки ему. Поэтому переводим причину на
  человеческий язык и говорим, что именно проверить, — техническую строку
  оставляем следом, чтобы было что переслать разработчику.
*/
function explainMailError(raw: string): string {
  const has = (...needles: string[]) =>
    needles.some((n) => raw.toLowerCase().includes(n.toLowerCase()));

  if (has("Invalid login", "535", "EAUTH", "authentication failed")) {
    return `Почтовый сервер не принял логин или пароль. Для Яндекса нужен отдельный «пароль приложения», обычный пароль от ящика не подойдёт. Ответ сервера: ${raw}`;
  }
  if (has("ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EDNS", "Greeting never received")) {
    return `Не получилось соединиться с почтовым сервером — проверьте SMTP_HOST и SMTP_PORT (Яндекс: smtp.yandex.ru, порт 465). Ответ: ${raw}`;
  }
  if (has("wrong version number", "SSL", "ESOCKET")) {
    return `Порт и шифрование не совпали: 465 — сразу защищённое соединение, 587 — обычное. Ответ: ${raw}`;
  }
  if (has("EENVELOPE", "550", "553", "recipient")) {
    return `Сервер отказался доставлять письмо на указанный адрес — проверьте ORDER_NOTIFY_TO. Ответ: ${raw}`;
  }
  return raw;
}

export type MailResult =
  | { ok: true; at: string; to: string[] }
  | { ok: false; at: string; error: string };

/*
  Чем закончилась последняя отправка. Живёт в памяти процесса и сбрасывается
  при перезапуске — этого достаточно: панель показывает результат, чтобы
  сломанный пароль ящика не молчал. Молчащий отказ мы на этом проекте уже
  проходили на форме входа, второй раз наступать не будем.
*/
let last: MailResult | null = null;

export function lastMailResult(): MailResult | null {
  return last;
}

export interface Letter {
  subject: string;
  text: string;
  html: string;
  /** Кому — если нужен адрес, отличный от настроенного. */
  to?: string[];
  /** Куда уйдёт ответ: телефон в заказе есть не всегда, почта — удобнее. */
  replyTo?: string;
}

export async function sendMail(letter: Letter): Promise<MailResult> {
  const at = new Date().toISOString();
  const config = mailerConfig();

  if (!config) {
    last = { ok: false, at, error: "Почтовый ящик не подключён: нет SMTP_USER или SMTP_PASS." };
    return last;
  }

  const to = letter.to?.length ? letter.to : config.to;

  try {
    await transporter(config).sendMail({
      from: config.from,
      to,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
      ...(letter.replyTo ? { replyTo: letter.replyTo } : {}),
    });
    last = { ok: true, at, to };
  } catch (e) {
    transport = null;
    const raw = e instanceof Error ? e.message : String(e);
    last = { ok: false, at, error: explainMailError(raw) };
  }

  return last;
}

/**
 * Отправка с повтором: одна сетевая икота не должна стоить уведомления
 * о заказе. Больше двух попыток смысла нет — если ящик настроен неверно,
 * повторы просто откладывают запись в лог.
 */
export async function sendMailWithRetry(letter: Letter): Promise<MailResult> {
  const first = await sendMail(letter);
  if (first.ok || !isMailerConfigured()) return first;

  await new Promise((resolve) => setTimeout(resolve, 5_000));
  return sendMail(letter);
}
