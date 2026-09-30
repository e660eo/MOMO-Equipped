import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

export const UPDATE_ID = "retail-prices-from-2026-09-29-v1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function updateRetailPrices(dataDir, source) {
  const entries = source.products;
  if (!Array.isArray(entries) || !entries.length || new Set(entries.map((p) => p.slug)).size !== entries.length ||
      entries.some((p) => typeof p.slug !== "string" || !p.slug || !Number.isFinite(p.price) || p.price <= 0 || Math.abs(p.price * 100 - Math.round(p.price * 100)) > 0.00001)) {
    throw new Error("Некорректные или повторяющиеся РРЦ в обновлении.");
  }
  // Same mutex as store.ts: a checkout or manager's stock edit cannot be lost
  // while the deployment updates prices in the shared live catalogue.
  const lock = path.join(dataDir, "store-transaction.json.lock");
  const started = Date.now();
  while (true) {
    try { fs.mkdirSync(lock, { mode: 0o700 }); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() - started > 2_000) throw new Error("Каталог занят. Повторите обновление цен.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    const marker = path.join(dataDir, `.catalog-update-${UPDATE_ID}`);
    if (fs.existsSync(marker)) return { applied: false, changed: 0, missing: [] };
    // Let the application's transaction recovery finish before any migration.
    if (fs.existsSync(path.join(dataDir, "store-transaction.pending.json"))) {
      throw new Error("Незавершённая операция каталога. Откройте сайт и повторите обновление цен.");
    }
    const file = path.join(dataDir, "products.json");
    const products = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(products) || new Set(products.map((p) => p.slug)).size !== products.length) throw new Error("Некорректный каталог товаров.");
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    let changed = 0;
    const missing = [];
    for (const entry of entries) {
      const product = bySlug.get(entry.slug);
      // Never resurrect deleted products or replace their other live fields.
      if (!product) { missing.push(entry.slug); continue; }
      if (product.price !== entry.price) { product.price = entry.price; changed++; }
    }
    const backupDir = path.join(dataDir, "backups", UPDATE_ID);
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backup = path.join(backupDir, "products.json");
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    if (changed) {
      const temporary = `${file}.${UPDATE_ID}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(products, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporary, file);
    }
    const report = { applied: true, changed, missing, source: source.source, updatedAt: new Date().toISOString() };
    fs.writeFileSync(marker, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    return report;
  } finally { fs.rmdirSync(lock); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  nextEnv.loadEnvConfig(root);
  const dataDir = process.env.MOMO_DATA_DIR?.trim() || path.join(root, "data");
  const source = JSON.parse(fs.readFileSync(path.join(root, "scripts", "retail-prices-2026-09-29.json"), "utf8"));
  console.log(JSON.stringify(updateRetailPrices(dataDir, source)));
}
