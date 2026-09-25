import crypto from "node:crypto";
import { withDataFileLock } from "./data-file-lock";
import { dealerAgreementLetter, dealerCustomerOrderLetter, dealerManagerOrderLetter } from "./dealer-mail";
import { getDealerOrderAgreementVersions, type DealerOrderAgreement } from "./dealer-order-management";
import { getDealerAccounts, getDealerLocations, getDealerOrders } from "./dealers";
import { sendMailWithRetry, type Letter } from "./mailer";
import { assertWritable, readJson, writeJson } from "./store";
import type { DealerOrder } from "./types";

const FILE = "dealer-order-notifications.json";
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 8;
const RETRY_DELAYS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000];

export interface DealerOrderNotification {
  id: string;
  orderId: string;
  kind: "created" | "status" | "agreement";
  recipient: "manager" | "dealer";
  status: "pending" | "sending" | "sent" | "failed";
  createdAt: string;
  updatedAt: string;
  runAt: string;
  attempts: number;
  letter: Letter;
  error?: string;
  sentAt?: string;
  leaseToken?: string;
  leaseUntil?: string;
}

function readNotifications(): DealerOrderNotification[] {
  try { return readJson<DealerOrderNotification[]>(FILE); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function getDealerOrderNotifications(orderId: string): DealerOrderNotification[] {
  return readNotifications().filter((job) => job.orderId === orderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function enqueue(candidates: Array<Pick<DealerOrderNotification, "id" | "orderId" | "kind" | "recipient" | "letter">>): void {
  if (!candidates.length) return;
  assertWritable();
  withDataFileLock(FILE, () => {
    const all = readNotifications();
    const known = new Set(all.map((job) => job.id));
    const now = new Date().toISOString();
    const additions = candidates.filter((job) => !known.has(job.id)).map((job): DealerOrderNotification => ({ ...job, status: "pending", createdAt: now, updatedAt: now, runAt: now, attempts: 0 }));
    if (additions.length) writeJson(FILE, [...all, ...additions]);
  });
}

/** Event ids are committed with the order, so restart can repair a missed enqueue. */
export function ensureDealerOrderNotifications(order: DealerOrder): void {
  const events = order.notificationEvents ?? [];
  if (!events.length) return;
  const account = getDealerAccounts().find((item) => item.id === order.accountId);
  const dealer = getDealerLocations(false).find((item) => item.id === order.dealerId);
  const candidates: Array<Pick<DealerOrderNotification, "id" | "orderId" | "kind" | "recipient" | "letter">> = [];
  for (const event of events) {
    const key = `order:${order.id}:${event.id}`;
    if (event.kind === "created") {
      const location = dealer ?? { id: order.dealerId, name: "Дилер", city: "", address: "", phone: "", active: false, createdAt: order.createdAt };
      candidates.push({ id: `${key}:manager`, orderId: order.id, kind: "created", recipient: "manager", letter: dealerManagerOrderLetter(order, location, account) });
    }
    candidates.push({ id: `${key}:dealer`, orderId: order.id, kind: event.kind, recipient: "dealer", letter: dealerCustomerOrderLetter(order, account, event.status, event.kind === "created") });
  }
  enqueue(candidates);
}

export function ensureDealerAgreementNotification(agreement: DealerOrderAgreement): void {
  const order = getDealerOrders().find((item) => item.id === agreement.orderId);
  if (!order) return;
  const account = getDealerAccounts().find((item) => item.id === order.accountId);
  enqueue([{ id: `agreement:${agreement.orderId}:${agreement.revision}:dealer`, orderId: agreement.orderId, kind: "agreement", recipient: "dealer", letter: dealerAgreementLetter(agreement, account) }]);
}

function claimNext(): DealerOrderNotification | undefined {
  return withDataFileLock(FILE, () => {
    const all = readNotifications();
    const now = Date.now();
    const job = all.find((item) => (item.status === "pending" && Date.parse(item.runAt) <= now) || (item.status === "sending" && Date.parse(item.leaseUntil ?? "1970-01-01") <= now));
    if (!job) return undefined;
    const claimed: DealerOrderNotification = { ...job, status: "sending", leaseToken: crypto.randomUUID(), leaseUntil: new Date(now + LEASE_MS).toISOString(), attempts: job.attempts + 1, updatedAt: new Date(now).toISOString() };
    writeJson(FILE, all.map((item) => item.id === job.id ? claimed : item));
    return claimed;
  });
}

function updateClaim(job: DealerOrderNotification, patch: Partial<DealerOrderNotification>): void {
  withDataFileLock(FILE, () => {
    const all = readNotifications();
    const current = all.find((item) => item.id === job.id);
    if (current?.status !== "sending" || current.leaseToken !== job.leaseToken) return;
    writeJson(FILE, all.map((item) => item.id === job.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  });
}

export function retryDealerOrderNotifications(orderId: string): void {
  assertWritable();
  withDataFileLock(FILE, () => {
    const now = new Date().toISOString();
    const all = readNotifications();
    writeJson(FILE, all.map((job) => job.orderId === orderId && (job.status === "failed" || job.status === "pending")
      ? { ...job, status: "pending", attempts: 0, runAt: now, updatedAt: now, error: undefined }
      : job));
  });
}

let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

export async function processDealerOrderNotifications(): Promise<void> {
  if (running) return;
  running = true;
  try {
    assertWritable();
    // Old orders have no event journal and are deliberately never backfilled.
    for (const order of getDealerOrders()) ensureDealerOrderNotifications(order);
    for (const agreement of getDealerOrderAgreementVersions()) ensureDealerAgreementNotification(agreement);
    for (let index = 0; index < 10; index += 1) {
      const job = claimNext();
      if (!job) break;
      const heartbeat = setInterval(() => {
        try { updateClaim(job, { leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() }); }
        catch (error) { console.error("[dealer-mail] lease:", error); }
      }, LEASE_MS / 3);
      heartbeat.unref?.();
      try {
        if (job.recipient === "dealer" && !job.letter.to?.[0]) throw new Error("Email дилера недоступен. Проверьте учётную запись.");
        const result = await sendMailWithRetry(job.letter);
        if (!result.ok) throw new Error(result.error);
        updateClaim(job, { status: "sent", sentAt: new Date().toISOString(), error: undefined, leaseToken: undefined, leaseUntil: undefined });
      } catch (error) {
        const delay = RETRY_DELAYS[Math.min(job.attempts - 1, RETRY_DELAYS.length - 1)];
        updateClaim(job, { status: job.attempts >= MAX_ATTEMPTS ? "failed" : "pending", runAt: new Date(Date.now() + delay).toISOString(), error: (error instanceof Error ? error.message : String(error)).slice(0, 1200), leaseToken: undefined, leaseUntil: undefined });
      } finally { clearInterval(heartbeat); }
    }
  } finally { running = false; }
}

export function scheduleDealerOrderNotifications(): void {
  if (timer) return;
  const run = () => void processDealerOrderNotifications().catch((error) => console.error("[dealer-mail]", error));
  run();
  timer = setInterval(run, 30_000);
  timer.unref?.();
}
