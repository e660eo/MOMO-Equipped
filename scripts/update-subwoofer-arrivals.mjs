import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

export const ARRIVALS = {
  "sabvufer-avtomobilnyy-b-12-750-12-dyuymov-986648": 1000,
  "sabvufer-avtomobilnyy-ub-12-350-12-dyuymov-041105": 1200,
};
export const NEWS_SLUG = "postuplenie-b-12-750-ub-12-350";
const ACHILLES = "sabvufer-avtomobilnyy-achilles-12-dyuymov-902295";
const UPDATE_ID = "subwoofer-arrivals-2026-09-16";

// Одноразовое обновление. Повторный deploy не восстанавливает проданные
// остатки и не перезаписывает последующие правки менеджера.
export function updateSubwooferArrivals(dataDir, seedDir) {
  const marker = path.join(dataDir, `.catalog-update-${UPDATE_ID}`);
  if (fs.existsSync(marker)) return false;
  const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  const products = read(dataDir, "products.json");
  const news = read(dataDir, "news.json");
  const banners = read(dataDir, "banners.json");
  const seedNews = read(seedDir, "news.json").find((item) => item.slug === NEWS_SLUG);
  const seedBanner = read(seedDir, "banners.json").find((item) => item.id === UPDATE_ID);
  if (!seedNews || !seedBanner) throw new Error("Отсутствует новость или баннер поступления");
  for (const slug of Object.keys(ARRIVALS)) {
    if (!products.some((product) => product.slug === slug)) {
      throw new Error(`В рабочем каталоге отсутствует ${slug}`);
    }
  }
  const arrivals = products.filter((product) => Object.hasOwn(ARRIVALS, product.slug));
  for (const product of arrivals) {
    product.stock = ARRIVALS[product.slug];
    product.inStock = true;
    product.hidden = false;
    product.isNew = true;
  }
  const achilles = products.find((product) => product.slug === ACHILLES);
  if (achilles) {
    achilles.stock = 0;
    achilles.inStock = false;
    achilles.hidden = true;
    achilles.isNew = false;
  }
  for (const banner of banners) {
    if (banner.id === "momo-achilles-12" || banner.action?.href === `/product/${ACHILLES}`) {
      banner.active = false;
    }
  }
  if (!banners.some((banner) => banner.id === UPDATE_ID)) {
    banners.push({ ...seedBanner, media: arrivals.find((p) => p.slug.includes("b-12-750"))?.image ?? seedBanner.media });
  }
  if (!news.some((item) => item.slug === NEWS_SLUG)) news.unshift(seedNews);

  const backups = path.join(dataDir, "backups", UPDATE_ID);
  fs.mkdirSync(backups, { recursive: true });
  const write = (name, value) => {
    const file = path.join(dataDir, name);
    const backup = path.join(backups, name);
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    const temporary = `${file}.${UPDATE_ID}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temporary, file);
  };
  write("products.json", [...products.filter((p) => !Object.hasOwn(ARRIVALS, p.slug)), ...arrivals]);
  write("banners.json", banners);
  write("news.json", news.sort((a, b) => b.date.localeCompare(a.date)));
  fs.writeFileSync(marker, `${new Date().toISOString()}\n`);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  nextEnv.loadEnvConfig(root);
  const dataDir = process.env.MOMO_DATA_DIR?.trim() || path.join(root, "data");
  console.log(updateSubwooferArrivals(dataDir, path.join(root, "data"))
    ? "Поступление B-12.750 и UB-12.350 опубликовано."
    : "Поступление уже применено; текущие остатки сохранены.");
}
