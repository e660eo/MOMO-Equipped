import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

export const SLUG = "sabvufer-avtomobilnyy-ub-10-250-10-dyuymov-328303";
// Источник: карточки UB-10.250, предоставленные владельцем 24.09.2026.
// Комплектность отдельно подтверждена владельцем: один сабвуфер.
// MAX 500 Вт уже подтверждена существующим профилем товара.
export const SPECS = [
  "Тип - Сабвуфер",
  "Диаметр - 10″",
  "Номинальная мощность (RMS) - 250 Вт",
  "Максимальная мощность - 500 Вт",
  "Импеданс - 2+2 Ом",
  "Конфигурация катушек - Две катушки по 2 Ом",
  "Звуковая катушка - 2″",
  "Материал катушки - Чёрный алюминий",
  "Чувствительность - 88 дБ",
  "Резонансная частота (Fs) - 42,48 Гц",
  "Внешний диаметр - 260 мм",
  "Установочная глубина - 125 мм",
  "Размер магнита - 145 × 35 мм (ширина × высота)",
  "Подвес - Вспененный полиуретан с рёбрами жёсткости и двойной прошивкой",
];
const UPDATE_ID = "ub10250-specs-2026-09-24";
const specKey = (line) => line.split(/\s*[:—–]\s*|\s+-\s+/, 1)[0].trim().toLowerCase();

export function updateUb10250Specs(dataDir) {
  const marker = path.join(dataDir, `.catalog-update-${UPDATE_ID}`);
  if (fs.existsSync(marker)) return false;
  const file = path.join(dataDir, "products.json");
  const products = JSON.parse(fs.readFileSync(file, "utf8"));
  const product = products.find((item) => item.slug === SLUG);
  if (!product) throw new Error(`Не найден товар: ${SLUG}`);
  const replacedKeys = new Set(SPECS.map(specKey));
  replacedKeys.add("сопротивление");
  product.description = [
    ...SPECS,
    ...(product.description ?? []).filter((line) => !replacedKeys.has(specKey(line))),
  ];
  product.packageQuantity = 1;
  product.packageContents = "Один сабвуфер MOMO UB-10.250.";

  const backupDir = path.join(dataDir, "backups", UPDATE_ID);
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, "products.json");
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  const temporary = `${file}.${UPDATE_ID}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(products, null, 2)}\n`);
  fs.renameSync(temporary, file);
  fs.writeFileSync(marker, `${new Date().toISOString()}\n`);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  nextEnv.loadEnvConfig(root);
  const dataDir = process.env.MOMO_DATA_DIR?.trim() || path.join(root, "data");
  console.log(updateUb10250Specs(dataDir) ? "Характеристики UB-10.250 обновлены." : "Характеристики UB-10.250 уже обновлены.");
}
