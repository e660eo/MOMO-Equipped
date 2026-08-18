import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteDealer,
  getDealerAccounts,
  getDealerLocations,
  getDealerOrders,
} from "./dealers";

describe("dealer deletion", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-dealer-delete-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;

    fs.writeFileSync(path.join(tempDir, "dealers.json"), JSON.stringify([
      { id: "dealer-delete", name: "Удаляемый", city: "Москва", address: "Адрес", phone: "+7", active: true, createdAt: "2026-08-18" },
      { id: "dealer-keep", name: "Оставляемый", city: "Казань", address: "Адрес", phone: "+7", active: true, createdAt: "2026-08-18" },
    ]));
    fs.writeFileSync(path.join(tempDir, "dealer-accounts.json"), JSON.stringify([
      { id: "account-delete", dealerId: "dealer-delete", contactName: "Иван", email: "delete@example.com", passwordHash: "hash", discountPercent: 10, createdAt: "2026-08-18" },
      { id: "account-keep", dealerId: "dealer-keep", contactName: "Анна", email: "keep@example.com", passwordHash: "hash", discountPercent: 10, createdAt: "2026-08-18" },
    ]));
    fs.writeFileSync(path.join(tempDir, "dealer-orders.json"), JSON.stringify([
      { id: "D-1", dealerId: "dealer-delete", accountId: "account-delete", createdAt: "2026-08-18", status: "done", items: [], total: 0, history: [] },
    ]));
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes the location and its accounts but preserves order history", () => {
    const result = deleteDealer("dealer-delete");

    expect(result?.dealer.name).toBe("Удаляемый");
    expect(result?.removedAccounts.map((account) => account.id)).toEqual([
      "account-delete",
    ]);
    expect(getDealerLocations(false).map((dealer) => dealer.id)).toEqual([
      "dealer-keep",
    ]);
    expect(getDealerAccounts().map((account) => account.id)).toEqual([
      "account-keep",
    ]);
    expect(getDealerOrders().map((order) => order.id)).toEqual(["D-1"]);
  });
});
