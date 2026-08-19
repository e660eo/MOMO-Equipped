import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getDealerAccounts,
  getDealerLocation,
  updateDealerAccountProfile,
  updateDealerLocationDetails,
} from "./dealers";

describe("dealer editing", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-dealer-update-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;

    fs.writeFileSync(path.join(tempDir, "dealers.json"), JSON.stringify([
      {
        id: "dealer-edit",
        name: "Старое название",
        city: "Москва",
        address: "Старый адрес",
        phone: "+7 900 000-00-00",
        email: "old-public@example.com",
        active: true,
        createdAt: "2026-08-18",
      },
    ]));
    fs.writeFileSync(path.join(tempDir, "dealer-accounts.json"), JSON.stringify([
      {
        id: "account-edit",
        dealerId: "dealer-edit",
        contactName: "Старый контакт",
        email: "old-login@example.com",
        passwordHash: "hash",
        priceTier: "dealer",
        discountPercent: 10,
        createdAt: "2026-08-18",
      },
      {
        id: "account-other",
        dealerId: "dealer-other",
        contactName: "Другой дилер",
        email: "occupied@example.com",
        passwordHash: "hash",
        priceTier: "dealer",
        discountPercent: 5,
        createdAt: "2026-08-18",
      },
    ]));
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("updates public location details without changing publication state", () => {
    updateDealerLocationDetails("dealer-edit", {
      name: "Новое название",
      city: "Казань",
      address: "Новый адрес",
      phone: "+7 999 111-22-33",
      email: undefined,
      website: "https://dealer.example.com",
      hours: "Пн–Пт: 10:00–19:00",
      latitude: 55.796127,
      longitude: 49.106405,
      kind: "store_install",
      officialStatus: "representative",
      authorizedInstallation: true,
    });

    expect(getDealerLocation("dealer-edit")).toMatchObject({
      name: "Новое название",
      city: "Казань",
      address: "Новый адрес",
      phone: "+7 999 111-22-33",
      active: true,
      website: "https://dealer.example.com",
      kind: "store_install",
      officialStatus: "representative",
      authorizedInstallation: true,
    });
    expect(getDealerLocation("dealer-edit")?.email).toBeUndefined();
  });

  it("updates the linked account and normalizes its email", () => {
    updateDealerAccountProfile("account-edit", {
      contactName: "Новый контакт",
      email: " NEW-LOGIN@EXAMPLE.COM ",
      priceTier: "wholesale",
      discountPercent: 17.5,
    });

    expect(getDealerAccounts().find((item) => item.id === "account-edit")).toMatchObject({
      contactName: "Новый контакт",
      email: "new-login@example.com",
      priceTier: "wholesale",
      discountPercent: 17.5,
    });
  });

  it("does not allow duplicate login email", () => {
    expect(() => updateDealerAccountProfile("account-edit", {
      contactName: "Новый контакт",
      email: "occupied@example.com",
      priceTier: "dealer",
      discountPercent: 10,
    })).toThrow("ACCOUNT_EXISTS");
  });
});
