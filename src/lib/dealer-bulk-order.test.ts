import { describe, expect, it } from "vitest";
import { parseBulkOrder, type BulkProduct } from "./dealer-bulk-order";
const products: BulkProduct[] = [
  { slug: "ub", title: "Сабвуфер MOMO UB-10.250", article: "100", price: 1000, available: true, stock: 8 },
  { slug: "he", title: "MOMO HE-612", price: 600, available: true, stock: null },
];
describe("dealer bulk paste", () => {
  it("accepts Excel headers, exact models, Cyrillic brand letters and quantities", () => {
    const rows = parseBulkOrder("Модель\tКоличество\nUB-10.250\t2\nМОМО HE-612 — 4", products);
    expect(rows.map((r) => [r.product?.slug, r.qty, r.error])).toEqual([["ub", 2, undefined], ["he", 4, undefined]]);
  });
  it("counts duplicates together with the existing draft", () => {
    const rows = parseBulkOrder("100\t3\nUB-10.250\t3", products, { ub: 3 });
    expect(rows[1].error).toContain("нужно 9, доступно 8");
  });
  it("refuses ambiguity, malformed columns, fractional quantities and hidden products", () => {
    expect(parseBulkOrder("UB-10.250\t1", [...products, { ...products[0], slug: "other" }])[0].error).toContain("Несколько");
    for (const text of ["UB-10.250\t2\t3", "UB-10.250\t1.5", "UB-10.250\t0", "UNKNOWN\t2"]) expect(parseBulkOrder(text, products)[0].error).toBeTruthy();
    expect(parseBulkOrder("UB-10.250\t1", [{ ...products[0], available: false }])[0].error).toContain("доступно 0");
  });
  it("does not silently truncate oversized requests or match partial model numbers", () => {
    expect(parseBulkOrder("UB-10\t1", products)[0].error).toBeTruthy();
    expect(parseBulkOrder(Array(201).fill("100\t1").join("\n"), products)[0].error).toContain("200 строк");
  });
});
