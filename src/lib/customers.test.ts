import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuditLog } from "./audit-log";
import {
  deleteCustomer,
  getCustomers,
  markCustomerEmailVerified,
  registerCustomer,
} from "./customers";

describe("customer lifecycle audit", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-customers-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;
    fs.writeFileSync(path.join(tempDir, "customers.json"), "[]\n");
    fs.writeFileSync(path.join(tempDir, "audit-log.json"), "[]\n");
    fs.writeFileSync(path.join(tempDir, "bonus-ledger.json"), "[]\n");
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("records registration, verification and deletion without contact data", () => {
    const result = registerCustomer({
      name: "Тестовый покупатель",
      email: "buyer@example.com",
      phone: "+7 999 123-45-67",
      password: "safe-password",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(markCustomerEmailVerified(result.customer.id)).toBe(true);
    deleteCustomer(result.customer.id);

    expect(getCustomers()).toHaveLength(0);
    const entries = getAuditLog(10);
    expect(entries.map((entry) => entry.action)).toEqual([
      "customer_deleted",
      "email_verified",
      "customer_registered",
    ]);
    expect(entries.every((entry) => entry.actor === "Покупатель")).toBe(true);

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("9991234567");
    expect(entries[0]?.entityId).toBe(result.customer.id);
    expect(entries[2]?.entityId).toBe(result.customer.id);
  });
});
