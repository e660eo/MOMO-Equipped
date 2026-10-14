import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { pruneClosedSupport, pruneExpiredBackups } from "./privacy-maintenance";
import { pruneOldOrders } from "./orders";
import { captureConsent } from "./privacy-consent";
import { consentSubmission } from "./privacy-documents";
import type { Order, SupportConversation } from "./types";

let dir = "";
const previous = process.env.MOMO_DATA_DIR;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-privacy-test-"));
  process.env.MOMO_DATA_DIR = dir;
});
afterAll(() => {
  if (previous === undefined) delete process.env.MOMO_DATA_DIR; else process.env.MOMO_DATA_DIR = previous;
  if (dir.startsWith(path.join(os.tmpdir(), "momo-privacy-test-"))) fs.rmSync(dir, { recursive: true, force: true });
});
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));

it("retains active, recently completed, ambiguous legacy orders and pending payments", () => {
  const base: Order = { id: "base", createdAt: "2010-01-01", status: "done", customer: { name: "Test", phone: "", address: "" }, items: [], total: 0 };
  const terminal = (id: string, at: string): Order => ({ ...base, id, history: [{ at, actor: "admin", type: "status", to: "done" }] });
  write("orders.json", [
    terminal("expired", "2011-01-01"), terminal("recent", new Date().toISOString()),
    { ...base, id: "legacy" }, { ...base, id: "active", status: "in_work" },
    { ...base, id: "pending", status: "new", payment: { status: "PENDING" } },
    { ...base, id: "authorized", status: "new", payment: { status: "AUTHORIZED" } },
    { ...base, id: "failed", status: "new", payment: { status: "FAILED" } },
  ]);
  expect(pruneOldOrders()).toBe(2);
  expect(read("orders.json").map((o: Order) => o.id)).toEqual(["recent", "legacy", "active", "pending", "authorized"]);
});

it("clears only closed support with a documented retention basis", () => {
  const base: SupportConversation = {
    id: "closed", visitorTokenHash: "", name: "Test", contact: "example.invalid",
    status: "closed", createdAt: "2020-01-01", updatedAt: "2020-01-01", messages: [],
    consent: captureConsent(consentSubmission(), "support"),
  };
  write("support-conversations.json", [
    base, { ...base, id: "open", status: "open" }, { ...base, id: "legacy", consent: undefined },
    { ...base, id: "recent", updatedAt: new Date().toISOString() },
  ]);
  expect(pruneClosedSupport()).toBe(1);
  expect(read("support-conversations.json").map((c: SupportConversation) => c.id)).toEqual(["open", "legacy", "recent"]);
  expect(pruneClosedSupport()).toBe(0);
});

it("expires only known old backup files and preserves current files and unrelated material", () => {
  const backups = path.join(dir, "backups");
  fs.mkdirSync(backups, { recursive: true });
  const names = ["orders.json.2020-01-01T00-00-00-000Z", "momo-data-2020-01-01_030000.tar.gz", "keep.txt", "orders.json.2026-10-14T00-00-00-000Z"];
  for (const name of names) fs.writeFileSync(path.join(backups, name), "test");
  const old = new Date(Date.now() - 40 * 86400000);
  for (const name of names.slice(0, 3)) fs.utimesSync(path.join(backups, name), old, old);
  fs.mkdirSync(path.join(backups, "customers.json.2020-01-01T00-00-00-000Z"));
  expect(pruneExpiredBackups()).toBe(2);
  expect(fs.existsSync(path.join(backups, "keep.txt"))).toBe(true);
  expect(fs.existsSync(path.join(backups, names[3]))).toBe(true);
  expect(fs.existsSync(path.join(dir, "orders.json"))).toBe(true);
});
