import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("file store cache", () => {
  let tempDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-store-cache-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("refreshes the page cache after a separate server-action module saves zero and hides a product", async () => {
    const pageStore = await import("./store");
    pageStore.writeJson("products.json", [{ slug: "achilles", stock: 20, hidden: false }]);
    expect(pageStore.readJson("products.json")).toEqual([{ slug: "achilles", stock: 20, hidden: false }]);

    vi.resetModules();
    const actionStore = await import("./store");
    actionStore.updateJson<Array<{ slug: string; stock: number; hidden: boolean }>>(
      "products.json",
      (products) => products.map((product) => ({ ...product, stock: 0, hidden: true })),
    );

    expect(pageStore.readJson("products.json")).toEqual([{ slug: "achilles", stock: 0, hidden: true }]);
  });

  it("keeps the parsed value cached while the file is unchanged", async () => {
    const store = await import("./store");
    store.writeJson("stock-test.json", [{ stock: 10 }]);
    const first = store.readJson("stock-test.json");
    expect(store.readJson("stock-test.json")).toBe(first);
  });

  it("detects atomic replacements even with identical size and modification time", async () => {
    const store = await import("./store");
    const full = path.join(tempDir, "stock-test.json");
    fs.writeFileSync(full, '[{"stock":10}]');
    const originalStat = fs.statSync(full);
    expect(store.readJson("stock-test.json")).toEqual([{ stock: 10 }]);
    const replacement = path.join(tempDir, "replacement.json");
    fs.writeFileSync(replacement, '[{"stock":20}]');
    fs.utimesSync(replacement, originalStat.atime, originalStat.mtime);
    fs.renameSync(replacement, full);
    expect(store.readJson("stock-test.json")).toEqual([{ stock: 20 }]);
  });

  it("does not serve cached data for a deleted file", async () => {
    const store = await import("./store");
    store.writeJson("stock-test.json", [{ stock: 10 }]);
    store.readJson("stock-test.json");
    fs.unlinkSync(path.join(tempDir, "stock-test.json"));
    expect(() => store.readJson("stock-test.json")).toThrow();
  });
});
