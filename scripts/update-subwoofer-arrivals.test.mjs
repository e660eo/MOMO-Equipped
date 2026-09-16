import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ARRIVALS, NEWS_SLUG, updateSubwooferArrivals } from "./update-subwoofer-arrivals.mjs";

test("arrival migration preserves live data, backs up and never resets subsequent stock", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-arrivals-"));
  try {
    const write = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
    const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    write("products.json", [
      ...Object.keys(ARRIVALS).map((slug) => ({ slug, price: 9876, description: ["Live specs"], stock: 0, hidden: true, image: "live.webp" })),
      { slug: "unrelated", stock: 7 },
      { slug: "sabvufer-avtomobilnyy-achilles-12-dyuymov-902295", stock: 1 },
    ]);
    write("news.json", [{ slug: "live-news", date: "2026-09-01" }]);
    write("banners.json", [{ id: "momo-achilles-12", active: true }, { id: "custom", active: true }]);
    assert.equal(updateSubwooferArrivals(dir, path.resolve("data")), true);
    const products = read("products.json");
    for (const [slug, stock] of Object.entries(ARRIVALS)) {
      const product = products.find((p) => p.slug === slug);
      assert.equal(product.stock, stock);
      assert.equal(product.price, 9876);
      assert.deepEqual(product.description, ["Live specs"]);
      assert.equal(product.hidden, false);
    }
    assert.equal(products.find((p) => p.slug === "unrelated").stock, 7);
    assert.equal(read("banners.json").find((b) => b.id === "momo-achilles-12").active, false);
    assert.equal(read("banners.json").find((b) => b.id === "custom").active, true);
    assert.equal(read("news.json").filter((n) => n.slug === NEWS_SLUG).length, 1);
    assert.ok(fs.existsSync(path.join(dir, "backups/subwoofer-arrivals-2026-09-16/products.json")));
    products.find((p) => Object.hasOwn(ARRIVALS, p.slug)).stock = 12;
    write("products.json", products);
    assert.equal(updateSubwooferArrivals(dir, path.resolve("data")), false);
    assert.equal(read("products.json").find((p) => Object.hasOwn(ARRIVALS, p.slug)).stock, 12);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
