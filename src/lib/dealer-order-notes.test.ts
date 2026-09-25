import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDealerOrderNotes, saveDealerOrderNote } from "./dealer-order-notes";
import { getDealerOrders } from "./dealers";
import { writeJson } from "./store";
let dir: string, previous: string | undefined;
beforeEach(() => {
  previous = process.env.MOMO_DATA_DIR;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-notes-"));
  process.env.MOMO_DATA_DIR = dir;
  writeJson("dealer-orders.json", [{ id: "D-note", accountId: "a", createdAt: "2026-09-25" }]);
});
afterEach(() => {
  if (previous === undefined) delete process.env.MOMO_DATA_DIR; else process.env.MOMO_DATA_DIR = previous;
  fs.rmSync(dir, { recursive: true, force: true });
});
it("stores internal notes separately from dealer-visible order data", () => {
  saveDealerOrderNote("D-note", 0, "Позвонить", "2026-09-26");
  expect(getDealerOrderNotes()[0]).toMatchObject({ note: "Позвонить", followUpDate: "2026-09-26", revision: 1 });
  expect(JSON.stringify(getDealerOrders("a"))).not.toContain("Позвонить");
  expect(() => saveDealerOrderNote("D-note", 0, "Устаревшая правка", "")).toThrow("другом окне");
  saveDealerOrderNote("D-note", 1, "", "");
  expect(getDealerOrderNotes()[0].followUpDate).toBe("");
});
it("rejects invalid dates and unknown orders", () => {
  expect(() => saveDealerOrderNote("D-note", 0, "", "2026-02-30")).toThrow("дату");
  expect(() => saveDealerOrderNote("missing", 0, "", "")).toThrow("не найден");
});
