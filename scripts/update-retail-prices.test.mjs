import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import readXlsxFile from "read-excel-file/node";
import { UPDATE_ID, updateRetailPrices } from "./update-retail-prices.mjs";

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-retail-"));
  const product = { slug: "speaker", price: 100, stock: 7, hidden: true, title: "Live title", packageQuantity: 2, image: "live.jpg" };
  const original = [product, { slug: "unmatched", price: 500, stock: 0 }];
  fs.writeFileSync(path.join(dir, "products.json"), JSON.stringify(original));
  fs.writeFileSync(path.join(dir, "b2b-prices.json"), "unchanged dealer prices");
  // Only delete the exact temporary test directory created above.
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, product, original, read: () => JSON.parse(fs.readFileSync(path.join(dir, "products.json"), "utf8")) };
}
const source = { source: "Supplier.xlsx", products: [{ slug: "speaker", price: 120 }, { slug: "deleted", price: 200 }] };

test("every published price matches the supplier RRP cell and reviewed sale unit", async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("./retail-prices-2026-09-30.json", import.meta.url), "utf8"));
  const sheets = await readXlsxFile(fileURLToPath(new URL("../src/lib/__fixtures__/dealer-price-2026-09-24.xlsx", import.meta.url)));
  const mapping = JSON.parse(fs.readFileSync(new URL("../src/lib/dealer-price-source-map.json", import.meta.url), "utf8"));
  for (const entry of manifest.products) {
    const sheet = sheets.find((s) => s.sheet === entry.sheet);
    const row = Number(entry.cell.slice(1)) - 1;
    const column = entry.cell.charCodeAt(0) - 65;
    assert.equal(sheet.data[1][column], "РРЦ");
    assert.equal(sheet.data[row][0].trim(), entry.model.trim());
    assert.equal(sheet.data[row][column], entry.sourceRrp);
    const unit = mapping.products.find((p) => p.slug === entry.slug)?.multiplier ?? 1;
    assert.equal(entry.multiplier, unit);
    assert.equal(entry.price, Math.round(sheet.data[row][column] * unit));
    assert.equal(mapping.excludedCuts.includes(entry.slug), false);
  }
  assert.equal(manifest.products.find((p) => p.model === "MINI ANL 150A").cell, "D54");
  assert.equal(manifest.products.find((p) => p.model === "ZEUS TZ-95").price, 1176);
});

test("updates only retail price, preserving stock, visibility, dealer prices and deleted products", (t) => {
  const { dir, product, original, read } = fixture(t);
  assert.deepEqual(updateRetailPrices(dir, source).missing, ["deleted"]);
  assert.deepEqual(read(), [{ ...product, price: 120 }, original[1]]);
  assert.equal(fs.readFileSync(path.join(dir, "b2b-prices.json"), "utf8"), "unchanged dealer prices");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "backups", UPDATE_ID, "products.json"), "utf8")), original);
  const later = read(); later[0].price = 150; later[0].stock = 3;
  fs.writeFileSync(path.join(dir, "products.json"), JSON.stringify(later));
  assert.equal(updateRetailPrices(dir, source).applied, false);
  assert.deepEqual(read(), later);
});

test("rejects invalid or duplicate prices before touching the catalogue", (t) => {
  const { dir, original, read } = fixture(t);
  for (const price of [0, -1, NaN, Infinity, 1.234]) {
    assert.throws(() => updateRetailPrices(dir, { products: [{ slug: "speaker", price }] }));
  }
  assert.throws(() => updateRetailPrices(dir, { products: [source.products[0], source.products[0]] }));
  assert.deepEqual(read(), original);
});

test("cannot overwrite pending transactions or a concurrent catalogue write", (t) => {
  const { dir, original, read } = fixture(t);
  fs.writeFileSync(path.join(dir, "store-transaction.pending.json"), "pending");
  assert.throws(() => updateRetailPrices(dir, source), /Незавершённая/);
  fs.mkdirSync(path.join(dir, "store-transaction.json.lock"));
  assert.throws(() => updateRetailPrices(dir, source), /Каталог занят/);
  assert.deepEqual(read(), original);
  assert.equal(fs.existsSync(path.join(dir, `.catalog-update-${UPDATE_ID}`)), false);
});
