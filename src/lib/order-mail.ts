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
*/

/** Часовой пояс магазина: Махачкала идёт по московскому времени. */
const TZ = "Europe/Moscow";

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

export function buildOrderLetter(order: Order): Letter {
  const when = moscowTime(order.createdAt);
  const e164 = phoneE164(order.customer.phone);
  const orderUrl = `${SITE_URL}/admin/orders`;

  // Вошедший покупатель — редкий, но ценный случай: у него есть почта,
  // и на письмо можно ответить прямо из ящика.
  const account = order.customerId ? findCustomer(order.customerId) : undefined;

  const rows = order.items.map((i) => ({
    title: i.title,
    qty: `${i.qty} шт.`,
    sum: formatPrice(i.price * i.qty),
    each: formatPrice(i.price),
  }));

  const text = [
    `Новый заказ №${order.id}`,
    when,
    "",
    ...order.items.map((i) => `• ${i.title} — ${i.qty} шт. × ${formatPrice(i.price)}`),
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

  const cell = "padding:8px 0;border-bottom:1px solid #e6e6e6;font-size:14px;";
  const muted = "color:#767676;font-size:13px;";

  const html = `
<div style="margin:0;padding:24px 16px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#151515;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;">
    <p style="margin:0 0 4px;${muted}">${esc(when)}</p>
    <h1 style="margin:0 0 20px;font-size:20px;line-height:1.3;">Новый заказ №${esc(order.id)}</h1>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      ${rows
        .map(
          (r) => `<tr>
        <td style="${cell}">${esc(r.title)}<br><span style="${muted}">${r.qty} × ${r.each}</span></td>
        <td style="${cell}text-align:right;white-space:nowrap;font-weight:600;">${r.sum}</td>
      </tr>`,
        )
        .join("")}
      <tr>
        <td style="padding:12px 0;font-size:15px;font-weight:700;">Итого</td>
        <td style="padding:12px 0;text-align:right;font-size:18px;font-weight:700;">${formatPrice(order.total)}</td>
      </tr>
    </table>

    <h2 style="margin:20px 0 8px;font-size:15px;">Покупатель</h2>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;">
      ${esc(order.customer.name)}<br>
      ${
        e164
          ? `<a href="tel:${e164}" style="color:#e2571f;text-decoration:none;font-weight:600;">${esc(order.customer.phone)}</a>
             &nbsp;·&nbsp;
             <a href="https://wa.me/${e164.replace("+", "")}" style="color:#e2571f;text-decoration:none;">WhatsApp</a>`
          : esc(order.customer.phone)
      }<br>
      <span style="${muted}">${esc(order.customer.address)}</span>
    </p>
    ${
      order.customer.comment
        ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.6;"><b>Комментарий:</b> ${esc(order.customer.comment)}</p>`
        : ""
    }
    ${
      account
        ? `<p style="margin:10px 0 0;${muted}">Есть аккаунт на сайте: ${esc(account.email)}</p>`
        : ""
    }

    <p style="margin:24px 0 0;">
      <a href="${orderUrl}" style="display:inline-block;background:#e2571f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px;">Открыть в панели</a>
    </p>

    <p style="margin:20px 0 0;${muted}">Письмо отправлено сайтом momo-eq.ru автоматически.</p>
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

  try {
    const result = await sendMailWithRetry(buildOrderLetter(order));
    if (!result.ok) {
      console.error(`Заказ ${order.id}: письмо не отправлено — ${result.error}`);
    }
  } catch (e) {
    console.error(`Заказ ${order.id}: сбой отправки письма`, e);
  }
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
  const test = paid?.sandbox ? " (тестовая оплата)" : "";
  const orderUrl = `${SITE_URL}/admin/orders`;

  try {
    const result = await sendMailWithRetry({
      subject: `Оплачен заказ №${order.id} — ${sum}${test}`,
      text: [
        `Заказ №${order.id} оплачен: ${sum}${test}`,
        `Покупатель: ${order.customer.name}, ${order.customer.phone}`,
        `Адрес: ${order.customer.address}`,
        "",
        `Открыть в панели: ${orderUrl}`,
      ].join("\n"),
      html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#151515;">
  <p style="font-size:18px;"><b>Заказ №${esc(order.id)} оплачен — ${sum}</b>${test ? `<br><span style="color:#767676;font-size:13px;">тестовая оплата, деньги не настоящие</span>` : ""}</p>
  <p>${esc(order.customer.name)} · ${esc(order.customer.phone)}<br>
  <span style="color:#767676;font-size:13px;">${esc(order.customer.address)}</span></p>
  <p style="margin-top:20px;"><a href="${orderUrl}" style="display:inline-block;background:#e2571f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px;">Открыть в панели</a></p>
</div>`,
    });
    if (!result.ok) {
      console.error(`Заказ ${order.id}: письмо об оплате не ушло — ${result.error}`);
    }
  } catch (e) {
    console.error(`Заказ ${order.id}: сбой письма об оплате`, e);
  }
}
