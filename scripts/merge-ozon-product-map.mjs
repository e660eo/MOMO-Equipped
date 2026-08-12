#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
  Одноразово переносит проверенные SKU Ozon из каталога репозитория в живой
  каталог MOMO_DATA_DIR. Остатки, цены, названия, фото и админские правки не
  заменяются. Перед записью рядом создаётся резервная копия.
*/

const targetArg = process.argv[2];
if (!targetArg) {
  console.error("Usage: node scripts/merge-ozon-product-map.mjs /path/to/products.json");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceFile = path.join(repoRoot, "data", "products.json");
const targetFile = path.resolve(targetArg);
if (!fs.existsSync(targetFile)) {
  console.error(`Target not found: ${targetFile}`);
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const target = JSON.parse(fs.readFileSync(targetFile, "utf8"));
if (!Array.isArray(source) || !Array.isArray(target)) {
  console.error("Both product files must contain JSON arrays.");
  process.exit(1);
}

const mappings = new Map(
  source
    .filter((product) => product?.slug && Number.isSafeInteger(product.ozonSku))
    .map((product) => [
      product.slug,
      {
        ozonSku: product.ozonSku,
        ...(product.ozonOfferId ? { ozonOfferId: product.ozonOfferId } : {}),
      },
    ]),
);

let changed = 0;
const merged = target.map((product) => {
  const mapping = mappings.get(product?.slug);
  if (!mapping) return product;
  if (
    product.ozonSku === mapping.ozonSku &&
    product.ozonOfferId === mapping.ozonOfferId
  ) {
    return product;
  }
  changed += 1;
  return { ...product, ...mapping };
});

if (changed === 0) {
  console.log(`Ozon mappings: ${mappings.size}; live catalog already up to date.`);
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `${targetFile}.before-ozon-map-${stamp}`;
const temp = `${targetFile}.ozon-map.tmp`;
fs.copyFileSync(targetFile, backup);
fs.writeFileSync(temp, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
fs.renameSync(temp, targetFile);

console.log(
  `Ozon mappings: ${mappings.size}; updated live products: ${changed}; backup: ${backup}`,
);
