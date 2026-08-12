"use server";

import { clientIp } from "@/lib/client-ip";
import { addOrder, setOrderPayment } from "@/lib/orders";
import { notifyNewOrder } from "@/lib/order-mail";
import { createPayment, isPayConfigured } from "@/lib/yandex-pay";
import { getProducts, siteConfig } from "@/lib/data";
import { isInStock, stockLimit } from "@/lib/format";
import { currentCustomer } from "@/lib/customer-auth";
import { findValidPromo, discountFor, usePromo } from "@/lib/promos";
import {
  searchRussianPlaces,
  type PublicPlaceResult,
} from "@/lib/place-search";
import type { Order, OrderItem } from "@/lib/types";
import {
  consumeOzonSelection,
  getOzonMapArea,
  quoteOzonPickup,
  type OzonMapArea,
  type OzonMapViewport,
  type OzonDeliverySelection,
} from "@/lib/ozon-delivery";

export async function loadOzonPickupMap(payload: {
  viewport: OzonMapViewport;
  zoom: number;
}): Promise<
  | { ok: true; area: OzonMapArea }
  | { ok: false; error: string }
> {
  try {
    const area = await getOzonMapArea(payload.viewport, payload.zoom);
    return { ok: true, area };
  } catch (error) {
    console.error("Ozon Доставка: загрузка карты ПВЗ не удалась", error);
    return { ok: false, error: "Не удалось загрузить пункты Ozon. Попробуйте ещё раз." };
  }
}

export async function searchPickupPlace(query: string): Promise<
  | { ok: true; places: PublicPlaceResult[] }
  | { ok: false; error: string }
> {
  try {
    const places = await searchRussianPlaces(query);
    return places.length
      ? { ok: true, places }
      : { ok: false, error: "Город или адрес не найден. Уточните запрос." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось найти адрес.";
    return { ok: false, error: message };
  }
}

export async function selectOzonPickup(payload: {
  phone: string;
  pointId: number;
  items: { slug: string; qty: number }[];
}): Promise<
  | { ok: true; delivery: OzonDeliverySelection }
  | { ok: false; error: string }
> {
  try {
    const delivery = await quoteOzonPickup(payload);
    return { ok: true, delivery };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось рассчитать доставку.";
    return { ok: false, error: message };
  }
}

/* Проверка промокода из корзины: показать скидку до оформления. */
export async function checkPromo(
  code: string,
): Promise<
  { ok: true; code: string; percent: number } | { ok: false; error: string }
> {
  const promo = findValidPromo(typeof code === "string" ? code : "");
  if (!promo) {
    return { ok: false, error: "Промокод не найден или больше не действует." };
  }
  return { ok: true, code: promo.code, percent: promo.percent };
}

/*
  Приём заказа с сайта.

  Раньше заказ уходил только ссылкой в WhatsApp: если менеджер её потерял,
  следов не оставалось. Теперь заказ сначала сохраняется на сервере и
  получает номер, а переписка остаётся привычным каналом связи.

  Цены берём из каталога, а не из того, что прислал браузер: присланному
  можно подставить любую сумму.
*/

const MAX_PER_HOUR = 10;
/** Потолок штук одного товара в заказе — на случай, если остаток не ведётся. */
const MAX_QTY = 99;
/** Потолок строк в одном заказе: весь каталог с запасом. */
const MAX_LINES = 200;
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
  | { ok: false; error: string; requiresAuth?: boolean };

export async function submitOrder(payload: {
  name: string;
  phone: string;
  address: string;
  comment?: string;
  items: { slug: string; qty: number }[];
  /** Покупатель выбрал оплату на сайте, а не переписку с менеджером. */
  pay?: boolean;
  /** Промокод из корзины — проверяем и применяем ЗДЕСЬ, на сервере. */
  promoCode?: string;
  /** Одноразовый серверный расчёт Ozon Доставки. */
  deliveryToken?: string;
}): Promise<OrderResult> {
  const me = await currentCustomer();

  // Клиентская кнопка тоже проверяет вход, но серверное действие можно
  // вызвать в обход интерфейса. Платёж без настоящей серверной сессии не
  // создаём ни при каких обстоятельствах.
  if (payload.pay && !me) {
    return {
      ok: false,
      error: "Для оплаты на сайте войдите или зарегистрируйтесь.",
      requiresAuth: true,
    };
  }

  const ip = await clientIp();

  if (tooManyFrom(ip)) {
    return { ok: false, error: "Слишком много заказов подряд. Напишите нам в WhatsApp." };
  }

  /*
    Всё, что приходит сюда, приходит из сети: действие вызывается и в обход
    формы. Строки обрезаем по длине, а не только по пробелам — иначе в
    orders.json уезжает мегабайт текста на заказ, и файл растёт, пока
    панель не перестанет открываться.
  */
  const text = (value: unknown, limit: number): string =>
    typeof value === "string" ? value.trim().slice(0, limit) : "";

  const name = text(payload.name, 100);
  const phone = text(payload.phone, 30);
  const address = text(payload.address, 300);
  const comment = text(payload.comment, 1000);

  if (!name || !phone || !address) {
    return { ok: false, error: "Заполните имя, телефон и адрес." };
  }
  if (phone.replace(/\D/g, "").length < 11) {
    return { ok: false, error: "Проверьте телефон." };
  }
  if (payload.pay && name.split(/\s+/).filter(Boolean).length < 2) {
    return { ok: false, error: "Для Ozon Доставки укажите фамилию и имя." };
  }
  if (!Array.isArray(payload.items) || !payload.items.length) {
    return { ok: false, error: "Корзина пуста." };
  }
  if (payload.items.length > MAX_LINES) {
    return { ok: false, error: "Слишком много позиций в заказе." };
  }

  const catalog = new Map(getProducts().map((p) => [p.slug, p]));

  /*
    Складываем повторы одного товара. Корзина такого не присылает, но
    действие вызывается и в обход неё, а без сложения потолок остатка
    обходится разбиением покупки на несколько строк.
  */
  const wanted = new Map<string, number>();
  for (const line of payload.items) {
    if (typeof line?.slug !== "string") continue;
    /*
      Количество обязано быть числом. Прежний Math.max(1, Math.min(Math.round(x), 99))
      на «abc» или undefined давал NaN, а JSON.stringify пишет NaN как null —
      в панель приезжал заказ с «qty: null» и «total: null».
    */
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty < 1) continue;
    wanted.set(line.slug, (wanted.get(line.slug) ?? 0) + Math.round(qty));
  }

  const items: OrderItem[] = [];
  let missing = false;
  for (const [slug, requested] of wanted) {
    const product = catalog.get(slug);
    if (!product) continue; // товар успели снять с витрины

    /*
      Наличие и остаток проверяем здесь. Раньше это жило только в браузере
      (кнопка «Под заказ» и capFor в cart-store), то есть заказать отсутствующее
      мешала лишь неактивная кнопка.
    */
    if (isInStock(product) === false) {
      missing = true;
      continue;
    }
    const cap = Math.min(stockLimit(product) ?? MAX_QTY, MAX_QTY);
    if (cap < 1) {
      missing = true;
      continue;
    }

    items.push({
      slug: product.slug,
      title: product.title,
      price: product.price,
      qty: Math.max(1, Math.min(requested, cap)),
    });
  }

  if (!items.length) {
    return {
      ok: false,
      error: missing
        ? "Этих товаров сейчас нет в наличии — напишите нам, привезём под заказ."
        : "Товары из корзины больше не продаются — обновите страницу.",
    };
  }

  /*
    Промокод применяем на сервере: процент берём из файла промокодов, а не из
    браузера. total у заказа — уже итог со скидкой; онлайн-оплата (createPayment)
    считает по проценту из order.promo, чтобы позиции сходились с суммой.
  */
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  let total = subtotal;
  let promo: Order["promo"];
  if (typeof payload.promoCode === "string" && payload.promoCode.trim()) {
    const valid = findValidPromo(payload.promoCode);
    if (valid) {
      const discount = discountFor(subtotal, valid.percent);
      total = subtotal - discount;
      promo = { code: valid.code, percent: valid.percent, discount };
    }
  }

  if (payload.pay && total < siteConfig.trust.freeShippingFrom) {
    return {
      ok: false,
      error: `Онлайн-доставка Ozon доступна от ${siteConfig.trust.freeShippingFrom.toLocaleString("ru-RU")} ₽. Для меньшей суммы оформите заказ через WhatsApp.`,
    };
  }

  try {
    let delivery: Order["delivery"];
    if (payload.pay) {
      if (!payload.deliveryToken) {
        return { ok: false, error: "Выберите пункт Ozon перед оплатой." };
      }
      try {
        delivery = consumeOzonSelection(payload.deliveryToken, phone, items);
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Пересчитайте доставку.",
        };
      }
    }

    const order = addOrder({
      customer: {
        name,
        phone,
        address,
        ...(comment ? { comment } : {}),
      },
      items,
      total,
      ...(promo ? { promo } : {}),
      ...(me ? { customerId: me.id } : {}),
      ...(payload.pay ? { paymentRequested: true } : {}),
      ...(delivery ? { delivery } : {}),
    });

    // Активацию списываем после сохранения заказа — код применён.
    if (promo) usePromo(promo.code);

    /*
      Для WhatsApp-заявки письмо отправляем сразу и не задерживаем покупателя
      ожиданием SMTP. Онлайн-заказ пока остаётся технической заготовкой:
      письмо и строка в панели появятся после подтверждённого списания.
    */
    // Онлайн-заказ сообщаем владельцу только после CAPTURED из вебхука.
    // Заявка через WhatsApp по-прежнему появляется и отправляется сразу.
    if (!payload.pay) void notifyNewOrder(order);

    /*
      Оплата на сайте. Техническая запись уже получила уникальный номер, но
      скрыта от рабочей панели. Если Яндекс не создаст свежую ссылку, вернём
      ошибку и не будем превращать неудачную оплату в заказ менеджеру.
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
        return {
          ok: false,
          error: "Яндекс Pay сейчас не создал новую ссылку. Попробуйте ещё раз через минуту.",
        };
      }
    }

    if (payload.pay) {
      return {
        ok: false,
        error: "Оплата на сайте временно недоступна. Попробуйте ещё раз позже.",
      };
    }

    return { ok: true, id: order.id };
  } catch (e) {
    // Для WhatsApp клиент всё равно сможет отправить состав менеджеру. Для
    // онлайн-оплаты показываем ошибку и не начинаем платёж без локальной записи.
    console.error("Не удалось сохранить заказ:", e);
    return { ok: false, error: "Не получилось сохранить заказ на сайте." };
  }
}
