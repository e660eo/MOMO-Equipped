"use client";

import { useMemo, useSyncExternalStore } from "react";
import { applyDealerDraftMutation, dealerDraftStorageKey, emptyDealerDraft, parseDealerOrderDraft, validDealerDraftMutation, type DealerDraftMutation, type SyncedDealerDraft } from "./dealer-order-draft";

type SyncStatus = "loading" | "saved" | "saving" | "offline" | "auth";
type Snapshot = { draft: SyncedDealerDraft; status: SyncStatus; loaded: boolean };
const EMPTY: Snapshot = { draft: emptyDealerDraft(), status: "loading", loaded: false };
const stores = new Map<string, DealerDraftClient>();

function validDraft(value: unknown): value is SyncedDealerDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as SyncedDealerDraft;
  return Boolean(parseDealerOrderDraft(JSON.stringify(draft))) && Number.isSafeInteger(draft.revision)
    && draft.revision >= 0 && typeof draft.comment === "string" && draft.comment.length <= 700
    && Boolean(draft.quantities) && typeof draft.quantities === "object" && !Array.isArray(draft.quantities)
    && Object.values(draft.quantities).every((qty) => Number.isSafeInteger(qty) && qty >= 1 && qty <= 999)
    && Array.isArray(draft.applied) && draft.applied.every((id) => typeof id === "string");
}

export class DealerDraftClient {
  private base = emptyDealerDraft();
  private queue: DealerDraftMutation[] = [];
  private snapshot: Snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private running: Promise<boolean> | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private initialized = false;
  readonly key: string;
  constructor(readonly accountId: string) { this.key = dealerDraftStorageKey(accountId); }
  getSnapshot = () => this.snapshot;
  private publish(status = this.snapshot.status, loaded = this.snapshot.loaded) {
    const draft = this.queue.reduce(applyDealerDraftMutation, this.base);
    this.snapshot = { draft, status, loaded };
    this.listeners.forEach((listener) => listener());
  }
  private readPending() {
    try {
      const prefix = `${this.key}:pending:`;
      const pending = new Map(this.queue.map((mutation) => [mutation.id, mutation]));
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        const item = JSON.parse(localStorage.getItem(key) ?? "null");
        if (validDealerDraftMutation(item)) pending.set(item.id, item);
      }
      this.queue = [...pending.values()].filter((item) => !this.base.applied.includes(item.id));
    } catch { /* Keep in-memory edits when browser storage is unavailable. */ }
  }
  private accept(draft: SyncedDealerDraft) {
    if (draft.revision >= this.base.revision) this.base = draft;
    this.queue = this.queue.filter((mutation) => !this.base.applied.includes(mutation.id));
    try {
      for (const id of this.base.applied) localStorage.removeItem(`${this.key}:pending:${id}`);
      localStorage.setItem(this.key, JSON.stringify({ accountId: this.accountId, draft: this.base }));
    } catch { /* Server sync still works without browser storage. */ }
    this.readPending();
    this.publish(this.queue.length ? "saving" : "saved", true);
  }
  private receiveStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(this.key)) return;
    this.readPending();
    this.publish(this.queue.length ? "saving" : this.snapshot.status);
    void this.sync();
  };
  private wake = () => { if (document.visibilityState === "visible") void this.sync(); };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      if (!this.initialized) {
        this.initialized = true;
        try {
          const saved = JSON.parse(localStorage.getItem(this.key) ?? "null");
          if (saved?.accountId === this.accountId && validDraft(saved.draft)) this.base = saved.draft;
        } catch {}
        this.readPending();
        this.publish("loading");
      }
      window.addEventListener("storage", this.receiveStorage);
      window.addEventListener("online", this.wake);
      window.addEventListener("focus", this.wake);
      document.addEventListener("visibilitychange", this.wake);
      this.timer = setInterval(this.wake, 15_000);
      void this.sync();
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        clearInterval(this.timer);
        window.removeEventListener("storage", this.receiveStorage);
        window.removeEventListener("online", this.wake);
        window.removeEventListener("focus", this.wake);
        document.removeEventListener("visibilitychange", this.wake);
      }
    };
  };
  sync = (): Promise<boolean> => {
    if (this.running) return this.running;
    this.running = this.syncNow().finally(() => { this.running = null; });
    return this.running;
  };
  private async syncNow(): Promise<boolean> {
    try {
      this.readPending();
      do {
        const mutation = this.queue[0];
        if (mutation) this.publish("saving");
        const response = await fetch("/api/dealer/draft", {
          method: mutation ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
          headers: mutation ? { "Content-Type": "application/json" } : undefined,
          body: mutation ? JSON.stringify({ accountId: this.accountId, mutation }) : undefined,
          signal: AbortSignal.timeout(15_000),
        });
        if (response.status === 401 || response.status === 409) { this.publish("auth", true); return false; }
        if (!response.ok) throw new Error("Draft sync failed");
        const body = await response.json();
        if (body.accountId !== this.accountId) { this.publish("auth", true); return false; }
        if (!validDraft(body.draft)) throw new Error("Invalid draft response");
        this.accept(body.draft);
      } while (this.queue.length);
      return true;
    } catch { this.publish("offline", true); return false; }
  }
  private enqueue(mutation: DealerDraftMutation) {
    if (this.snapshot.status === "auth") return;
    this.queue.push(mutation);
    try { localStorage.setItem(`${this.key}:pending:${mutation.id}`, JSON.stringify(mutation)); } catch {}
    this.publish("saving", true);
    void this.sync();
  }
  setQuantity = (slug: string, qty: number) => {
    const previous = this.snapshot.draft.quantities[slug] ?? 0;
    const delta = Math.max(0, Math.min(999, qty)) - previous;
    if (delta) this.enqueue({ id: crypto.randomUUID(), mode: "adjust", lines: [{ slug, qty: delta }] });
  };
  setComment = (comment: string) => {
    if (comment !== this.snapshot.draft.comment) this.enqueue({ id: crypto.randomUUID(), mode: "adjust", lines: [], comment: comment.slice(0, 700) });
  };
  addItems = (items: Array<{ slug: string; qty: number }>) => {
    this.enqueue({ id: crypto.randomUUID(), mode: "adjust", lines: items.map((item) => ({ slug: item.slug, qty: Math.min(999, Math.max(0, item.qty)) })) });
  };
  consume = (requestId: string, lines: Array<{ slug: string; qty: number }>, comment: string) => {
    this.enqueue({ id: `order-${requestId}`, mode: "consume", lines, comment });
  };
}

export function useDealerDraft(accountId: string) {
  const client = useMemo(() => {
    let current = stores.get(accountId);
    if (!current) { current = new DealerDraftClient(accountId); stores.set(accountId, current); }
    return current;
  }, [accountId]);
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, () => EMPTY);
  return { ...snapshot, setQuantity: client.setQuantity, setComment: client.setComment, addItems: client.addItems, consume: client.consume, sync: client.sync };
}

const pendingSubmissions = new Map<string, string>();
type PendingSubmission = { id: string; payload: string };
function readSubmission(accountId: string): string | null {
  const key = `${dealerDraftStorageKey(accountId)}:submission`;
  try { return localStorage.getItem(key) ?? pendingSubmissions.get(accountId) ?? null; }
  catch { return pendingSubmissions.get(accountId) ?? null; }
}
export function getPendingDealerSubmission(accountId: string): PendingSubmission | null {
  try {
    const pending = JSON.parse(readSubmission(accountId) ?? "null");
    return pending && typeof pending.id === "string" && typeof pending.payload === "string" ? pending : null;
  } catch { return null; }
}
const submissionListeners = new Set<() => void>();
function emitSubmission() { submissionListeners.forEach((listener) => listener()); }
function subscribeSubmission(listener: () => void) {
  submissionListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { submissionListeners.delete(listener); window.removeEventListener("storage", listener); };
}
export function usePendingDealerSubmission(accountId: string): PendingSubmission | null {
  const raw = useSyncExternalStore(subscribeSubmission, () => readSubmission(accountId), () => null);
  return useMemo(() => { try { return JSON.parse(raw ?? "null"); } catch { return null; } }, [raw]);
}
export function dealerSubmissionId(accountId: string, payload: string): string {
  const key = `${dealerDraftStorageKey(accountId)}:submission`;
  const stored = getPendingDealerSubmission(accountId);
  if (stored?.payload === payload) return stored.id;
  if (stored) throw new Error("Сначала проверьте предыдущую отправку.");
  const id = crypto.randomUUID();
  const raw = JSON.stringify({ id, payload });
  try { localStorage.setItem(key, raw); pendingSubmissions.delete(accountId); }
  catch { pendingSubmissions.set(accountId, raw); }
  emitSubmission();
  return id;
}
export function finishDealerSubmission(accountId: string, requestId?: string) {
  if (requestId && getPendingDealerSubmission(accountId)?.id !== requestId) return;
  try { localStorage.removeItem(`${dealerDraftStorageKey(accountId)}:submission`); } catch {}
  pendingSubmissions.delete(accountId);
  emitSubmission();
}
