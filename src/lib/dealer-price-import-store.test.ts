import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDealerPriceImport } from "./dealer-price-import";
import sourceMap from "./dealer-price-source-map.json";
import products from "../../data/products.json";
import current from "../../data/b2b-prices.json";
import type { Product } from "./types";

const state = vi.hoisted(() => ({ files: {} as Record<string, unknown>, writes: [] as string[] }));
vi.mock("./store", () => ({
  assertWritable: vi.fn(),
  readJson: (name: string) => state.files[name],
  writeJson: (name: string, value: unknown) => { state.files[name] = value; state.writes.push(name); },
  updateJson: (name: string, update: (value: unknown) => unknown) => { state.files[name] = update(state.files[name]); },
}));
vi.mock("./data-file-lock", () => ({ withDataFileLock: (_file: string, operation: () => unknown) => operation() }));
vi.mock("./data", () => ({ getAllProducts: () => state.files["products.json"] }));
import { applyDealerPriceImport, saveDealerPriceImportPreview } from "./dealer-price-import-store";

function preview() {
  const mapping = sourceMap.products[0];
  return buildDealerPriceImport({ errors: [], rows: [{ sheet: mapping.sheet, row: 10, model: mapping.model, description: mapping.description, sourcePrice: 987 }] }, products as Product[], current, "reviewed.xlsx");
}

describe("reviewed dealer price application", () => {
  beforeEach(() => { state.files = { "products.json": structuredClone(products), "b2b-prices.json": structuredClone(current) }; state.writes = []; });

  it("stores preview privately without changing prices, then atomically applies only the saved proposal", () => {
    const draft = preview();
    saveDealerPriceImportPreview(draft);
    expect(state.files["b2b-prices.json"]).toEqual(current);
    expect(applyDealerPriceImport(draft.id)).toBe(1);
    expect(state.files["b2b-prices.json"]).toMatchObject({ sources: { dealer: "reviewed.xlsx" }, prices: draft.nextBook.prices });
    expect(state.writes).toEqual(["b2b-prices.json"]);
    expect(() => applyDealerPriceImport(draft.id)).toThrow("уже изменился");
  });

  it("rejects a preview when another administrator updates prices or catalogue", () => {
    const draft = preview();
    saveDealerPriceImportPreview(draft);
    state.files["b2b-prices.json"] = { ...current, updatedAt: "2099-01-01" };
    expect(() => applyDealerPriceImport(draft.id)).toThrow("уже изменился");
    state.files["b2b-prices.json"] = structuredClone(current);
    state.files["products.json"] = products.slice(1);
    expect(() => applyDealerPriceImport(draft.id)).toThrow("уже изменился");
    expect(state.writes).toEqual([]);
  });

  it("rejects unknown, expired and conflicting previews without saving prices", () => {
    expect(() => applyDealerPriceImport("missing")).toThrow("Предпросмотр истёк");
    const draft = { ...preview(), createdAt: new Date(Date.now() - 31 * 60_000).toISOString() };
    state.files["dealer-price-import-previews.json"] = [draft];
    expect(() => applyDealerPriceImport(draft.id)).toThrow("Предпросмотр истёк");
    draft.createdAt = new Date().toISOString();
    draft.conflicts.push("Duplicate price");
    expect(() => applyDealerPriceImport(draft.id)).toThrow("В прайсе есть ошибки");
    expect(state.writes).toEqual([]);
  });
});
