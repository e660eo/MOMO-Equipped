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

  it("rolls back every staged file and leaves cached values intact on validation failure", async () => {
    const store = await import("./store");
    store.writeJson("stock-test.json", [{ stock: 5 }]);
    expect(() => store.withStoreTransaction(() => {
      store.updateJson<Array<{ stock: number }>>("stock-test.json", (rows) => { rows[0].stock = 2; return rows; });
      store.writeJson("agreement-test.json", { paid: true });
      expect(store.readJson("stock-test.json")).toEqual([{ stock: 2 }]);
      throw new Error("abort");
    })).toThrow("abort");
    expect(store.readJson("stock-test.json")).toEqual([{ stock: 5 }]);
    expect(fs.existsSync(path.join(tempDir, "agreement-test.json"))).toBe(false);
  });

  it("recovers a prepared multi-file commit before serving a read", async () => {
    const store = await import("./store");
    store.writeJson("stock-test.json", [{ stock: 5 }]);
    fs.writeFileSync(path.join(tempDir, "store-transaction.pending.json"), JSON.stringify([
      ["stock-test.json", [{ stock: 2 }]], ["agreement-test.json", { paid: true }],
    ]));
    expect(store.readJson("stock-test.json")).toEqual([{ stock: 2 }]);
    expect(store.readJson("agreement-test.json")).toEqual({ paid: true });
    expect(fs.existsSync(path.join(tempDir, "store-transaction.pending.json"))).toBe(false);
  });

  it("does not replace corrupt collections with an empty array", async () => {
    const store = await import("./store");
    fs.writeFileSync(path.join(tempDir, "corrupt.json"), "{");
    expect(() => store.updateJson("corrupt.json", () => [])).toThrow();
    expect(fs.readFileSync(path.join(tempDir, "corrupt.json"), "utf8")).toBe("{");
  });
});
