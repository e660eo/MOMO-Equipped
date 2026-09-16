import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PACKAGES, updateAuditFixes } from "./update-audit-fixes.mjs";

test("audit migration preserves live prices, stock and edited articles and is idempotent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-audit-test-"));
  try {
    const products = Object.keys(PACKAGES).map((slug) => ({ slug, title: slug, price: 5123, stock: 23 }));
    products.push({ slug: "hid-ksenonovaya-lampa-h4-3000-3200lm-5000-6000k-23000vt-zeus-857896", title: "HID H4 23000Вт Zeus", price: 100 });
    fs.writeFileSync(path.join(dir, "products.json"), JSON.stringify(products));
    fs.writeFileSync(path.join(dir, "news.json"), JSON.stringify([
      { slug: "novinki-momo-2026" }, { slug: "kak-vybrat-sabvufer" },
      { slug: "gramotnaya-akustika-v-mashine", body: "Already edited by store" },
    ]));
    assert.equal(updateAuditFixes(dir), true);
    const result = JSON.parse(fs.readFileSync(path.join(dir, "products.json")));
    assert.equal(result[0].packageQuantity, 2);
    assert.equal(result[1].packageQuantity, 1);
    assert.equal(result[0].price, 5123);
    assert.equal(result[0].stock, 23);
    assert.equal(result.at(-1).title, "HID H4 Zeus");
    const news = JSON.parse(fs.readFileSync(path.join(dir, "news.json")));
    assert.equal(news[0].productSlugs.length, 3);
    assert.ok(news[1].body.length > 1000);
    assert.equal(news[2].body, "Already edited by store");
    result[0].stock = 12;
    fs.writeFileSync(path.join(dir, "products.json"), JSON.stringify(result));
    assert.equal(updateAuditFixes(dir), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "products.json")))[0].stock, 12);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "backups/audit-fixes-2026-09-16/products.json"))), products);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
