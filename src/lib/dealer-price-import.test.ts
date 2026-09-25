import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { buildDealerPriceImport } from "./dealer-price-import";
import { readDealerWorkbook, validateDealerWorkbookArchive, type DealerWorkbookData } from "./dealer-workbook";
import { compactDealerWorkbook } from "./dealer-workbook-compact";
import sourceMap from "./dealer-price-source-map.json";
import products from "../../data/products.json";
import current from "../../data/b2b-prices.json";
import type { Product } from "./types";

const fixture = () => fs.readFileSync(new URL("./__fixtures__/dealer-price-2026-09-24.xlsx", import.meta.url));
const emptyBook = { version: 1, updatedAt: "", sources: {}, prices: {} };
const mappedProduct = sourceMap.products[0];
const sampleRow = { sheet: mappedProduct.sheet, row: 4, model: mappedProduct.model, description: mappedProduct.description, sourcePrice: 1234.567 };
const singleProduct = products.filter((product) => product.slug === mappedProduct.slug) as Product[];
const sample = (rows = [sampleRow]): DealerWorkbookData => ({ rows, errors: [] });

describe("dealer Excel import", () => {
  it("reproduces all 106 reviewed prices from the supplied workbook, including kits, without cable cuts", async () => {
    const workbook = await readDealerWorkbook(fixture());
    const preview = buildDealerPriceImport(workbook, products as Product[], current, "new.xlsx");
    expect(preview.conflicts).toEqual([]);
    expect(preview.nextBook.prices).toEqual(current.prices);
    expect(preview.changes).toHaveLength(106);
    expect(preview.changes.every((row) => row.kind === "unchanged")).toBe(true);
    expect(preview.ignoredCuts).toBe(29);
    for (const slug of sourceMap.excludedCuts) expect(preview.nextBook.prices[slug]).toBeUndefined();
    const fuse = preview.changes.find((row) => row.source?.model === "MINI ANL 150A");
    expect(fuse?.next).toBe(169);
    expect(fuse?.source?.description).toBe("Колба + Предохранитель 150A");
    const grills = preview.changes.filter((row) => row.source?.multiplier === 2);
    expect(grills).toHaveLength(4);
    for (const grill of grills) expect(grill.next).toBe(grill.source!.price * 2);
    expect(preview.unmatched.some((row) => row.model === "MINI ANL 150A" && row.description.includes("без колбы"))).toBe(true);
  });

  it("matches exact source identity after row and column order changes, without fuzzy model matching", async () => {
    const data = await readDealerWorkbook(fixture());
    const reversed = { ...data, rows: data.rows.toReversed().map((row, index) => ({ ...row, row: index + 7 })) };
    expect(buildDealerPriceImport(reversed, products as Product[], current, "new.xlsx").nextBook.prices).toEqual(current.prices);
    const changedModel = sample([{ ...sampleRow, model: `${sampleRow.model} V2` }]);
    const preview = buildDealerPriceImport(changedModel, singleProduct, current, "new.xlsx");
    expect(preview.changes[0].kind).toBe("removed");
    expect(preview.unmatched).toHaveLength(1);
    expect(preview.conflicts).toContain("Ни одна позиция не сопоставлена с каталогом. Пустой прайс применять нельзя.");
  });

  it("blocks duplicate exact model variants and missing formula results", () => {
    const duplicate = buildDealerPriceImport(sample([sampleRow, { ...sampleRow, row: 50, sourcePrice: 999 }]), singleProduct, current, "new.xlsx");
    expect(duplicate.conflicts[0]).toContain("несколько одинаковых");
    const missing = buildDealerPriceImport({ rows: [{ ...sampleRow, sourcePrice: null }], errors: [] }, singleProduct, current, "new.xlsx");
    expect(missing.conflicts[0]).toContain("Пересчитайте и сохраните формулы");
  });

  it("reads cached numeric formula prices and blocks formulas with missing cached results", async () => {
    const parts = unzipSync(fixture());
    const xml = Buffer.from(parts["xl/worksheets/sheet1.xml"]).toString("utf8");
    parts["xl/worksheets/sheet1.xml"] = strToU8(xml.replace('<c r="B4" s="19"><v>2375</v></c>', '<c r="B4" s="19"><f>1+1</f><v>2375</v></c>'));
    const cached = await readDealerWorkbook(Buffer.from(zipSync(parts)));
    expect(cached.rows.find((row) => row.sheet === "ДИНАМИКИ РУПОРА" && row.row === 4)?.sourcePrice).toBe(2375);
    parts["xl/worksheets/sheet1.xml"] = strToU8(xml.replace('<c r="B4" s="19"><v>2375</v></c>', '<c r="B4" s="19"><f>1+1</f></c>'));
    const uncached = await readDealerWorkbook(Buffer.from(zipSync(parts)));
    const preview = buildDealerPriceImport(uncached, products as Product[], current, "new.xlsx");
    expect(preview.conflicts.some((message) => message.includes("HE-1000") && message.includes("Пересчитайте"))).toBe(true);
  });

  it("shows removals rather than preserving stale prices and never restores a hidden product", () => {
    const product = singleProduct[0];
    const book = { ...emptyBook, prices: { [product.slug]: { dealer: 1 } } };
    const preview = buildDealerPriceImport(sample(), [{ ...product, hidden: true }], book, "new.xlsx");
    expect(preview.changes[0]).toMatchObject({ previous: 1, next: null, kind: "removed" });
    expect(preview.nextBook.prices).toEqual({});
    const added = buildDealerPriceImport(sample(), singleProduct, emptyBook, "new.xlsx");
    expect(added.changes[0]).toMatchObject({ previous: null, next: 1234.57, kind: "added" });
  });

  it("discards embedded photos from uploaded copies", async () => {
    const parts = unzipSync(fixture());
    parts["xl/media/image1.jpg"] = new Uint8Array(500_000);
    const compact = compactDealerWorkbook(zipSync(parts));
    expect(unzipSync(compact)["xl/media/image1.jpg"]).toBeUndefined();
    expect((await readDealerWorkbook(Buffer.from(compact))).errors).toEqual([]);
  });

  it("rejects oversized XML, external entities, sparse sheets and non-xlsx input", async () => {
    const parts = unzipSync(fixture());
    const oversized = zipSync({ ...parts, "xl/worksheets/sheet1.xml": new Uint8Array(4 * 1024 * 1024 + 1) });
    await expect(validateDealerWorkbookArchive(Buffer.from(oversized))).rejects.toThrow("слишком большие");
    await expect(validateDealerWorkbookArchive(Buffer.from("not an Excel archive"))).rejects.toThrow("формате .xlsx");
    const entity = zipSync({ ...parts, "xl/styles.xml": strToU8('<!DOCTYPE x [<!ENTITY x "bad">]><x/>') });
    await expect(validateDealerWorkbookArchive(Buffer.from(entity))).rejects.toThrow("XML-объявления");
    const sparse = zipSync({ ...parts, "xl/worksheets/sheet1.xml": strToU8('<worksheet><dimension ref="A1:XFD1048576"/></worksheet>') });
    await expect(validateDealerWorkbookArchive(Buffer.from(sparse))).rejects.toThrow("5000 строк");
  });
});
