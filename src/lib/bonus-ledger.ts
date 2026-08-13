import crypto from "node:crypto";
import { audit } from "./audit-log";
import { ExpectedError } from "./errors";
import { assertWritable, readJson, updateJson } from "./store";
import type { BonusTransaction, Order } from "./types";

const FILE = "bonus-ledger.json";
export const BONUS_MAX_REDEMPTION_PERCENT = 30;
export const BONUS_TTL_DAYS = 365;
const MAX_ADJUSTMENT = 1_000_000;

type Lot = { amount: number; expiresAt?: string };

export type BonusSummary = {
  balance: number;
  expiresAt?: string;
};

function validTime(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function pruneExpired(lots: Lot[], at: number): Lot[] {
  return lots.filter((lot) => lot.amount > 0 && validTime(lot.expiresAt) > at);
}

/**
 * Считает баланс через «партии»: списание сначала расходует бонусы, которые
 * сгорят раньше. Поэтому истечение старого начисления не превращает новый
 * баланс в отрицательный и не отнимает более свежие бонусы.
 */
export function calculateBonusSummary(
  transactions: BonusTransaction[],
  now = new Date(),
): BonusSummary {
  const nowMs = now.getTime();
  let lots: Lot[] = [];
  const ordered = [...transactions]
    .filter((entry) => Number.isInteger(entry.amount) && entry.amount !== 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  for (const entry of ordered) {
    const at = Date.parse(entry.createdAt);
    if (!Number.isFinite(at) || at > nowMs) continue;
    lots = pruneExpired(lots, at);

    if (entry.amount > 0) {
      lots.push({ amount: entry.amount, expiresAt: entry.expiresAt });
      continue;
    }

    let remaining = -entry.amount;
    lots.sort((a, b) => validTime(a.expiresAt) - validTime(b.expiresAt));
    for (const lot of lots) {
      if (remaining <= 0) break;
      const used = Math.min(lot.amount, remaining);
      lot.amount -= used;
      remaining -= used;
    }
    lots = lots.filter((lot) => lot.amount > 0);
  }

  lots = pruneExpired(lots, nowMs);
  const balance = lots.reduce((sum, lot) => sum + lot.amount, 0);
  const expiring = lots
    .map((lot) => lot.expiresAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  return { balance, ...(expiring ? { expiresAt: expiring } : {}) };
}

export function getBonusTransactions(customerId?: string): BonusTransaction[] {
  let entries: BonusTransaction[];
  try {
    entries = readJson<BonusTransaction[]>(FILE);
  } catch {
    entries = [];
  }
  return entries
    .filter((entry) => !customerId || entry.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBonusSummary(customerId: string): BonusSummary {
  return calculateBonusSummary(getBonusTransactions(customerId));
}

function expiresFrom(now: Date): string {
  return new Date(now.getTime() + BONUS_TTL_DAYS * 24 * 60 * 60 * 1_000).toISOString();
}

function checkedAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value === 0 || Math.abs(value) > MAX_ADJUSTMENT) {
    throw new ExpectedError("Бонусы должны быть целым числом от 1 до 1 000 000.");
  }
  return value;
}

function appendChecked(
  entry: BonusTransaction,
  requireBalance: number,
): BonusTransaction {
  assertWritable();
  updateJson<BonusTransaction[]>(FILE, (all) => {
    const mine = all.filter((item) => item.customerId === entry.customerId);
    if (calculateBonusSummary(mine).balance < requireBalance) {
      throw new ExpectedError("У клиента недостаточно бонусов.");
    }
    return [...all, entry];
  });
  return entry;
}

export function adjustCustomerBonus(input: {
  customerId: string;
  amount: number;
  reason: string;
  actor?: string;
}): BonusTransaction {
  const amount = checkedAmount(input.amount);
  const reason = input.reason.trim().slice(0, 240);
  if (reason.length < 3) throw new ExpectedError("Укажите причину изменения бонусов.");
  const now = new Date();
  const entry: BonusTransaction = {
    id: crypto.randomUUID(),
    customerId: input.customerId,
    type: amount > 0 ? "admin_credit" : "admin_debit",
    amount,
    createdAt: now.toISOString(),
    ...(amount > 0 ? { expiresAt: expiresFrom(now) } : {}),
    reason,
    actor: input.actor ?? "Администратор",
  };
  appendChecked(entry, amount < 0 ? -amount : 0);
  audit({
    entity: "customer",
    entityId: input.customerId,
    action: amount > 0 ? "bonus_credit" : "bonus_debit",
    summary: `${amount > 0 ? "Начислено" : "Списано"} ${Math.abs(amount)} бонусов: ${reason}`,
    after: entry,
  });
  return entry;
}

/** Резервирует бонусы до записи заказа. При ошибке оформления резерв возвращается. */
export function reserveOrderBonus(customerId: string, amount: number): BonusTransaction {
  const spend = Math.abs(checkedAmount(amount));
  const now = new Date();
  return appendChecked({
    id: crypto.randomUUID(),
    customerId,
    type: "order_spend",
    amount: -spend,
    createdAt: now.toISOString(),
    reason: "Списание при оформлении заказа",
    actor: "Покупатель",
  }, spend);
}

export function attachBonusToOrder(transactionId: string, orderId: string): void {
  updateJson<BonusTransaction[]>(FILE, (all) =>
    all.map((entry) => entry.id === transactionId ? { ...entry, orderId } : entry),
  );
}

function groupNet(all: BonusTransaction[], rootId: string): number {
  return all
    .filter((entry) => entry.id === rootId || entry.relatedId === rootId)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

function desiredBonusNet(order: Order): number {
  const paymentReleases = new Set(["FAILED", "VOIDED", "REFUNDED"]);
  return order.status === "canceled" || paymentReleases.has(order.payment?.status ?? "")
    ? 0
    : -(order.bonus?.spent ?? 0);
}

/**
 * Приводит списание по заказу к нужному состоянию. Повторный вебхук или
 * повторное сохранение статуса ничего не дублируют: сравнивается общий итог
 * всех операций, связанных с исходным списанием.
 */
export function reconcileOrderBonus(order: Order): boolean {
  const rootId = order.bonus?.transactionId;
  if (!rootId || !order.customerId || !order.bonus?.spent) return false;
  const now = new Date();
  let changed = false;
  updateJson<BonusTransaction[]>(FILE, (all) => {
    const current = groupNet(all, rootId);
    const target = desiredBonusNet(order);
    const delta = target - current;
    if (delta === 0) return all;
    if (delta < 0) {
      const available = calculateBonusSummary(
        all.filter((entry) => entry.customerId === order.customerId),
        now,
      ).balance;
      if (available < -delta) {
        throw new ExpectedError(
          `Нельзя вернуть заказ в работу: клиенту не хватает ${-delta} бонусов для повторного списания.`,
        );
      }
    }
    changed = true;
    const returning = delta > 0;
    return [...all, {
      id: crypto.randomUUID(),
      customerId: order.customerId!,
      type: returning ? "order_return" : "order_spend",
      amount: delta,
      createdAt: now.toISOString(),
      ...(returning ? { expiresAt: expiresFrom(now) } : {}),
      reason: returning
        ? `Возврат бонусов по заказу №${order.id}`
        : `Повторное списание по заказу №${order.id}`,
      actor: "Система",
      orderId: order.id,
      relatedId: rootId,
    }];
  });
  return changed;
}

export function releaseBonusReservation(transaction: BonusTransaction): void {
  const now = new Date();
  updateJson<BonusTransaction[]>(FILE, (all) => {
    if (groupNet(all, transaction.id) >= 0) return all;
    return [...all, {
      id: crypto.randomUUID(),
      customerId: transaction.customerId,
      type: "order_return",
      amount: -transaction.amount,
      createdAt: now.toISOString(),
      expiresAt: expiresFrom(now),
      reason: "Заказ не был создан — резерв возвращён",
      actor: "Система",
      relatedId: transaction.id,
    }];
  });
}

export function removeCustomerBonusLedger(customerId: string): void {
  updateJson<BonusTransaction[]>(FILE, (all) =>
    all.filter((entry) => entry.customerId !== customerId),
  );
}

export function maxRedeemableBonus(goodsAfterDiscount: number, balance: number): number {
  if (!Number.isFinite(goodsAfterDiscount) || !Number.isFinite(balance)) return 0;
  return Math.max(0, Math.min(
    Math.floor(balance),
    Math.floor(Math.max(0, goodsAfterDiscount) * BONUS_MAX_REDEMPTION_PERCENT / 100),
  ));
}
