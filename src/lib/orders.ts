import { readJson, updateJson, assertWritable } from "./store";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderPayment,
  PaymentStatus,
  Product,
  OrderDelivery,
  OrderFiscalReceipt,
  OrderHistoryEntry,
} from "./types";
import { audit } from "./audit-log";
import { reconcileOrderBonus } from "./bonus-ledger";
import { ExpectedError } from "./errors";
import { releasePromo, reservePromo } from "./promos";
import { orderItemsForFulfillment } from "./bundle-cart";

export { STATUS_LABELS } from "./order-status";

/*
  Заказы с сайта.

  Лежат в папке данных рядом с каталогом — отдельным файлом, чтобы правки
  каталога и поток заказов не спорили за одну запись. Внутри персональные
  данные покупателя, поэтому наружу они не отдаются никогда: только панель.
*/

const FILE = "orders.json";

export function getOrders(): Order[] {
  try {
    return readJson<Order[]>(FILE);
  } catch {
    // Файла ещё нет — заказов просто не было
    return [];
  }
}

/*
  Любая созданная попытка заказа видна менеджеру сразу. Раньше онлайн-заказы
  скрывались до CAPTURED; если вебхук не приходил, оплаченный заказ исчезал и
  из панели, и из уведомлений. Статус оплаты рядом с заказом честно показывает,
  списаны деньги или покупатель только открыл платёжную форму.
*/
const SETTLED_PAYMENT_STATUSES = new Set<PaymentStatus>([
  "CAPTURED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

function isUnpaidPaymentAttempt(order: Order): boolean {
  const online = order.paymentRequested === true || order.payment !== undefined;
  if (!online) return false;
  return !order.payment || !SETTLED_PAYMENT_STATUSES.has(order.payment.status);
}

/** Все заказы и попытки оплаты — менеджер видит их сразу. */
export function getAdminOrders(): Order[] {
  return getOrders();
}

export function getOrder(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

/**
 * Номер заказа: день, месяц и порядковый номер за этот день — «2607-003».
 * Такой проще продиктовать по телефону, чем случайный набор символов.
 */
function nextId(orders: Order[]): string {
  const now = new Date();
  const prefix = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayCount = orders.filter((o) => o.id.startsWith(`${prefix}-`)).length;
  return `${prefix}-${String(todayCount + 1).padStart(3, "0")}`;
}

/**
 * Срок хранения заказов — ровно тот, что обещан в политике: три года.
 * Держать дольше незачем: чем меньше персональных данных лежит на сервере,
 * тем меньше потерять при взломе.
 *
 * Незавершённые заказы не трогаем, сколько бы им ни было лет: висящий
 * «в работе» заказ — повод разобраться, а не стереть.
 */
const KEEP_YEARS = 3;
const UNPAID_PAYMENT_KEEP_DAYS = 30;

function withoutExpired(orders: Order[]): Order[] {
  const edge = new Date();
  edge.setFullYear(edge.getFullYear() - KEEP_YEARS);
  const stamp = edge.toISOString();
  const unpaidEdge = new Date(
    Date.now() - UNPAID_PAYMENT_KEEP_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  return orders.filter(
    (o) => {
      // Неоплаченная техническая попытка не должна лежать вечно как «новая».
      if (isUnpaidPaymentAttempt(o) && o.createdAt <= unpaidEdge) return false;
      return o.createdAt > stamp || (o.status !== "done" && o.status !== "canceled");
    },
  );
}

function paymentReleasesResources(order: Order): boolean {
  return new Set<PaymentStatus>(["FAILED", "VOIDED", "REFUNDED"]).has(
    order.payment?.status ?? "none",
  );
}

function shouldHoldResources(order: Order): boolean {
  return order.status !== "canceled" && !paymentReleasesResources(order);
}

function reconcileOrderPromo(order: Order): boolean {
  const promo = order.promo;
  if (!promo?.redemptionId) return false;
  const shouldBeActive = shouldHoldResources(order);
  const isActive = promo.redemptionActive === true;

  // reserve/release сами идемпотентны по redemptionId. Вызываем их даже если
  // флаг заказа выглядит верным: это чинит редкий разрыв между двумя JSON,
  // если процесс завершился между их атомарными записями.
  if (shouldBeActive) {
    reservePromo(promo.code, promo.redemptionId, {
      subtotal: order.items.reduce((sum, item) => sum + item.price * item.qty, 0),
      customerKey: promo.customerKey,
    });
  } else {
    releasePromo(promo.code, promo.redemptionId);
  }
  return shouldBeActive !== isActive;
}

function releaseResourcesFromExpiredPaymentAttempts(before: Order[], after: Order[]): void {
  const kept = new Set(after.map((order) => order.id));
  for (const order of before) {
    if (kept.has(order.id) || !isUnpaidPaymentAttempt(order)) continue;
    const canceled = { ...order, status: "canceled" as const };
    if (order.bonus?.spent) reconcileOrderBonus(canceled);
    if (order.promo?.redemptionActive) reconcileOrderPromo(canceled);
    if (order.stockDeducted) adjustProductStock(order.items, 1);
  }
}

/** Убирает просроченные заказы. Возвращает, сколько удалено. */
export function pruneOldOrders(): number {
  const orders = getOrders();
  const kept = withoutExpired(orders);
  if (kept.length === orders.length) return 0;

  assertWritable();
  releaseResourcesFromExpiredPaymentAttempts(orders, kept);
  updateJson<Order[]>(FILE, withoutExpired);
  return orders.length - kept.length;
}

export function addOrder(order: Omit<Order, "id" | "createdAt" | "status">): Order {
  assertWritable();
  // Чистим на каждом новом заказе: отдельный планировщик ради пары записей
  // в год — лишняя деталь, которая ломается незаметно.
  const current = getOrders();
  const orders = withoutExpired(current);
  releaseResourcesFromExpiredPaymentAttempts(current, orders);
  const reservedLines = adjustProductStock(order.items, -1);
  const full: Order = {
    ...order,
    id: nextId(orders),
    createdAt: new Date().toISOString(),
    status: "new",
    ...(reservedLines > 0 ? { stockDeducted: true } : {}),
    history: [
      {
        at: new Date().toISOString(),
        actor: "Система",
        type: "created",
        detail: "Заказ создан",
      },
      ...(order.bonus?.spent ? [{
        at: new Date().toISOString(),
        actor: "Покупатель",
        type: "bonus" as const,
        detail: `Списано ${order.bonus.spent} бонусов`,
      }] : []),
    ],
  };
  // Свежие сверху, заодно чистим просроченные
  try {
    updateJson<Order[]>(FILE, (all) => [full, ...withoutExpired(all)]);
  } catch (error) {
    if (reservedLines > 0) adjustProductStock(order.items, 1);
    throw error;
  }
  return full;
}

/*
  Меняет остаток товаров по позициям заказа: sign −1 — зарезервировать,
  +1 — освободить. Трогаем только товары, где остаток ведётся (stock — число).
  Перед списанием проверяем ВСЕ строки внутри одного updateJson: частичного
  резерва и тихого обнуления быть не должно.
*/
function adjustProductStock(items: OrderItem[], sign: 1 | -1): number {
  let changed = 0;
  updateJson<Product[]>("products.json", (all) => {
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    const fulfillmentItems = orderItemsForFulfillment(items);
    if (sign === -1) {
      for (const item of fulfillmentItems) {
        const product = bySlug.get(item.slug);
        if (typeof product?.stock !== "number") continue;
        if (product.stock < item.qty) {
          throw new ExpectedError(
            `Недостаточно товара «${item.title}»: доступно ${product.stock}.`,
          );
        }
      }
    }
    for (const item of fulfillmentItems) {
      const p = bySlug.get(item.slug);
      if (!p || typeof p.stock !== "number") continue;
      p.stock += sign * item.qty;
      changed += 1;
    }
    return all;
  });
  return changed;
}

export function updateOrder(
  id: string,
  patch: { status?: OrderStatus; note?: string },
): void {
  assertWritable();

  /*
    Остаток и промокод приводим к состоянию будущего заказа. Правки ресурсов
    делаем до записи заказа; флаги пишем тем же патчем и используем для
    идемпотентности повторных действий администратора.
  */
  let stockPatch: { stockDeducted: boolean } | undefined;
  const before = getOrder(id);
  const bonusChanged = Boolean(
    before && patch.status && patch.status !== before.status &&
    reconcileOrderBonus({ ...before, status: patch.status }),
  );
  let promoChanged = false;
  if (before && patch.status && before.status !== patch.status) {
    const projected = { ...before, status: patch.status };
    const wasDeducted = before.stockDeducted === true;
    const shouldDeduct = shouldHoldResources(projected);
    if (shouldDeduct && !wasDeducted) {
      const changed = adjustProductStock(before.items, -1);
      if (changed > 0) stockPatch = { stockDeducted: true };
    } else if (!shouldDeduct && wasDeducted) {
      adjustProductStock(before.items, 1);
      stockPatch = { stockDeducted: false };
    }
    promoChanged = reconcileOrderPromo(projected);
  }

  updateJson<Order[]>(FILE, (all) =>
    all.map((o) => {
      if (o.id !== id) return o;
      const history = [...(o.history ?? [])];
      if (patch.status && patch.status !== o.status) {
        history.push({ at: new Date().toISOString(), actor: "Администратор", type: "status", from: o.status, to: patch.status });
      }
      if (patch.note !== undefined && patch.note !== (o.note ?? "")) {
        history.push({ at: new Date().toISOString(), actor: "Администратор", type: "note", detail: patch.note ? "Заметка изменена" : "Заметка удалена" });
      }
      if (bonusChanged) {
        history.push({
          at: new Date().toISOString(),
          actor: "Система",
          type: "bonus",
          detail: patch.status === "canceled"
            ? `Возвращено ${o.bonus?.spent ?? 0} бонусов`
            : `Повторно списано ${o.bonus?.spent ?? 0} бонусов`,
        });
      }
      const promoPatch = promoChanged && o.promo
        ? { promo: { ...o.promo, redemptionActive: shouldHoldResources({ ...o, ...patch }) } }
        : {};
      return { ...o, ...patch, ...stockPatch, ...promoPatch, history };
    }),
  );
  if (before) {
    const summary = patch.status && patch.status !== before.status
      ? `Статус заказа изменён: ${before.status} → ${patch.status}`
      : "Изменена заметка заказа";
    audit({ entity: "order", entityId: id, action: patch.status ? "status_changed" : "note_changed", summary, before: { status: before.status, note: before.note }, after: patch });
  }
}

/**
 * Скрыть заказ из рабочего списка или вернуть обратно.
 *
 * Архив — только организационный признак: статус, резерв товара, промокод,
 * оплата и отправление Ozon не меняются. Поэтому даже активный заказ можно
 * восстановить без потери состояния интеграций.
 */
export function setOrderArchived(id: string, archived: boolean): Order | undefined {
  assertWritable();
  let result: Order | undefined;
  updateJson<Order[]>(FILE, (all) =>
    all.map((order) => {
      if (order.id !== id) return order;
      if (Boolean(order.archivedAt) === archived) {
        result = order;
        return order;
      }
      const archivedAt = archived ? new Date().toISOString() : undefined;
      const history: OrderHistoryEntry[] = [
        ...(order.history ?? []),
        {
          at: new Date().toISOString(),
          actor: "Администратор",
          type: "note",
          detail: archived ? "Заказ перемещён в архив" : "Заказ восстановлен из архива",
        },
      ];
      result = { ...order, archivedAt, history };
      return result;
    }),
  );
  return result;
}

/** Сколько заказов ждут обработки — для счётчика в панели. */
export function countNewOrders(): number {
  return getAdminOrders().filter((o) => o.status === "new" && !o.archivedAt).length;
}

/* -------------------------------- оплата ---------------------------------- */

/**
 * Записать состояние онлайн-оплаты.
 *
 * Правка идёт через updateJson: платёж прилетает вебхуком в тот же момент,
 * когда менеджер может менять статус руками, — читать список из кэша и
 * сохранять целиком значило бы терять одно из двух.
 */
export function setOrderPayment(id: string, payment: OrderPayment): void {
  assertWritable();
  const before = getOrder(id);
  const projected = before ? { ...before, payment } : undefined;
  const bonusChanged = before
    ? reconcileOrderBonus(projected!)
    : false;
  let stockPatch: { stockDeducted: boolean } | undefined;
  let promoChanged = false;
  if (before && projected) {
    const shouldDeduct = shouldHoldResources(projected);
    const wasDeducted = before.stockDeducted === true;
    if (shouldDeduct && !wasDeducted) {
      const changed = adjustProductStock(before.items, -1);
      if (changed > 0) stockPatch = { stockDeducted: true };
    } else if (!shouldDeduct && wasDeducted) {
      adjustProductStock(before.items, 1);
      stockPatch = { stockDeducted: false };
    }
    promoChanged = reconcileOrderPromo(projected);
  }
  const bonusReturned = payment.status === "FAILED" || payment.status === "VOIDED" || payment.status === "REFUNDED";
  updateJson<Order[]>(FILE, (all) =>
    all.map((o) => o.id === id ? {
      ...o,
      payment,
      ...stockPatch,
      ...(promoChanged && o.promo ? {
        promo: { ...o.promo, redemptionActive: shouldHoldResources({ ...o, payment }) },
      } : {}),
      history: [
        ...(o.history ?? []),
        { at: new Date().toISOString(), actor: "Платёжная система", type: "payment" as const, from: o.payment?.status, to: payment.status },
        ...(bonusChanged ? [{
          at: new Date().toISOString(),
          actor: "Система",
          type: "bonus" as const,
          detail: bonusReturned
            ? `Возвращено ${o.bonus?.spent ?? 0} бонусов после изменения оплаты`
            : `Повторно списано ${o.bonus?.spent ?? 0} бонусов после подтверждения оплаты`,
        }] : []),
      ],
    } : o),
  );
  audit({ entity: "order", entityId: id, action: "payment_changed", summary: `Статус оплаты: ${payment.status}`, after: { status: payment.status, amount: payment.amount, sandbox: payment.sandbox } });
}

/**
 * Обновить только статус оплаты, сохранив ссылку и сумму.
 *
 * Возвращает false, если заказа нет или статус не изменился, — тогда не
 * нужно ни писать файл, ни слать письмо: вебхук повторяется, и каждый
 * повтор не должен выглядеть новым событием.
 */
export function updatePaymentStatus(id: string, status: PaymentStatus): boolean {
  const order = getOrder(id);
  if (!order?.payment || order.payment.status === status) return false;

  setOrderPayment(id, {
    ...order.payment,
    status,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export function updateOrderReceipt(id: string, receipt: OrderFiscalReceipt): void {
  assertWritable();
  updateJson<Order[]>(FILE, (all) =>
    all.map((order) => {
      if (order.id !== id || !order.payment) return order;
      const previous = order.payment.receipt;
      const changed = !previous ||
        previous.status !== receipt.status ||
        previous.error !== receipt.error ||
        previous.operationId !== receipt.operationId ||
        previous.payloadConfirmed !== receipt.payloadConfirmed;
      return {
        ...order,
        payment: { ...order.payment, receipt },
        history: changed ? [
          ...(order.history ?? []),
          {
            at: new Date().toISOString(),
            actor: "Yandex Pay",
            type: "receipt" as const,
            to: receipt.status,
            detail: receipt.error ?? (receipt.payloadConfirmed
              ? "Реквизиты электронного чека подтверждены API"
              : "Данные электронного чека переданы"),
          },
        ] : order.history,
      };
    }),
  );
  audit({
    entity: "order",
    entityId: id,
    action: "receipt_checked",
    summary: `Фискализация: ${receipt.status}`,
    after: receipt,
  });
}

export function appendOrderHistory(id: string, entry: OrderHistoryEntry): void {
  assertWritable();
  updateJson<Order[]>(FILE, (all) =>
    all.map((order) => order.id === id
      ? { ...order, history: [...(order.history ?? []), entry].slice(-300) }
      : order),
  );
}

/** Обновить только состояние отправления Ozon, не затрагивая оплату и заказ. */
export function updateOzonShipment(
  id: string,
  shipment: NonNullable<OrderDelivery["shipment"]>,
): void {
  assertWritable();
  updateJson<Order[]>(FILE, (all) =>
    all.map((order) =>
      order.id === id && order.delivery
        ? {
            ...order,
            delivery: { ...order.delivery, shipment },
            history: [...(order.history ?? []), { at: new Date().toISOString(), actor: "Ozon", type: "delivery" as const, to: shipment.status, detail: shipment.error ?? shipment.orderNumber }],
          }
        : order,
    ),
  );
  audit({ entity: "integration", entityId: id, action: "ozon_shipment", summary: `Отправление Ozon: ${shipment.status}`, after: shipment });
}

