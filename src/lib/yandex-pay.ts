import crypto from "node:crypto";
import { SITE_URL } from "./site-url";
import type { Order, PaymentStatus } from "./types";
import { allocatedGoodsLineTotals } from "./order-totals";

/*
  Приём онлайн-оплаты через Яндекс Пэй (карта и Сплит).

  Как это устроено: наш сервер заводит заказ в Яндекс Пэй и получает ссылку
  на платёжную форму, покупатель уходит туда платить, а о результате Яндекс
  сообщает вебхуком на наш адрес.

  Три правила, от которых здесь нельзя отступать:

  1. Ключ живёт только на сервере. В браузер он не уходит никогда — ни в
     пропсах, ни в ответе действия. С ним можно принимать деньги от нашего
     имени.
  2. Сумму считает сервер по каталогу. Присланному из браузера верить нельзя:
     туда подставят любое число. Заказ к этому моменту уже сохранён с ценами
     из products.json — берём их.
  3. Вебхуку верим дважды: сперва проверяем подпись, затем перезапрашиваем
     заказ у Яндекса. Подделать письмо «оплачено» не должно быть возможно
     даже при утечке адреса вебхука.
*/

const SANDBOX_API = "https://sandbox.pay.yandex.ru/api/merchant/v1";
const PRODUCTION_API = "https://pay.yandex.ru/api/merchant/v1";
const SANDBOX_JWKS = "https://sandbox.pay.yandex.ru/api/jwks";
const PRODUCTION_JWKS = "https://pay.yandex.ru/api/jwks";

/** Сколько минут живёт ссылка на оплату. Дальше заказ придётся оформить заново. */
const TTL_MINUTES = 30;

export interface PayConfig {
  apiKey: string;
  merchantId: string;
  sandbox: boolean;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Настройки приёма оплаты или null, если он не подключён.
 *
 * Боевой режим включается явной переменной YANDEX_PAY_LIVE=1. По умолчанию
 * песочница: случайно принять настоящие деньги на недонастроенном магазине
 * хуже, чем случайно не принять.
 */
export function payConfig(): PayConfig | null {
  const apiKey = env("YANDEX_PAY_API_KEY");
  const merchantId = env("YANDEX_PAY_MERCHANT_ID");
  if (!apiKey || !merchantId) return null;

  return { apiKey, merchantId, sandbox: env("YANDEX_PAY_LIVE") !== "1" };
}

export function isPayConfigured(): boolean {
  return payConfig() !== null;
}

/* ------------------------------ фискализация ------------------------------ */

/*
  Онлайн-чеки по 54-ФЗ. Когда в кабинете Яндекс Пэй подключена касса (у нас —
  АТОЛ Онлайн) и включена фискализация, в заказ ОБЯЗАТЕЛЬНО передаются данные
  чека: контакт покупателя и по каждой позиции — ставка НДС и признаки расчёта.
  Сам чек формирует Яндекс на стороне кассы; налоговую систему задают в кабинете.

  В песочнице чек по умолчанию не шлём: если отправить данные чека при
  неподключённой тестовой фискализации, Яндекс отклонит заказ. Её можно включить
  отдельно флагом YANDEX_PAY_FISCAL=1.

  ⚠️ Боевой приём денег (YANDEX_PAY_LIVE=1) всегда включает фискализацию.
  Так сайт не сможет случайно принимать настоящую выручку без чеков.

  Все коды — из справочника ФНС Яндекс Пэй:
  https://pay.yandex.ru/ru/docs/custom/backend/fns
*/

/** Признак предмета расчёта: 1 = «Товар» (у нас автоакустика и аксессуары). */
const RECEIPT_SUBJECT_GOODS = 1;

interface FiscalConfig {
  /** Код ставки НДС из справочника ФНС: 8 = «НДС 5%», 6 = «Без НДС», 11 = «НДС 22%». */
  vatCode: number;
  /** Признак способа расчёта: 1 = «Полная предоплата до передачи», 4 = «Полный расчёт». */
  paymentMethod: number;
}

/**
 * Настройки чека или null для песочницы без тестовой фискализации.
 *
 * Для магазина подтверждены НДС 5% (код 8) и 100% предоплата (код 1).
 * Переменные окружения оставлены как явное переопределение на случай смены
 * налоговых настроек без пересборки сайта.
 */
function fiscalConfig(): FiscalConfig | null {
  const isLive = env("YANDEX_PAY_LIVE") === "1";
  const enabledInSandbox = env("YANDEX_PAY_FISCAL") === "1";
  if (!isLive && !enabledInSandbox) return null;
  return {
    vatCode: Number(env("YANDEX_PAY_VAT_CODE")) || 8,
    paymentMethod: Number(env("YANDEX_PAY_PAYMENT_METHOD")) || 1,
  };
}

export function isFiscalEnabled(): boolean {
  return fiscalConfig() !== null;
}

/*
  Контакт для электронного чека — прежде всего email аккаунта: письмо с чеком
  проще найти и сохранить. Для старых заказов без email оставляем телефон.
  Яндекс принимает оба варианта в одном поле fiscalContact.
*/
export function fiscalContact(email: string | undefined, phone: string): string {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return normalizedEmail;
  }
  const digits = phone.replace(/\D/g, "").replace(/^8/, "7");
  return digits.startsWith("7") ? `+${digits}` : `+7${digits}`;
}

/*
  Подмена адреса API — только для разработки: на ней прогоняется вся цепочка
  (создание заказа, статус, подписанный вебхук) без похода в Яндекс.

  В проде переменная игнорируется намеренно. Возможность увести платежи на
  чужой адрес одной строкой в окружении — это ровно тот способ, каким у
  магазинов уводят деньги.
*/
function devOverride(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return env("YANDEX_PAY_API_BASE") || null;
}

function apiBase(config: PayConfig): string {
  const override = devOverride();
  if (override) return `${override}/api/merchant/v1`;
  return config.sandbox ? SANDBOX_API : PRODUCTION_API;
}

/* ------------------------------ создание ---------------------------------- */

/*
  Яндекс принимает суммы строками с копейками. Наши цены — целые рубли,
  но приводим честно: «434» и «434.00» для платёжной системы не одно и то же,
  а расхождение суммы позиций с итогом — отказ в создании заказа.
*/
function money(value: number): string {
  return value.toFixed(2);
}

interface CreateResponse {
  status?: string;
  data?: { paymentUrl?: string };
  reason?: string;
  reasonCode?: string;
}

export interface CreatedPayment {
  url: string;
  amount: number;
  sandbox: boolean;
  token: string;
}

/**
 * Завести платёж по уже сохранённому заказу и получить ссылку на форму.
 *
 * Сумма берётся из самого заказа — то есть из цен каталога на момент
 * оформления. Доставка сюда не входит: её стоимость на этот момент неизвестна.
 */
export async function createPayment(order: Order): Promise<CreatedPayment> {
  const config = payConfig();
  if (!config) throw new Error("Онлайн-оплата не подключена.");

  // Промокод и бонусы распределяем по товарам: отдельную отрицательную строку
  // Яндекс не принимает, а сумма позиций обязана до копейки совпасть с итогом.
  const lineTotals = allocatedGoodsLineTotals(order);
  // Данные чека добавляем к позициям, только если подключена фискализация.
  const fiscal = fiscalConfig();
  const items = order.items.map((item, idx) => ({
    productId: item.slug,
    title: item.title,
    quantity: { count: String(item.qty) },
    total: money(lineTotals[idx]),
    ...(fiscal
      ? {
          receipt: {
            tax: fiscal.vatCode,
            paymentSubjectType: RECEIPT_SUBJECT_GOODS,
            paymentMethodType: fiscal.paymentMethod,
          },
        }
      : {}),
  }));

  const subtotal = lineTotals.reduce((sum, t) => sum + t, 0);
  const deliveryCharge = order.delivery?.customerPrice ?? 0;
  if (deliveryCharge > 0) {
    items.push({
      productId: "delivery-ozon",
      title: "Delivery Ozon",
      quantity: { count: "1" },
      total: money(deliveryCharge),
      ...(fiscal
        ? {
            receipt: {
              tax: fiscal.vatCode,
              paymentSubjectType: RECEIPT_SUBJECT_GOODS,
              paymentMethodType: fiscal.paymentMethod,
            },
          }
        : {}),
    });
  }
  const total = subtotal + deliveryCharge;
  // Метка для страницы возврата: без неё чужой заказ открывался бы перебором
  // номера, а там имя, телефон и адрес.
  const token = crypto.randomBytes(16).toString("hex");

  const response = await fetch(`${apiBase(config)}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchantId: config.merchantId,
      orderId: order.id,
      currencyCode: "RUB",
      // Контакт для чека — только при включённой фискализации.
      ...(fiscal
        ? { fiscalContact: fiscalContact(order.customer.email, order.customer.phone) }
        : {}),
      cart: { items, total: { amount: money(total) } },
      // Сплит рядом с картой: покупатель выбирает сам на форме Яндекса.
      // Пока договор на Сплит не заключён, Яндекс его просто не покажет.
      availablePaymentMethods: ["CARD", "SPLIT"],
      redirectUrls: {
        onSuccess: `${SITE_URL}/order/${order.id}?t=${token}`,
        onError: `${SITE_URL}/order/${order.id}?t=${token}&error=1`,
      },
      ttl: TTL_MINUTES * 60,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => ({}))) as CreateResponse;

  if (!response.ok || !body.data?.paymentUrl) {
    const detail = body.reason || body.reasonCode || `HTTP ${response.status}`;
    throw new Error(`Яндекс Пэй не принял заказ: ${detail}`);
  }

  return { url: body.data.paymentUrl, amount: total, sandbox: config.sandbox, token };
}

/* ------------------------------- проверка --------------------------------- */

interface FetchedOrder {
  data?: {
    order?: {
      orderId?: string;
      paymentStatus?: string;
      cart?: { total?: { amount?: string } };
    };
  };
}

const KNOWN_STATUSES: PaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "VOIDED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

function toPaymentStatus(raw: string | undefined): PaymentStatus | null {
  const found = KNOWN_STATUSES.find((s) => s === raw);
  return found ?? null;
}

/**
 * Спросить у Яндекса, что с заказом на самом деле.
 *
 * Это и есть источник правды об оплате: вебхук только повод сходить сюда.
 * Возвращает null, если статус незнаком, — придумывать «наверное, оплачен»
 * для незнакомого значения нельзя.
 */
export async function fetchPaymentStatus(
  orderId: string,
): Promise<PaymentStatus | null> {
  const config = payConfig();
  if (!config) return null;

  const response = await fetch(
    `${apiBase(config)}/orders/${encodeURIComponent(orderId)}`,
    {
      headers: { Authorization: `Api-Key ${config.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Яндекс Пэй не отдал заказ ${orderId}: HTTP ${response.status}`);
  }

  const body = (await response.json()) as FetchedOrder;
  return toPaymentStatus(body.data?.order?.paymentStatus);
}

/* -------------------------- проверка подписи ------------------------------ */

/*
  Вебхук приходит как JWT, подписанный ES256. Проверяем подпись открытым
  ключом из JWKS Яндекса, а не «доверяем адресу»: адрес вебхука не секрет,
  и без подписи любой желающий отмечал бы заказы оплаченными.

  Ключи кэшируем на час — ходить за ними на каждый платёж незачем, но и
  держать вечно нельзя: Яндекс их меняет.
*/
interface Jwk {
  kid?: string;
  alg?: string;
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
}

let jwksCache: { keys: Jwk[]; at: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function jwks(config: PayConfig): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const override = devOverride();
  const url = override
    ? `${override}/api/jwks`
    : config.sandbox
      ? SANDBOX_JWKS
      : PRODUCTION_JWKS;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Не удалось получить ключи Яндекс Пэй: HTTP ${response.status}`);

  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { keys, at: Date.now() };
  return keys;
}

function decodePart(part: string): unknown {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

export interface WebhookPayload {
  merchantId?: string;
  event?: string;
  order?: { orderId?: string; paymentStatus?: string };
  orderId?: string;
  [key: string]: unknown;
}

/**
 * Проверить подпись уведомления и вернуть его содержимое.
 *
 * Бросает при любом сомнении: чужая подпись, просроченный токен, чужой
 * магазин. Молчаливое «ну наверное сойдёт» здесь означало бы, что заказы
 * помечает оплаченными кто угодно.
 */
export async function verifyWebhook(token: string): Promise<WebhookPayload> {
  const config = payConfig();
  if (!config) throw new Error("Онлайн-оплата не подключена.");

  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("Уведомление не похоже на JWT.");

  const [rawHeader, rawPayload, rawSignature] = parts;
  const header = decodePart(rawHeader) as { alg?: string; kid?: string };

  // Алгоритм читаем из заголовка только для сверки: принимать «alg: none»
  // или чужой алгоритм по указанию самого токена — классическая дыра.
  if (header.alg !== "ES256") {
    throw new Error(`Неожиданный алгоритм подписи: ${header.alg}`);
  }

  /*
    Ключ строго по kid. Раньше при незнакомом kid брался первый попавшийся:
    подпись всё равно должна была сойтись с настоящим ключом Яндекса, так
    что дырой это не было, — но «не нашли, возьмём какой-нибудь» в проверке
    подписи не должно стоять. Ключей в JWKS обычно несколько, и молчаливый
    выбор чужого прячет настоящую причину отказа.
  */
  const keys = await jwks(config);
  const jwk = header.kid
    ? keys.find((k) => k.kid === header.kid)
    : keys.length === 1
      ? keys[0]
      : undefined;
  if (!jwk) {
    throw new Error(
      `Не нашли открытый ключ для проверки подписи (kid: ${header.kid ?? "не указан"}).`,
    );
  }

  const key = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });

  // ES256 в JWT — «сырая» пара r|s по 32 байта, а node ждёт DER. Просим
  // node принять её как есть, иначе подпись не сойдётся даже у верной.
  const valid = crypto.verify(
    "sha256",
    Buffer.from(`${rawHeader}.${rawPayload}`),
    { key, dsaEncoding: "ieee-p1363" },
    Buffer.from(rawSignature, "base64url"),
  );
  if (!valid) throw new Error("Подпись уведомления не сошлась.");

  const payload = decodePart(rawPayload) as WebhookPayload & {
    exp?: number;
    iat?: number;
  };

  const now = Math.floor(Date.now() / 1000);
  // Небольшой запас на расхождение часов: у сервера и у Яндекса они свои.
  const skew = 5 * 60;
  if (typeof payload.exp === "number" && payload.exp + skew < now) {
    throw new Error("Уведомление просрочено.");
  }
  if (payload.merchantId && payload.merchantId !== config.merchantId) {
    throw new Error("Уведомление адресовано другому магазину.");
  }

  return payload;
}

/** Оплачен ли заказ по-настоящему — деньги списаны. */
export function isPaid(status: PaymentStatus | undefined): boolean {
  return status === "CAPTURED";
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  none: "Без онлайн-оплаты",
  created: "Ссылка выдана",
  PENDING: "Ожидает оплаты",
  AUTHORIZED: "Деньги заморожены",
  CAPTURED: "Оплачен",
  VOIDED: "Заморозка снята",
  FAILED: "Оплата не прошла",
  REFUNDED: "Возвращён",
  PARTIALLY_REFUNDED: "Возвращён частично",
};
