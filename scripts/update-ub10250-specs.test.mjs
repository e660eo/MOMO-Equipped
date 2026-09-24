import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SLUG, SPECS, updateUb10250Specs } from "./update-ub10250-specs.mjs";

test("updates only confirmed fields and preserves live catalogue data and later edits", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-ub10250-"));
  try {
    const file = path.join(dir, "products.json");
    const original = [
      { slug: SLUG, price: 9876, stock: 37, image: "live.webp", ozonSku: 123,
        description: ["Импеданс: 4 Ом", "Примечание менеджера"], packageQuantity: 2 },
      { slug: "another-product", price: 1234, description: ["Живое описание"] },
    ];
    fs.writeFileSync(file, JSON.stringify(original));
    assert.equal(updateUb10250Specs(dir), true);
    const updated = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(updated[0], { ...original[0], description: [...SPECS, "Примечание менеджера"],
      packageQuantity: 1, packageContents: "Один сабвуфер MOMO UB-10.250." });
    assert.deepEqual(updated[1], original[1]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "backups", "ub10250-specs-2026-09-24", "products.json"))), original);
    updated[0].stock = 5;
    updated[0].description.push("Позднейшее уточнение");
    fs.writeFileSync(file, JSON.stringify(updated));
    assert.equal(updateUb10250Specs(dir), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), updated);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("missing product fails without changing data or marking the migration complete", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-ub10250-"));
  try {
    const file = path.join(dir, "products.json");
    fs.writeFileSync(file, "[]");
    assert.throws(() => updateUb10250Specs(dir), /Не найден товар/);
    assert.equal(fs.readFileSync(file, "utf8"), "[]");
    assert.deepEqual(fs.readdirSync(dir), ["products.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
