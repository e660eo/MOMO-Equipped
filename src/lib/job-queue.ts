import crypto from "node:crypto";
import { audit } from "./audit-log";
import { messageFor } from "./errors";
import {
  notifyCustomerPaidOrder,
  notifyNewOrder,
  notifyPaidOrder,
} from "./order-mail";
import {
  appendOrderHistory,
  getOrder,
  getOrders,
  updateOrderReceipt,
  updateOzonShipment,
  updatePaymentStatus,
} from "./orders";
import { createOzonShipment } from "./ozon-delivery";
import { notifyCustomerEmailVerification, notifyCustomerWelcome } from "./customer-mail";
import { readJson, updateJson } from "./store";
import { fetchPaymentDetails, fetchPaymentStatus } from "./yandex-pay";
import { isMailerConfigured } from "./mailer";
import type { IntegrationJob, IntegrationJobType } from "./types";

const FILE = "integration-jobs.json";
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

export function getIntegrationJobs(limit = 100): IntegrationJob[] {
  try {
    return readJson<IntegrationJob[]>(FILE)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function getIntegrationJobsForEntity(entityId: string): IntegrationJob[] {
  try {
    return readJson<IntegrationJob[]>(FILE)
      .filter((job) => job.entityId === entityId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function enqueueIntegrationJob(
  type: IntegrationJobType,
  entityId: string,
  payload?: Record<string, string>,
): IntegrationJob {
  const now = new Date().toISOString();
  let queued!: IntegrationJob;
  updateJson<IntegrationJob[]>(FILE, (all) => {
    const same = all.find((job) =>
      job.type === type && job.entityId === entityId &&
      job.payload?.kind === payload?.kind && job.status !== "done",
    );
    if (same) {
      queued = { ...same, status: "pending", runAt: now, updatedAt: now };
      return all.map((job) => job.id === same.id ? queued : job);
    }
    queued = {
      id: crypto.randomUUID(), type, entityId, status: "pending", attempts: 0,
      runAt: now, createdAt: now, updatedAt: now, ...(payload ? { payload } : {}),
    };
    return [queued, ...all].slice(0, 1_000);
  });
  audit({ entity: "integration", entityId, action: "job_queued", summary: `Поставлена задача: ${type}` });
  return queued;
}

function updateJob(id: string, patch: Partial<IntegrationJob>): void {
  updateJson<IntegrationJob[]>(FILE, (all) => all.map((job) =>
    job.id === id ? { ...job, ...patch, updatedAt: new Date().toISOString() } : job,
  ));
}

const RECONCILE_PAYMENT_STATUSES = new Set(["created", "PENDING", "AUTHORIZED"]);

/**
 * Резервная сверка оплат. Вебхук остаётся основным быстрым каналом, но заказ
 * не потеряется, если уведомление Яндекса не дошло: раз в минуту спрашиваем
 * источник правды напрямую и публикуем подтверждённую оплату.
 */
async function reconcilePayments(): Promise<void> {
  const candidates = getOrders()
    .filter((order) =>
      order.paymentRequested === true &&
      order.payment &&
      RECONCILE_PAYMENT_STATUSES.has(order.payment.status),
    )
    .slice(0, 20);

  for (const order of candidates) {
    try {
      const status = await fetchPaymentStatus(order.id);
      if (!status || !updatePaymentStatus(order.id, status)) continue;

      if (status === "CAPTURED") {
        const fresh = getOrder(order.id);
        if (
          fresh?.delivery &&
          fresh.payment?.sandbox !== true &&
          fresh.delivery.shipment?.status !== "created"
        ) {
          enqueueIntegrationJob("ozon_shipment", order.id);
        }
        enqueueIntegrationJob("order_mail", order.id, { kind: "paid" });
        enqueueIntegrationJob("customer_payment_mail", order.id);
        if (fresh?.payment?.receipt) enqueueIntegrationJob("fiscal_check", order.id);
      }
    } catch (error) {
      console.error(`Не удалось сверить оплату заказа ${order.id}:`, error);
    }
  }
}

async function execute(job: IntegrationJob): Promise<string> {
  if (job.type === "customer_welcome") {
    if (!isMailerConfigured()) throw new Error("Почтовый ящик не подключён.");
    await notifyCustomerWelcome(job.entityId);
    return "Приветственное письмо принято SMTP-сервером";
  }
  if (job.type === "customer_email_verification") {
    if (!isMailerConfigured()) throw new Error("Почтовый ящик не подключён.");
    await notifyCustomerEmailVerification(job.entityId, job.payload?.kind === "welcome");
    return "Письмо подтверждения email принято SMTP-сервером";
  }
  const order = getOrder(job.entityId);
  if (!order) throw new Error(`Заказ ${job.entityId} не найден.`);
  if (job.type === "fiscal_check") {
    if (!order.payment?.receipt) throw new Error("Для заказа не передавались данные фискального чека.");
    const details = await fetchPaymentDetails(order.id);
    if (details.status && details.status !== order.payment.status) {
      updatePaymentStatus(order.id, details.status);
    }
    const checkedAt = new Date().toISOString();
    const error = details.receiptPayloadConfirmed
      ? undefined
      : "Yandex Pay не подтвердил реквизиты чека в данных заказа.";
    updateOrderReceipt(order.id, {
      ...order.payment.receipt,
      status: error
        ? "error"
        : details.status === "CAPTURED"
          ? "payment_confirmed"
          : "submitted",
      checkedAt,
      ...(details.fiscalContact ? { contact: details.fiscalContact } : {}),
      ...(details.operationId ? { operationId: details.operationId } : {}),
      ...(details.operationStatus ? { operationStatus: details.operationStatus } : {}),
      payloadConfirmed: details.receiptPayloadConfirmed,
      error,
    });
    if (error) throw new Error(error);
    return details.operationId
      ? `Реквизиты чека подтверждены; операция ${details.operationId}`
      : "Реквизиты электронного чека подтверждены Yandex Pay";
  }
  if (job.type === "order_mail") {
    if (!isMailerConfigured()) throw new Error("Почтовый ящик не подключён.");
    if (job.payload?.kind === "paid") await notifyPaidOrder(order);
    else await notifyNewOrder(order);
    return "Письмо администратору принято SMTP-сервером";
  }
  if (job.type === "customer_payment_mail") {
    if (!isMailerConfigured()) throw new Error("Почтовый ящик не подключён.");
    if (!order.customer.email) throw new Error("У заказа нет email покупателя.");
    await notifyCustomerPaidOrder(order);
    return `Письмо покупателю принято SMTP-сервером: ${order.customer.email}`;
  }
  if (order.delivery?.shipment?.status === "created") {
    return `Отправление Ozon уже создано: ${order.delivery.shipment.orderNumber ?? "номер не указан"}`;
  }
  updateOzonShipment(order.id, { status: "creating", attemptedAt: new Date().toISOString() });
  const result = await createOzonShipment(order);
  updateOzonShipment(order.id, {
    status: "created", attemptedAt: new Date().toISOString(),
    orderNumber: result.order_number,
    ...(result.postings?.length ? { postings: result.postings } : {}),
  });
  return `Отправление Ozon создано: ${result.order_number}`;
}

export async function runIntegrationQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await reconcilePayments();
    const due = getIntegrationJobs(500)
      .filter((job) => job.status === "pending" && job.runAt <= new Date().toISOString())
      .sort((a, b) => a.runAt.localeCompare(b.runAt))
      .slice(0, 10);
    for (const job of due) {
      const attempts = job.attempts + 1;
      updateJob(job.id, { status: "running", attempts });
      try {
        const lastResult = await execute(job);
        updateJob(job.id, { status: "done", lastError: undefined, lastResult });
        if (["order_mail", "customer_payment_mail"].includes(job.type)) {
          appendOrderHistory(job.entityId, {
            at: new Date().toISOString(),
            actor: "Система уведомлений",
            type: "notification",
            to: "done",
            detail: lastResult,
          });
        }
        audit({ entity: "integration", entityId: job.entityId, action: "job_done", summary: `Задача выполнена: ${job.type}` });
      } catch (error) {
        const lastError = messageFor(error, "Ошибка фоновой задачи.", "integrationQueue").slice(0, 500);
        const failed = attempts >= MAX_ATTEMPTS;
        updateJob(job.id, {
          status: failed ? "failed" : "pending",
          lastError,
          lastResult: undefined,
          runAt: new Date(Date.now() + RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)]).toISOString(),
        });
        if (job.type === "ozon_shipment") {
          updateOzonShipment(job.entityId, { status: "failed", attemptedAt: new Date().toISOString(), error: lastError });
        }
        if (failed && getOrder(job.entityId)) {
          appendOrderHistory(job.entityId, {
            at: new Date().toISOString(),
            actor: "Система интеграций",
            type: "notification",
            to: "failed",
            detail: `${job.type}: ${lastError}`,
          });
        }
      }
    }
  } finally {
    running = false;
  }
}

export function scheduleIntegrationQueue(): void {
  if (timer) return;
  void runIntegrationQueue();
  timer = setInterval(() => void runIntegrationQueue(), 60_000);
  timer.unref?.();
}
