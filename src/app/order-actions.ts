"use server";

import { clientIp } from "@/lib/client-ip";
import { addOrder, setOrderPayment, updateOrder } from "@/lib/orders";
import { enqueueIntegrationJob, runIntegrationQueue } from "@/lib/job-queue";
import { createPayment, isPayConfigured } from "@/lib/yandex-pay";
import { getProducts } from "@/lib/data";
import { isInStock, stockLimit } from "@/lib/format";
import { currentCustomer } from "@/lib/customer-auth";
import { findValidPromo, promoDiscountForItems, redeemPromo } from "@/lib/promos";
import {
  searchRussianPlaces,
  type PublicPlaceResult,
} from "@/lib/place-search";
import type { Order, OrderItem } from "@/lib/types";
import {
  attachBonusToOrder,
  getBonusSummary,
  maxRedeemableBonus,
  releaseBonusReservation,
  reserveOrderBonus,
} from "@/lib/bonus-ledger";
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
  requestedItems: { slug: string; qty: number }[] = [],
  phone = "",
): Promise<
  { ok: true; code: string; percent: number; discount: number; eligibleSubtotal: number }
  | { ok: false; error: string }
> {
  const products = getProducts();
  const productMap = new Map(products.map((product) => [product.slug, product]));
  const items = requestedItems
    .slice(0, 200)
    .map((item) => {
      const product = productMap.get(typeof item?.slug === "string" ? item.slug : "");
      const qty = Number(item?.qty);
      return product && Number.isSafeInteger(qty) && qty > 0
        ? { slug: product.slug, price: product.price, qty: Math.min(qty, 99) }
        : null;
    })
    .filter((item): item is Pick<OrderItem, "slug" | "price" | "qty"> => item !== null);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const me = await currentCustomer();
  const customerKey = me?.id ?? phone.replace(/\D/g, "");
  const promo = findValidPromo(typeof code === "string" ? code : "", { subtotal, customerKey });
  if (!promo) {
    return { ok: false, error: "Промокод не найден или больше не действует." };
  }
  const calculated = promoDiscountForItems(promo, items, products);
  if (calculated.discount <= 0) {
    return { ok: false, error: "Промокод не действует на товары в корзине." };
  }
  return { ok: true, code: promo.code, percent: promo.percent, ...calculated };
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
  | { ok: false; error: string; requiresAuth?: boolean; requiresEmailVerification?: boolean };

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
  /** Целое число бонусов. Сервер заново проверяет баланс и предел 30%. */
  bonusAmount?: number;
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
  if (payload.pay && me && !me.emailVerifiedAt) {
    return {
      ok: false,
      error: "Подтвердите почту по ссылке из письма — после этого онлайн-оплата станет доступна.",
      requiresEmailVerification: true,
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
    браузера. total у заказа — уже итог после скидки и бонусов; онлайн-оплата
    распределяет обе скидки по позициям, чтобы чек сходился с суммой.
  */
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  let total = subtotal;
  let promo: Order["promo"];
  const customerKey = me?.id ?? phone.replace(/\D/g, "");
  if (typeof payload.promoCode === "string" && payload.promoCode.trim()) {
    const valid = findValidPromo(payload.promoCode, { subtotal, customerKey });
    if (valid) {
      const { discount } = promoDiscountForItems(valid, items, [...catalog.values()]);
      if (discount <= 0) return { ok: false, error: "Промокод не действует на товары в корзине." };
      total = subtotal - discount;
      promo = { code: valid.code, percent: valid.percent, discount };
    }
  }

  const requestedBonus = Number(payload.bonusAmount ?? 0);
  if (!Number.isSafeInteger(requestedBonus) || requestedBonus < 0) {
    return { ok: false, error: "Количество бонусов указано неверно." };
  }
  if (requestedBonus > 0 && !me) {
    return {
      ok: false,
      error: "Чтобы использовать бонусы, войдите в аккаунт.",
      requiresAuth: true,
    };
  }
  const bonusBalance = me ? getBonusSummary(me.id).balance : 0;
  const bonusLimit = maxRedeemableBonus(total, bonusBalance);
  if (requestedBonus > bonusLimit) {
    return {
      ok: false,
      error: `Можно списать не больше ${bonusLimit} бонусов для этого заказа.`,
    };
  }

  let bonusReservation: ReturnType<typeof reserveOrderBonus> | undefined;
  let bonusAttached = false;
  try {
    let deliveryCharge = 0;
    let delivery: Order["delivery"];
    if (payload.pay) {
      if (!payload.deliveryToken) {
        return { ok: false, error: "Выберите пункт Ozon перед оплатой." };
      }
      try {
        delivery = consumeOzonSelection(payload.deliveryToken, phone, items);
        deliveryCharge = delivery.customerPrice;
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Пересчитайте доставку.",
        };
      }
    }

    if (requestedBonus > 0 && me) {
      bonusReservation = reserveOrderBonus(me.id, requestedBonus);
    }
    const payable = total - requestedBonus + deliveryCharge;
    const order = addOrder({
      customer: {
        name,
        ...(me?.email ? { email: me.email } : {}),
        phone,
        address,
        ...(comment ? { comment } : {}),
      },
      items,
      total: payable,
      ...(promo ? { promo } : {}),
      ...(bonusReservation ? {
        bonus: { spent: requestedBonus, transactionId: bonusReservation.id },
      } : {}),
      ...(me ? { customerId: me.id } : {}),
      ...(payload.pay ? { paymentRequested: true } : {}),
      ...(delivery ? { delivery } : {}),
    });
    if (bonusReservation) {
      bonusAttached = true;
      try {
        attachBonusToOrder(bonusReservation.id, order.id);
      } catch (error) {
        // Связь видна и из самого заказа; сбой подписи в журнале не должен
        // отменять уже сохранённый заказ и создавать повторное списание.
        console.error(`Заказ ${order.id}: не удалось подписать бонусную операцию`, error);
      }
    }

    // Активацию списываем после сохранения заказа — код применён.
    if (promo) redeemPromo(promo.code, customerKey);

    /*
      Для WhatsApp-заявки письмо отправляем сразу и не задерживаем покупателя
      ожиданием SMTP. Онлайн-заказ пока остаётся технической заготовкой:
      письмо и строка в панели появятся после подтверждённого списания.
    */
    // Онлайн-заказ сообщаем владельцу только после CAPTURED из вебхука.
    // Заявка через WhatsApp по-прежнему появляется и отправляется сразу.
    if (!payload.pay) {
      enqueueIntegrationJob("order_mail", order.id, { kind: "new" });
      void runIntegrationQueue();
    }

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
          ...(payment.receipt ? { receipt: payment.receipt } : {}),
        });
        return { ok: true, id: order.id, paymentUrl: payment.url };
      } catch (e) {
        console.error(`Заказ ${order.id}: не удалось создать платёж`, e);
        updateOrder(order.id, {
          status: "canceled",
          note: "Платёжная ссылка не была создана — бонусы возвращены автоматически.",
        });
        return {
          ok: false,
          error: "Яндекс Pay сейчас не создал новую ссылку. Попробуйте ещё раз через минуту.",
        };
      }
    }

    if (payload.pay) {
      updateOrder(order.id, {
        status: "canceled",
        note: "Онлайн-оплата недоступна — бонусы возвращены автоматически.",
      });
      return {
        ok: false,
        error: "Оплата на сайте временно недоступна. Попробуйте ещё раз позже.",
      };
    }

    return { ok: true, id: order.id };
  } catch (e) {
    if (bonusReservation && !bonusAttached) {
      releaseBonusReservation(bonusReservation);
    }
    // Для WhatsApp клиент всё равно сможет отправить состав менеджеру. Для
    // онлайн-оплаты показываем ошибку и не начинаем платёж без локальной записи.
    console.error("Не удалось сохранить заказ:", e);
    return { ok: false, error: "Не получилось сохранить заказ на сайте." };
  }
}
