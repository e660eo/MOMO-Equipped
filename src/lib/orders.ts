import { readJson, updateJson, assertWritable } from "./store";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderPayment,
  PaymentStatus,
  Product,
  OrderDelivery,
} from "./types";
import { audit } from "./audit-log";

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
  Онлайн-заказ сначала сохраняется как техническая заготовка: Яндексу нужен
  наш orderId до перехода покупателя на платёжную форму. В рабочую панель
  такую заготовку пускать нельзя — менеджеру нужен только оплаченный заказ.

  Возвращённые заказы оставляем в панели: они уже были оплачены и нужны для
  истории и бухгалтерии. Старые записи до появления paymentRequested узнаём
  по самому полю payment.
*/
const ADMIN_PAYMENT_STATUSES = new Set<PaymentStatus>([
  "CAPTURED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export function isOrderVisibleInAdmin(order: Order): boolean {
  const online = order.paymentRequested === true || order.payment !== undefined;
  if (!online) return true;
  return Boolean(order.payment && ADMIN_PAYMENT_STATUSES.has(order.payment.status));
}

/** Только рабочие заказы: WhatsApp-заявки и оплаченные онлайн-заказы. */
export function getAdminOrders(): Order[] {
  return getOrders().filter(isOrderVisibleInAdmin);
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
      if (!isOrderVisibleInAdmin(o) && o.createdAt <= unpaidEdge) return false;
      return o.createdAt > stamp || (o.status !== "done" && o.status !== "canceled");
    },
  );
}

/** Убирает просроченные заказы. Возвращает, сколько удалено. */
export function pruneOldOrders(): number {
  const orders = getOrders();
  const kept = withoutExpired(orders);
  if (kept.length === orders.length) return 0;

  assertWritable();
  updateJson<Order[]>(FILE, withoutExpired);
  return orders.length - kept.length;
}

export function addOrder(order: Omit<Order, "id" | "createdAt" | "status">): Order {
  assertWritable();
  // Чистим на каждом новом заказе: отдельный планировщик ради пары записей
  // в год — лишняя деталь, которая ломается незаметно.
  const orders = withoutExpired(getOrders());
  const full: Order = {
    ...order,
    id: nextId(orders),
    createdAt: new Date().toISOString(),
    status: "new",
    history: [{
      at: new Date().toISOString(),
      actor: "Система",
      type: "created",
      detail: "Заказ создан",
    }],
  };
  // Свежие сверху, заодно чистим просроченные
  updateJson<Order[]>(FILE, (all) => [full, ...withoutExpired(all)]);
  return full;
}

/* Статусы, при которых товар считается проданным и остаток списан. */
const COMMITTED = new Set<OrderStatus>(["in_work", "done"]);

/*
  Меняет остаток товаров по позициям заказа: sign −1 — списать (продажа),
  +1 — вернуть (отмена). Трогаем только товары, где остаток ведётся (stock —
  число); товары без учёта (флаг inStock) не при чём. Ниже нуля не опускаем —
  отрицательный остаток на витрине смысла не имеет. Отдельный updateJson по
  products.json: заказы и каталог лежат в разных файлах.
*/
function adjustProductStock(items: OrderItem[], sign: 1 | -1): void {
  updateJson<Product[]>("products.json", (all) => {
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    for (const item of items) {
      const p = bySlug.get(item.slug);
      if (!p || typeof p.stock !== "number") continue;
      p.stock = Math.max(0, p.stock + sign * item.qty);
    }
    return all;
  });
}

export function updateOrder(
  id: string,
  patch: { status?: OrderStatus; note?: string },
): void {
  assertWritable();

  /*
    Списание/возврат остатка привязано к смене статуса. Флаг stockDeducted на
    заказе не даёт списать дважды: остаток уходит при первом переводе в
    «в работе»/«выполнен» и возвращается при откате в «новый»/«отменён».
    Правку остатка делаем ДО записи заказа, а сам флаг пишем тем же патчем.
  */
  let stockPatch: { stockDeducted: boolean } | undefined;
  const before = getOrder(id);
  if (patch.status) {
    const order = getOrder(id);
    if (order && order.status !== patch.status) {
      const wasDeducted = order.stockDeducted === true;
      const shouldDeduct = COMMITTED.has(patch.status);
      if (shouldDeduct && !wasDeducted) {
        adjustProductStock(order.items, -1);
        stockPatch = { stockDeducted: true };
      } else if (!shouldDeduct && wasDeducted) {
        adjustProductStock(order.items, 1);
        stockPatch = { stockDeducted: false };
      }
    }
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
      return { ...o, ...patch, ...stockPatch, history };
    }),
  );
  if (before) {
    const summary = patch.status && patch.status !== before.status
      ? `Статус заказа изменён: ${before.status} → ${patch.status}`
      : "Изменена заметка заказа";
    audit({ entity: "order", entityId: id, action: patch.status ? "status_changed" : "note_changed", summary, before: { status: before.status, note: before.note }, after: patch });
  }
}

/** Сколько заказов ждут обработки — для счётчика в панели. */
export function countNewOrders(): number {
  return getAdminOrders().filter((o) => o.status === "new").length;
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
  updateJson<Order[]>(FILE, (all) =>
    all.map((o) => o.id === id ? {
      ...o,
      payment,
      history: [...(o.history ?? []), { at: new Date().toISOString(), actor: "Платёжная система", type: "payment" as const, from: o.payment?.status, to: payment.status }],
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

