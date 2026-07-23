"use server";

import { clientIp } from "@/lib/client-ip";
import { addOrder, setOrderPayment } from "@/lib/orders";
import { notifyNewOrder } from "@/lib/order-mail";
import { createPayment, isPayConfigured } from "@/lib/yandex-pay";
import { getProducts } from "@/lib/data";
import { currentCustomer } from "@/lib/customer-auth";
import type { OrderItem } from "@/lib/types";

/*
  Приём заказа с сайта.

  Раньше заказ уходил только ссылкой в WhatsApp: если менеджер её потерял,
  следов не оставалось. Теперь заказ сначала сохраняется на сервере и
  получает номер, а переписка остаётся привычным каналом связи.

  Цены берём из каталога, а не из того, что прислал браузер: присланному
  можно подставить любую сумму.
*/

const MAX_PER_HOUR = 10;
const recent = new Map<string, number[]>();

/*
  Потолок на число отслеживаемых адресов. Карта живёт всё время работы
  процесса, и без потолка поток заказов с меняющихся адресов раздувал бы её
  до перезапуска по max_memory_restart — то есть до обнуления всех счётчиков.
*/
const MAX_TRACKED = 5000;
const HOUR_MS = 60 * 60 * 1000;

function forget(now: number): void {
  for (const [ip, times] of recent) {
    if (times.every((t) => now - t >= HOUR_MS)) recent.delete(ip);
  }
  // Всё ещё полна — значит адреса живые: расстаёмся с самыми давними
  // (Map отдаёт ключи в порядке добавления).
  while (recent.size >= MAX_TRACKED) {
    const oldest = recent.keys().next().value;
    if (oldest === undefined) break;
    recent.delete(oldest);
  }
}

function tooManyFrom(ip: string): boolean {
  const now = Date.now();
  if (!recent.has(ip) && recent.size >= MAX_TRACKED) forget(now);

  const list = (recent.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  recent.set(ip, [...list, now]);
  return list.length >= MAX_PER_HOUR;
}

export type OrderResult =
  | { ok: true; id: string; paymentUrl?: string }
  | { ok: false; error: string };

export async function submitOrder(payload: {
  name: string;
  phone: string;
  address: string;
  comment?: string;
  items: { slug: string; qty: number }[];
  /** Покупатель выбрал оплату на сайте, а не переписку с менеджером. */
  pay?: boolean;
}): Promise<OrderResult> {
  const ip = await clientIp();

  if (tooManyFrom(ip)) {
    return { ok: false, error: "Слишком много заказов подряд. Напишите нам в WhatsApp." };
  }

  const name = payload.name.trim();
  const phone = payload.phone.trim();
  const address = payload.address.trim();

  if (!name || !phone || !address) {
    return { ok: false, error: "Заполните имя, телефон и адрес." };
  }
  if (phone.replace(/\D/g, "").length < 11) {
    return { ok: false, error: "Проверьте телефон." };
  }
  if (!payload.items.length) {
    return { ok: false, error: "Корзина пуста." };
  }

  const catalog = new Map(getProducts().map((p) => [p.slug, p]));
  const items: OrderItem[] = [];
  for (const line of payload.items) {
    const product = catalog.get(line.slug);
    if (!product) continue; // товар успели снять с витрины
    const qty = Math.max(1, Math.min(Math.round(line.qty), 99));
    items.push({
      slug: product.slug,
      title: product.title,
      price: product.price,
      qty,
    });
  }

  if (!items.length) {
    return {
      ok: false,
      error: "Товары из корзины больше не продаются — обновите страницу.",
    };
  }

  // Вошедшему покупателю привязываем заказ к аккаунту — так он увидит его
  // в своём кабинете с любого устройства, а владелец в панели узнает, что
  // это постоянный клиент.
  const me = await currentCustomer();

  try {
    const order = addOrder({
      customer: {
        name,
        phone,
        address,
        ...(payload.comment?.trim() ? { comment: payload.comment.trim() } : {}),
      },
      items,
      total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
      ...(me ? { customerId: me.id } : {}),
    });

    /*
      Письмо владельцу отправляем вдогонку, не дожидаясь почтового сервера:
      покупатель в этот момент стоит перед кнопкой, а разговор с SMTP —
      это секунды. Заказ уже сохранён, так что потеря письма ничего не
      обрывает; сбой уедет в лог, а результат последней отправки видно
      в панели.
    */
    void notifyNewOrder(order);

    /*
      Оплата на сайте. Ссылку заводим только по просьбе покупателя: заказ
      уже сохранён, и если Яндекс Пэй сейчас недоступен, терять заявку
      из-за этого нельзя — вернём номер без ссылки, а менеджер разберётся
      перепиской, как раньше.
    */
    if (payload.pay && isPayConfigured()) {
      try {
        const payment = await createPayment(order);
        setOrderPayment(order.id, {
          status: "created",
          url: payment.url,
          token: payment.token,
          amount: payment.amount,
          updatedAt: new Date().toISOString(),
          sandbox: payment.sandbox,
        });
        return { ok: true, id: order.id, paymentUrl: payment.url };
      } catch (e) {
        console.error(`Заказ ${order.id}: не удалось создать платёж`, e);
      }
    }

    return { ok: true, id: order.id };
  } catch (e) {
    // Панель не настроена или диск недоступен — заказ не потерян, покупателя
    // отправляем в WhatsApp, где заявку примет менеджер.
    console.error("Не удалось сохранить заказ:", e);
    return { ok: false, error: "Не получилось сохранить заказ на сайте." };
  }
}
