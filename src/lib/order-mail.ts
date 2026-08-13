import { sendMailWithRetry, isMailerConfigured, type Letter } from "./mailer";
import { findCustomer } from "./customers";
import { formatPrice } from "./format";
import { phoneE164 } from "./phone";
import { SITE_URL } from "./site-url";
import { escapeHtml } from "./sanitize";
import type { Order } from "./types";

/*
  Письмо владельцу о новом заказе.

  Задача письма — чтобы заказ можно было принять прямо из почты на телефоне:
  видно, кто, что и на сколько, телефон нажимается для звонка и для WhatsApp,
  а ссылка ведёт сразу в карточку заказа в панели.

  Вёрстка — на инлайновых стилях и таблицах: почтовые клиенты (Яндекс, Gmail,
  Outlook) не понимают внешний CSS и капризны к разметке. Ничего внешнего:
  ни шрифтов, ни картинок — только системный шрифт и цвет.
*/

/** Часовой пояс магазина: Махачкала идёт по московскому времени. */
const TZ = "Europe/Moscow";

/** Фирменный оранжевый и тёмный — те же, что на сайте. */
const BRAND = "#e2571f";
const INK = "#141414";
const MUTED = "#8a8a8a";
const LINE = "#ededed";
const GREEN = "#1f9d55";
const FONT =
  "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

function moscowTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/*
  Экранирование для вставки в разметку письма — общее с сайтом, чтобы
  правило было одно на весь проект. Обязательно: имя, адрес и комментарий
  покупатель пишет сам, а письмо владелец открывает в почтовом клиенте.
*/
const esc = escapeHtml;

/** Тёмная шапка с брендом — общая для писем о заказе и об оплате. */
function header(): string {
  return `<div style="background:${INK};padding:22px 30px;">
    <div style="font-size:14px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#ffffff;">MOMO<span style="color:${BRAND};"> EQUIPPED</span></div>
  </div>`;
}

/** Оранжевая кнопка во всю ширину — ведёт в карточку заказа. */
function button(orderUrl: string): string {
  return `<a href="${orderUrl}" style="display:block;margin-top:28px;background:${BRAND};color:#ffffff;text-decoration:none;text-align:center;font-weight:700;font-size:16px;padding:16px 24px;border-radius:12px;">Открыть в панели →</a>`;
}

export function buildOrderLetter(order: Order): Letter {
  const when = moscowTime(order.createdAt);
  const e164 = phoneE164(order.customer.phone);
  const orderUrl = `${SITE_URL}/admin/orders`;

  // Вошедший покупатель — редкий, но ценный случай: у него есть почта,
  // и на письмо можно ответить прямо из ящика.
  const account = order.customerId ? findCustomer(order.customerId) : undefined;

  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const promo = order.promo;

  const text = [
    `Новый заказ №${order.id}`,
    when,
    "",
    ...order.items.map(
      (i) => `• ${i.title} — ${i.qty} шт. × ${formatPrice(i.price)} = ${formatPrice(i.price * i.qty)}`,
    ),
    promo
      ? `Скидка по промокоду ${promo.code} (${promo.percent}%): −${formatPrice(promo.discount)}`
      : "",
    `Итого: ${formatPrice(order.total)}`,
    "",
    `Покупатель: ${order.customer.name}`,
    `Телефон: ${order.customer.phone}`,
    `Адрес: ${order.customer.address}`,
    order.customer.comment ? `Комментарий: ${order.customer.comment}` : "",
    account ? `Аккаунт на сайте: ${account.email}` : "",
    "",
    `Открыть в панели: ${orderUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const itemRows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:14px 0;border-top:1px solid ${LINE};font-size:15px;line-height:1.4;">
          <span style="font-weight:600;">${esc(i.title)}</span><br>
          <span style="font-size:13px;color:${MUTED};">${i.qty} шт. × ${formatPrice(i.price)}</span>
        </td>
        <td style="padding:14px 0;border-top:1px solid ${LINE};text-align:right;white-space:nowrap;font-size:15px;font-weight:700;vertical-align:top;">${formatPrice(i.price * i.qty)}</td>
      </tr>`,
    )
    .join("");

  // Строки «Сумма» и «Скидка» показываем только когда есть промокод: без него
  // сумма и итог совпадают, и вторая строка лишь путала бы.
  const promoRows = promo
    ? `<tr>
        <td style="padding:16px 0 0;font-size:14px;color:#555;">Сумма</td>
        <td style="padding:16px 0 0;text-align:right;white-space:nowrap;font-size:14px;color:#555;">${formatPrice(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0 0;font-size:14px;color:${GREEN};">Промокод ${esc(promo.code)} (−${promo.percent}%)</td>
        <td style="padding:6px 0 0;text-align:right;white-space:nowrap;font-size:14px;font-weight:600;color:${GREEN};">−${formatPrice(promo.discount)}</td>
      </tr>`
    : "";

  const phoneBlock = e164
    ? `<a href="tel:${e164}" style="color:${BRAND};text-decoration:none;font-weight:700;">${esc(order.customer.phone)}</a>&nbsp;·&nbsp;<a href="https://wa.me/${e164.replace("+", "")}" style="color:${BRAND};text-decoration:none;font-weight:600;">WhatsApp</a>`
    : `<span style="font-weight:600;">${esc(order.customer.phone)}</span>`;

  const html = `
<div style="margin:0;padding:24px 16px;background:#f1f1f3;font-family:${FONT};color:${INK};">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    ${header()}
    <div style="padding:30px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND};">Новый заказ</p>
      <h1 style="margin:0 0 4px;font-size:28px;line-height:1.05;font-weight:800;letter-spacing:-0.02em;color:${INK};">№${esc(order.id)}</h1>
      <p style="margin:0 0 22px;font-size:13px;color:${MUTED};">${esc(when)}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${itemRows}
        ${promoRows}
        <tr>
          <td style="padding:16px 0 0;border-top:2px solid ${INK};font-size:16px;font-weight:700;">Итого</td>
          <td style="padding:16px 0 0;border-top:2px solid ${INK};text-align:right;white-space:nowrap;font-size:26px;font-weight:800;color:${BRAND};">${formatPrice(order.total)}</td>
        </tr>
      </table>

      <div style="margin-top:28px;padding-top:24px;border-top:1px solid ${LINE};">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};">Покупатель</p>
        <p style="margin:0;font-size:17px;font-weight:600;line-height:1.4;">${esc(order.customer.name)}</p>
        <p style="margin:8px 0 0;font-size:16px;line-height:1.5;">${phoneBlock}</p>
        <p style="margin:8px 0 0;font-size:14px;color:#666;line-height:1.5;">${esc(order.customer.address)}</p>
        ${
          order.customer.comment
            ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;background:#f6f6f7;border-radius:10px;padding:12px 14px;"><span style="color:${MUTED};">Комментарий:</span> ${esc(order.customer.comment)}</p>`
            : ""
        }
        ${
          account
            ? `<p style="margin:14px 0 0;font-size:13px;color:${MUTED};">Аккаунт на сайте: ${esc(account.email)}</p>`
            : ""
        }
      </div>

      ${button(orderUrl)}
      <p style="margin:20px 0 0;font-size:12px;color:#a8a8a8;text-align:center;">Автоматическое письмо · momo-eq.ru</p>
    </div>
  </div>
</div>`.trim();

  return {
    subject: `Новый заказ №${order.id} — ${formatPrice(order.total)}`,
    text,
    html,
    ...(account ? { replyTo: account.email } : {}),
  };
}

/**
 * Уведомить владельца о заказе.
 *
 * Никогда не бросает и ничего не возвращает вызывающему: заказ уже сохранён,
 * и упасть из-за почты он не должен. Ящик не подключён — выходим молча.
 */
export async function notifyNewOrder(order: Order): Promise<void> {
  if (!isMailerConfigured()) return;
  const result = await sendMailWithRetry(buildOrderLetter(order));
  if (!result.ok) throw new Error(`Письмо о заказе не отправлено: ${result.error}`);
}

/**
 * Отдельное письмо о том, что заказ оплачен.
 *
 * Нужно потому, что письмо о заказе приходит раньше денег: покупатель может
 * не дойти до оплаты. Отдельная строка «оплачен» избавляет от привычки
 * проверять каждый заказ руками.
 */
export async function notifyPaidOrder(order: Order): Promise<void> {
  if (!isMailerConfigured()) return;

  const paid = order.payment;
  const sum = formatPrice(paid?.amount ?? order.total);
  const test = paid?.sandbox === true;
  const orderUrl = `${SITE_URL}/admin/orders`;
  const shipment = order.delivery?.shipment;
  const deliveryLine = order.delivery
    ? shipment?.status === "created"
      ? `Ozon Доставка создана: №${shipment.orderNumber ?? "—"}, ${order.delivery.address}`
      : shipment?.status === "failed"
        ? `ВНИМАНИЕ: Ozon Доставка не создалась — ${shipment.error ?? "неизвестная ошибка"}`
        : `Ozon Доставка: ${order.delivery.address}`
    : "";

  const html = `
<div style="margin:0;padding:24px 16px;background:#f1f1f3;font-family:${FONT};color:${INK};">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    ${header()}
    <div style="padding:30px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${GREEN};">Оплачено</p>
      <h1 style="margin:0 0 6px;font-size:28px;line-height:1.05;font-weight:800;letter-spacing:-0.02em;color:${INK};">№${esc(order.id)}</h1>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;color:${BRAND};">${sum}${
        test
          ? `<span style="display:block;font-size:12px;font-weight:600;color:${MUTED};margin-top:4px;">тестовая оплата, деньги не настоящие</span>`
          : ""
      }</p>
      <p style="margin:0;font-size:17px;font-weight:600;">${esc(order.customer.name)}</p>
      <p style="margin:6px 0 0;font-size:14px;color:#666;line-height:1.5;">${esc(order.customer.phone)}<br>${esc(order.customer.address)}</p>
      ${deliveryLine ? `<p style="margin:14px 0 0;padding:12px;border-radius:10px;background:#f6f6f6;font-size:13px;line-height:1.5;">${esc(deliveryLine)}</p>` : ""}
      ${button(orderUrl)}
      <p style="margin:20px 0 0;font-size:12px;color:#a8a8a8;text-align:center;">Автоматическое письмо · momo-eq.ru</p>
    </div>
  </div>
</div>`.trim();

  const result = await sendMailWithRetry({
      subject: `Оплачен заказ №${order.id} — ${sum}${test ? " (тестовая оплата)" : ""}`,
      text: [
        `Заказ №${order.id} оплачен: ${sum}${test ? " (тестовая оплата)" : ""}`,
        `Покупатель: ${order.customer.name}, ${order.customer.phone}`,
        `Адрес: ${order.customer.address}`,
        deliveryLine,
        "",
        `Открыть в панели: ${orderUrl}`,
      ].join("\n"),
      html,
  });
  if (!result.ok) throw new Error(`Письмо об оплате не отправлено: ${result.error}`);
}

/**
 * Почта покупателя хранится и в снимке заказа, и в аккаунте. Второй источник
 * нужен для заказов, созданных до добавления customer.email в Order.
 */
export function customerEmailForOrder(order: Order): string | null {
  const accountEmail = order.customerId
    ? findCustomer(order.customerId)?.email
    : undefined;
  const email = (order.customer.email || accountEmail || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Письмо покупателю не подменяет фискальный чек — его формирует онлайн-касса. */
export function buildCustomerPaymentLetter(order: Order): Letter | null {
  const email = customerEmailForOrder(order);
  if (!email) return null;

  const sum = formatPrice(order.payment?.amount ?? order.total);
  const profileUrl = `${SITE_URL}/profile`;
  const itemRows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:12px 0;border-top:1px solid ${LINE};font-size:14px;line-height:1.4;">
          <span style="font-weight:600;">${esc(item.title)}</span><br>
          <span style="font-size:12px;color:${MUTED};">${item.qty} шт. × ${formatPrice(item.price)}</span>
        </td>
        <td style="padding:12px 0;border-top:1px solid ${LINE};text-align:right;white-space:nowrap;font-size:14px;font-weight:700;vertical-align:top;">${formatPrice(item.price * item.qty)}</td>
      </tr>`,
    )
    .join("");

  const shipment = order.delivery?.shipment;
  const deliveryText = shipment?.status === "created"
    ? `Отправление Ozon создано: №${shipment.orderNumber ?? "—"}.`
    : order.delivery
      ? "Отправление Ozon готовится. Статус появится в личном кабинете."
      : "Менеджер свяжется с вами для подтверждения доставки.";

  const text = [
    `Здравствуйте, ${order.customer.name}!`,
    "",
    `Оплата заказа №${order.id} подтверждена. Сумма: ${sum}.`,
    ...order.items.map(
      (item) => `• ${item.title} — ${item.qty} шт. × ${formatPrice(item.price)}`,
    ),
    "",
    deliveryText,
    "Фискальный чек должен прийти отдельным письмом от оператора онлайн-кассы на этот же адрес.",
    "Если чек не пришёл, ответьте на это письмо — мы проверим его в кассе.",
    "",
    `Личный кабинет: ${profileUrl}`,
  ].join("\n");

  const html = `
<div style="margin:0;padding:24px 16px;background:#f1f1f3;font-family:${FONT};color:${INK};">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    ${header()}
    <div style="padding:30px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${GREEN};">Оплата подтверждена</p>
      <h1 style="margin:0 0 8px;font-size:28px;line-height:1.05;font-weight:800;letter-spacing:-0.02em;color:${INK};">Заказ №${esc(order.id)}</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.5;">Здравствуйте, ${esc(order.customer.name)}!</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${itemRows}
        <tr>
          <td style="padding:16px 0 0;border-top:2px solid ${INK};font-size:16px;font-weight:700;">Оплачено</td>
          <td style="padding:16px 0 0;border-top:2px solid ${INK};text-align:right;white-space:nowrap;font-size:24px;font-weight:800;color:${BRAND};">${sum}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;padding:14px;border-radius:10px;background:#f6f6f7;font-size:14px;line-height:1.55;">${esc(deliveryText)}</p>
      <div style="margin-top:16px;padding:14px;border:1px solid ${LINE};border-radius:10px;font-size:13px;line-height:1.55;color:#555;">
        Фискальный чек должен прийти отдельным письмом от оператора онлайн-кассы на этот же адрес. Если чек не пришёл, ответьте на это письмо — мы проверим его в кассе.
      </div>
      <a href="${profileUrl}" style="display:block;margin-top:24px;background:${BRAND};color:#ffffff;text-decoration:none;text-align:center;font-weight:700;font-size:15px;padding:15px 24px;border-radius:12px;">Открыть личный кабинет →</a>
      <p style="margin:20px 0 0;font-size:12px;color:#a8a8a8;text-align:center;">Автоматическое письмо · momo-eq.ru</p>
    </div>
  </div>
</div>`.trim();

  return {
    to: [email],
    subject: `Оплата заказа №${order.id} подтверждена — ${sum}`,
    text,
    html,
  };
}

/** Отдельная задача: сбой письма покупателю не дублирует письмо администратору. */
export async function notifyCustomerPaidOrder(order: Order): Promise<void> {
  if (!isMailerConfigured()) return;
  const letter = buildCustomerPaymentLetter(order);
  if (!letter) return;
  const result = await sendMailWithRetry(letter);
  if (!result.ok) {
    throw new Error(`Письмо покупателю об оплате не отправлено: ${result.error}`);
  }
}
