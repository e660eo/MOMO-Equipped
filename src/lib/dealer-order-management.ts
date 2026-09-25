import { getDealerOrders } from "./dealers";
import { ExpectedError } from "./errors";
import { assertWritable, readJson, writeJson, withStoreTransaction } from "./store";
import { reconcileDealerStock } from "./dealer-stock";
import type { OrderItem } from "./types";
import type { DealerInvoiceFile } from "./dealer-invoices";

const FILE = "dealer-order-agreements.json";

export type DealerPaymentStatus = "unpaid" | "partial" | "paid";
export const DEALER_PAYMENT_LABELS: Record<DealerPaymentStatus, string> = {
  unpaid: "Ожидается оплата", partial: "Оплачен частично", paid: "Оплачен",
};

/** The submitted order is immutable; agreed versions are stored separately. */
export interface DealerOrderAgreement {
  orderId: string;
  revision: number;
  updatedAt: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  deliveryMethod: string;
  deliveryAddress: string;
  paymentTerms: string;
  paymentStatus: DealerPaymentStatus;
  invoiceReference: string;
  invoiceFile?: DealerInvoiceFile;
  trackingNumber: string;
  trackingUrl: string;
  managerMessage: string;
}

export interface DealerOrderAgreementInput {
  orderId: string;
  expectedRevision: number;
  quantities: Record<string, number>;
  deliveryCost: number;
  deliveryMethod: string;
  deliveryAddress: string;
  paymentTerms: string;
  paymentStatus: DealerPaymentStatus;
  invoiceReference: string;
  invoiceFile?: DealerInvoiceFile;
  trackingNumber: string;
  trackingUrl: string;
  managerMessage: string;
}

type AgreementBook = Record<string, DealerOrderAgreement[]>;

function readAgreements(): AgreementBook {
  try { return readJson<AgreementBook>(FILE); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export function getDealerOrderAgreement(orderId: string): DealerOrderAgreement | undefined {
  return readAgreements()[orderId]?.at(-1);
}

/** Only agreements created through this workflow are reconciled for mail. */
export function getDealerOrderAgreementVersions(): DealerOrderAgreement[] {
  return Object.values(readAgreements()).flat();
}

function validatedText(value: string, max: number, label: string): string {
  if (typeof value !== "string" || value.length > max) throw new ExpectedError(`Проверьте поле «${label}».`);
  return value.trim();
}

export function saveDealerOrderAgreement(input: DealerOrderAgreementInput): DealerOrderAgreement {
  assertWritable();
  const order = getDealerOrders().find((item) => item.id === input.orderId);
  if (!order) throw new ExpectedError("Заказ не найден.");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new ExpectedError("Обновите страницу заказа.");
  const known = new Set(order.items.map((item) => item.slug));
  if (Object.keys(input.quantities).some((slug) => !known.has(slug))) throw new ExpectedError("В согласовании указан товар, которого нет в заявке.");
  const items = order.items.flatMap((item) => {
    const qty = input.quantities[item.slug];
    if (!Number.isSafeInteger(qty) || qty < 0 || qty > 999) throw new ExpectedError(`Проверьте количество: ${item.title}.`);
    return qty ? [{ ...item, qty }] : [];
  });
  if (!items.length) throw new ExpectedError("Оставьте хотя бы один товар или отмените заказ.");
  if (!Number.isFinite(input.deliveryCost) || input.deliveryCost < 0 || input.deliveryCost > 10_000_000 || Math.abs(input.deliveryCost * 100 - Math.round(input.deliveryCost * 100)) > 0.00001) {
    throw new ExpectedError("Стоимость доставки должна быть неотрицательной суммой с точностью до копеек.");
  }
  if (!["unpaid", "partial", "paid"].includes(input.paymentStatus)) throw new ExpectedError("Проверьте статус оплаты.");
  const deliveryMethod = validatedText(input.deliveryMethod, 200, "Способ доставки");
  const deliveryAddress = validatedText(input.deliveryAddress, 1200, "Адрес доставки");
  const paymentTerms = validatedText(input.paymentTerms, 1500, "Условия оплаты");
  const invoiceReference = validatedText(input.invoiceReference, 300, "Счёт");
  const trackingNumber = validatedText(input.trackingNumber, 200, "Трек-номер");
  const trackingUrl = validatedText(input.trackingUrl, 1000, "Ссылка отслеживания");
  const managerMessage = validatedText(input.managerMessage, 3000, "Сообщение дилеру");
  if (trackingUrl) {
    try {
      const url = new URL(trackingUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { throw new ExpectedError("Ссылка отслеживания должна начинаться с https:// или http://."); }
  }
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0) / 100;
  const deliveryCost = Math.round(input.deliveryCost * 100) / 100;
  return withStoreTransaction(() => {
    const currentOrder = getDealerOrders().find((item) => item.id === input.orderId);
    if (!currentOrder) throw new ExpectedError("Заказ не найден.");
    const book = readAgreements();
    const versions = book[order.id] ?? [];
    if ((versions.at(-1)?.revision ?? 0) !== input.expectedRevision) throw new ExpectedError("Условия уже изменены в другом окне. Обновите страницу и проверьте новую версию.");
    const agreement: DealerOrderAgreement = {
      orderId: order.id, revision: input.expectedRevision + 1, updatedAt: new Date().toISOString(),
      items, subtotal, deliveryCost, total: Math.round((subtotal + deliveryCost) * 100) / 100,
      deliveryMethod, deliveryAddress, paymentTerms, paymentStatus: input.paymentStatus,
      invoiceReference, trackingNumber, trackingUrl, managerMessage,
      ...((input.invoiceFile ?? versions.at(-1)?.invoiceFile) ? { invoiceFile: input.invoiceFile ?? versions.at(-1)?.invoiceFile } : {}),
    };
    reconcileDealerStock(order.id, currentOrder.status, agreement.paymentStatus === "paid", agreement.items, ["shipped", "done"].includes(currentOrder.status));
    writeJson(FILE, { ...book, [order.id]: [...versions, agreement] });
    return agreement;
  });
}
