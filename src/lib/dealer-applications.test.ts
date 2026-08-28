import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteDealerApplication,
  getDealerApplication,
  getDealerApplications,
  setDealerApplicationArchived,
} from "./dealers";

describe("dealer application archive", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-dealer-applications-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;
    fs.writeFileSync(path.join(tempDir, "dealer-applications.json"), JSON.stringify([
      {
        id: "application-1",
        createdAt: "2026-08-28T08:00:00.000Z",
        company: "Тестовый партнёр",
        city: "Москва",
        contactName: "Иван",
        phone: "+7 900 000-00-00",
        email: "dealer@example.com",
        businessType: "store",
        status: "new",
      },
    ]));
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("archives and restores an application without losing its data", () => {
    const archived = setDealerApplicationArchived("application-1", true);
    expect(archived?.archivedAt).toBeTruthy();
    expect(getDealerApplication("application-1")?.company).toBe("Тестовый партнёр");

    const restored = setDealerApplicationArchived("application-1", false);
    expect(restored?.archivedAt).toBeUndefined();
    expect(getDealerApplications()).toHaveLength(1);
  });

  it("deletes an application permanently", () => {
    setDealerApplicationArchived("application-1", true);
    expect(deleteDealerApplication("application-1")?.id).toBe("application-1");
    expect(getDealerApplications()).toEqual([]);
  });
});
