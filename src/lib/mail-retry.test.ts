import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readJson, writeJson } from "./store";
import { retryIntegrationMailJob } from "./job-queue";
import { retryDealerNotification } from "./dealer-order-notifications";
import { getMailJournal, recordMailAttempt } from "./mail-journal";
import type { IntegrationJob } from "./types";
let dir: string, previous: string | undefined;
beforeEach(() => {
  previous = process.env.MOMO_DATA_DIR;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-mail-retry-"));
  process.env.MOMO_DATA_DIR = dir;
});
afterEach(() => {
  if (previous === undefined) delete process.env.MOMO_DATA_DIR; else process.env.MOMO_DATA_DIR = previous;
  fs.rmSync(dir, { recursive: true, force: true });
});
it("retries only failed mail, leaving completed, running and nonmail jobs alone", () => {
  const jobs = [
    { id: "failed", type: "order_mail", status: "failed" },
    { id: "sent", type: "order_mail", status: "done" },
    { id: "running", type: "order_mail", status: "running" },
    { id: "payment", type: "payment_status", status: "failed" },
  ].map((item) => ({ ...item, attempts: 5, lastError: "error" }));
  writeJson("integration-jobs.json", jobs);
  for (const job of jobs) retryIntegrationMailJob(job.id);
  const result = readJson<IntegrationJob[]>("integration-jobs.json");
  expect(result[0]).toMatchObject({ status: "pending", attempts: 0 });
  expect(result.slice(1)).toEqual(jobs.slice(1));
});
it("does not resend an accepted dealer notification or steal an active attempt", () => {
  const jobs = ["failed", "sent", "sending"].map((status) => ({ id: status, status, attempts: 8, error: "error" }));
  writeJson("dealer-order-notifications.json", jobs);
  for (const job of jobs) retryDealerNotification(job.id);
  const result = readJson<Array<{ status: string; attempts: number }>>("dealer-order-notifications.json");
  expect(result[0]).toMatchObject({ status: "pending", attempts: 0 });
  expect(result.slice(1)).toEqual(jobs.slice(1));
});
it("persists bounded mail metadata with explicit server acceptance", () => {
  recordMailAttempt({ at: "2026-09-25T10:00:00Z", subject: "Test", to: ["test@example.test"], status: "accepted" });
  recordMailAttempt({ at: "2026-09-25T10:01:00Z", subject: "Test 2", to: [], status: "failed", error: "SMTP unavailable" });
  expect(getMailJournal().map((item) => item.status)).toEqual(["failed", "accepted"]);
  expect(Object.keys(getMailJournal()[1]).sort()).toEqual(["at", "id", "status", "subject", "to"]);
});
