import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(root);

const UPDATE_ID = "new-arrivals-2026-08-13";
const TARGET_SLUGS = [
  "monoblok-bd-1500-1",
  "monoblok-avtomobilnyy-fr-500-138116",
];

const dataDir = process.env.MOMO_DATA_DIR?.trim() || path.join(root, "data");
const productsFile = path.join(dataDir, "products.json");
const newsFile = path.join(dataDir, "news.json");
const markerFile = path.join(dataDir, `.catalog-update-${UPDATE_ID}`);

if (fs.existsSync(markerFile)) {
  console.log(`  Каталог уже обновлён (${UPDATE_ID}).`);
  process.exit(0);
}

const seedFile = path.join(root, "data", "products.json");
const seedProducts = JSON.parse(fs.readFileSync(seedFile, "utf8"));
const seedNews = JSON.parse(
  fs.readFileSync(path.join(root, "data", "news.json"), "utf8"),
);
const targets = TARGET_SLUGS.map((slug) =>
  seedProducts.find((product) => product.slug === slug),
);

if (targets.some((product) => !product)) {
  throw new Error("В seed-каталоге не найдены товары новой поставки.");
}

fs.mkdirSync(dataDir, { recursive: true });
const products = fs.existsSync(productsFile)
  ? JSON.parse(fs.readFileSync(productsFile, "utf8"))
  : seedProducts;

for (const target of targets) {
  const index = products.findIndex(
    (product) =>
      product.slug === target.slug ||
      product.title.trim().toLowerCase() === target.title.trim().toLowerCase(),
  );

  if (index === -1) {
    products.unshift(target);
    continue;
  }

  // Не теряем живой остаток и поля интеграций, которых нет в seed-товаре.
  // При совпадении по названию сохраняем уже опубликованный URL.
  const existing = products[index];
  products[index] = {
    ...existing,
    ...target,
    slug: existing.slug,
  };
}

const news = fs.existsSync(newsFile)
  ? JSON.parse(fs.readFileSync(newsFile, "utf8"))
  : seedNews;
const targetNews = seedNews.find((item) => item.slug === "novinki-momo-2026");
if (!targetNews) throw new Error("В seed-данных не найдена страница новинок.");

const newsIndex = news.findIndex((item) => item.slug === targetNews.slug);
if (newsIndex === -1) news.unshift(targetNews);
else news[newsIndex] = { ...news[newsIndex], ...targetNews };

function backupAndWrite(file, name, data) {
  if (fs.existsSync(file)) {
    const backups = path.join(dataDir, "backups");
    fs.mkdirSync(backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(file, path.join(backups, `${name}.${stamp}`));
  }

  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

backupAndWrite(productsFile, "products.json", products);
backupAndWrite(newsFile, "news.json", news);

/*
  Маркер пишем последним: если процесс оборвётся между двумя файлами,
  следующий запуск безопасно повторит миграцию и доведёт её до конца.
*/
if (!fs.existsSync(markerFile)) {
  fs.writeFileSync(markerFile, `${new Date().toISOString()}\n`, "utf8");
}

console.log(`  Добавлены/обновлены товары: ${TARGET_SLUGS.join(", ")}.`);
