import crypto from "node:crypto";
import { audit } from "./audit-log";
import { messageFor } from "./errors";
import { notifyNewOrder, notifyPaidOrder } from "./order-mail";
import {
  getOrder,
  getOrders,
  updateOzonShipment,
  updatePaymentStatus,
} from "./orders";
import { createOzonShipment } from "./ozon-delivery";
import { notifyCustomerWelcome } from "./customer-mail";
import { readJson, updateJson } from "./store";
import { fetchPaymentStatus } from "./yandex-pay";
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
      }
    } catch (error) {
      console.error(`Не удалось сверить оплату заказа ${order.id}:`, error);
    }
  }
}

async function execute(job: IntegrationJob): Promise<void> {
  if (job.type === "customer_welcome") {
    await notifyCustomerWelcome(job.entityId);
    return;
  }
  const order = getOrder(job.entityId);
  if (!order) throw new Error(`Заказ ${job.entityId} не найден.`);
  if (job.type === "order_mail") {
    if (job.payload?.kind === "paid") await notifyPaidOrder(order);
    else await notifyNewOrder(order);
    return;
  }
  if (order.delivery?.shipment?.status === "created") return;
  updateOzonShipment(order.id, { status: "creating", attemptedAt: new Date().toISOString() });
  const result = await createOzonShipment(order);
  updateOzonShipment(order.id, {
    status: "created", attemptedAt: new Date().toISOString(),
    orderNumber: result.order_number,
    ...(result.postings?.length ? { postings: result.postings } : {}),
  });
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
        await execute(job);
        updateJob(job.id, { status: "done", lastError: undefined });
        audit({ entity: "integration", entityId: job.entityId, action: "job_done", summary: `Задача выполнена: ${job.type}` });
      } catch (error) {
        const lastError = messageFor(error, "Ошибка фоновой задачи.", "integrationQueue").slice(0, 500);
        const failed = attempts >= MAX_ATTEMPTS;
        updateJob(job.id, {
          status: failed ? "failed" : "pending",
          lastError,
          runAt: new Date(Date.now() + RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)]).toISOString(),
        });
        if (job.type === "ozon_shipment") {
          updateOzonShipment(job.entityId, { status: "failed", attemptedAt: new Date().toISOString(), error: lastError });
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
