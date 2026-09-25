import { escapeHtml } from "./sanitize";
import { sendMailWithRetry, type Letter } from "./mailer";
import { SITE_URL } from "./site-url";
import { DEALER_ORDER_STATUS_LABELS } from "./dealer-order-ui";
import type { DealerOrderAgreement } from "./dealer-order-management";
import type { DealerAccount, DealerApplication, DealerLocation, DealerOrder, DealerOrderStatus } from "./types";

const shell = (body: string) => `<div style="margin:0;padding:24px 16px;background:#f2f2f3;font-family:Arial,sans-serif;color:#18181b"><div style="max-width:580px;margin:auto;background:#fff;border-radius:14px;overflow:hidden"><div style="padding:18px 28px;background:#111;color:#fff;font-weight:800">Modern Original <span style="color:#ff5500">Music Organization</span></div><div style="padding:28px">${body}</div></div></div>`;

export async function notifyDealerApplication(application: DealerApplication): Promise<void> {
  const text = `Новая дилерская заявка\n${application.company}\n${application.city}\n${application.contactName}\n${application.phone}\n${application.email}`;
  await sendMailWithRetry({
    subject: `Дилерская заявка — ${application.company}, ${application.city}`,
    text,
    replyTo: application.email,
    html: shell(`<p style="margin:0 0 4px;color:#ff5500;font-size:12px;font-weight:700;text-transform:uppercase">Новая дилерская заявка</p><h1 style="margin:0 0 18px;font-size:26px">${escapeHtml(application.company)}</h1><p><b>Город:</b> ${escapeHtml(application.city)}<br><b>Контакт:</b> ${escapeHtml(application.contactName)}<br><b>Телефон:</b> ${escapeHtml(application.phone)}<br><b>Email:</b> ${escapeHtml(application.email)}</p><a href="${SITE_URL}/admin/dealers" style="display:inline-block;margin-top:16px;background:#ff5500;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">Открыть в панели</a>`),
  });
}
export async function sendDealerInvite(
  account: DealerAccount,
  dealer: DealerLocation,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${SITE_URL}/dealer/activate?token=${encodeURIComponent(token)}`;
  const result = await sendMailWithRetry({
    to: [account.email],
    subject: "Доступ в дилерский кабинет MOMO/ZEUS",
    text: `Здравствуйте, ${account.contactName}!\n\nДля ${dealer.name} создан дилерский кабинет. Задайте пароль по одноразовой ссылке (действует 72 часа):\n${url}`,
    html: shell(`<h1 style="margin:0 0 12px;font-size:26px">Дилерский кабинет готов</h1><p style="line-height:1.6">Здравствуйте, ${escapeHtml(account.contactName)}. Для <b>${escapeHtml(dealer.name)}</b> создан доступ к дилерским ценам, остаткам, заказам и материалам.</p><a href="${url}" style="display:block;margin-top:22px;background:#ff5500;color:#fff;text-align:center;text-decoration:none;padding:15px;border-radius:8px;font-weight:700">Задать пароль</a><p style="margin-top:16px;color:#777;font-size:13px">Ссылка действует 72 часа и станет недействительной после установки пароля.</p>`),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function sendDealerPasswordReset(
  account: DealerAccount,
  dealer: DealerLocation,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${SITE_URL}/dealer/activate?token=${encodeURIComponent(token)}`;
  const result = await sendMailWithRetry({
    to: [account.email],
    subject: "Новый пароль дилерского кабинета MOMO/ZEUS",
    text: `Здравствуйте, ${account.contactName}!\n\nДля ${dealer.name} запрошена смена пароля. Задайте новый пароль по одноразовой ссылке (действует 72 часа):\n${url}\n\nЕсли это были не вы — не открывайте ссылку.`,
    html: shell(`<h1 style="margin:0 0 12px;font-size:26px">Смена пароля дилера</h1><p style="line-height:1.6">Здравствуйте, ${escapeHtml(account.contactName)}. Для <b>${escapeHtml(dealer.name)}</b> запрошен новый пароль.</p><a href="${url}" style="display:block;margin-top:22px;background:#ff5500;color:#fff;text-align:center;text-decoration:none;padding:15px;border-radius:8px;font-weight:700">Задать новый пароль</a><p style="margin-top:16px;color:#777;font-size:13px">Ссылка действует 72 часа. Если это были не вы — не открывайте её.</p>`),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function notifyDealerOrder(order: DealerOrder, dealer: DealerLocation): Promise<void> {
  const result = await sendMailWithRetry(dealerManagerOrderLetter(order, dealer));
  if (!result.ok) throw new Error(result.error);
}

export function dealerManagerOrderLetter(order: DealerOrder, dealer: DealerLocation, account?: DealerAccount): Letter {
  return {
    subject: `Дилерский заказ ${order.id} — ${dealer.name}`,
    ...(account ? { replyTo: account.email } : {}),
    text: [`Новый дилерский заказ ${order.id}`, dealer.name, account ? `${account.contactName}, ${account.email}, ${dealer.phone}` : dealer.phone, ...order.items.map((item) => `${item.title} × ${item.qty} — ${item.price} ₽ / шт.`), `Итого: ${order.total} ₽`, order.comment ? `Комментарий: ${order.comment}` : "", `${SITE_URL}/admin/dealers/orders/${encodeURIComponent(order.id)}`].filter(Boolean).join("\n"),
    html: shell(`<p style="margin:0 0 4px;color:#ff5500;font-size:12px;font-weight:700;text-transform:uppercase">Дилерский заказ</p><h1 style="margin:0 0 12px;font-size:26px">${escapeHtml(order.id)}</h1><p><b>${escapeHtml(dealer.name)}</b>, ${escapeHtml(dealer.city)}</p>${account ? `<p>${escapeHtml(account.contactName)} · ${escapeHtml(account.email)} · ${escapeHtml(dealer.phone)}</p>` : ""}<ul>${order.items.map((item) => `<li>${escapeHtml(item.title)} × ${item.qty} — ${item.price.toLocaleString("ru-RU")} ₽ / шт.</li>`).join("")}</ul><p style="font-size:20px;font-weight:800">${order.total.toLocaleString("ru-RU")} ₽</p>${order.comment ? `<p>Комментарий: ${escapeHtml(order.comment)}</p>` : ""}<a href="${SITE_URL}/admin/dealers/orders/${encodeURIComponent(order.id)}" style="display:inline-block;margin-top:12px;background:#ff5500;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">Открыть заказ</a>`),
  };
}

export function dealerCustomerOrderLetter(order: DealerOrder, account: DealerAccount | undefined, status: DealerOrderStatus, created: boolean): Letter {
  const title = created ? "Заявка получена" : `Статус: ${DEALER_ORDER_STATUS_LABELS[status]}`;
  const message = created ? "Менеджер проверит наличие и согласует с вами доставку и оплату." : "Подробности и согласованные условия доступны в кабинете.";
  const url = `${SITE_URL}/dealer/orders/${encodeURIComponent(order.id)}`;
  return {
    to: [account?.email ?? ""],
    subject: `MOMO · заказ ${order.id} · ${title}`,
    text: `${title}\nЗаказ ${order.id}\n${message}\n${url}`,
    html: shell(`<h1 style="font-size:25px">${escapeHtml(title)}</h1><p>Заказ <b>${escapeHtml(order.id)}</b></p><p>${escapeHtml(message)}</p><a href="${url}">Открыть заказ в кабинете</a>`),
  };
}

export function dealerAgreementLetter(agreement: DealerOrderAgreement, account: DealerAccount | undefined): Letter {
  const url = `${SITE_URL}/dealer/orders/${encodeURIComponent(agreement.orderId)}`;
  const lines = [
    `Менеджер обновил условия заказа ${agreement.orderId} (версия ${agreement.revision})`,
    ...agreement.items.map((item) => `${item.title} × ${item.qty}`),
    `Товары: ${agreement.subtotal} ₽`, `Доставка: ${agreement.deliveryCost} ₽`, `Итого: ${agreement.total} ₽`,
    agreement.deliveryMethod, agreement.deliveryAddress, agreement.paymentTerms,
    agreement.invoiceReference ? `Счёт: ${agreement.invoiceReference}` : "",
    agreement.trackingNumber ? `Трек-номер: ${agreement.trackingNumber}` : "",
    agreement.managerMessage,
  ].filter(Boolean);
  return { to: [account?.email ?? ""], subject: `MOMO · условия заказа ${agreement.orderId}`, text: `${lines.join("\n")}\n${url}`, html: shell(`<h1 style="font-size:24px">Условия заказа обновлены</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}<a href="${url}">Открыть заказ в кабинете</a>`) };
}
