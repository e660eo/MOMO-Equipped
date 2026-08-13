import crypto from "node:crypto";
import { readJson, updateJson } from "./store";
import type { AuditEntity, AuditLogEntry } from "./types";

const FILE = "audit-log.json";
const MAX_ENTRIES = 2_000;

export function getAuditLog(limit = 200): AuditLogEntry[] {
  try {
    return readJson<AuditLogEntry[]>(FILE).slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export function audit(input: {
  entity: AuditEntity;
  entityId: string;
  action: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  actor?: string;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: input.actor ?? "Администратор",
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    summary: input.summary,
    ...(input.before !== undefined ? { before: input.before } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
  };
  updateJson<AuditLogEntry[]>(FILE, (all) => [entry, ...all].slice(0, MAX_ENTRIES));
  return entry;
}

