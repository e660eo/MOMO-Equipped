/*
  Скачивает фото товаров со старого сайта в public/uploads/.

  Зачем: сейчас каталог тянет 145 фото с https://momo-eq.ru/uploads/…
  В момент, когда домен momo-eq.ru переключится на новый сайт, старый исчезнет
  вместе с фотографиями — и каталог останется с плейсхолдерами.
  Поэтому фото нужно забрать К СЕБЕ до переключения DNS.

  Запуск (из корня проекта):
      node scripts/download-photos.mjs

  После успешной загрузки поменяйте в data/site.json:
      "imageBase": "/uploads/"
*/

import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "uploads");
const CONCURRENCY = 8;

const products = JSON.parse(await readFile(join(ROOT, "data", "products.json"), "utf8"));
const site = JSON.parse(await readFile(join(ROOT, "data", "site.json"), "utf8"));

// imageBase может быть уже локальным — тогда берём исходный адрес явно
const REMOTE_BASE = site.imageBase.startsWith("http")
  ? site.imageBase
  : "https://momo-eq.ru/uploads/";

const images = [...new Set(products.map((p) => p.image))].filter(Boolean);
await mkdir(OUT_DIR, { recursive: true });

console.log(`Фото к загрузке: ${images.length}`);
console.log(`Источник: ${REMOTE_BASE}`);
console.log(`Назначение: ${OUT_DIR}\n`);

let done = 0, skipped = 0;
const failed = [];

async function fetchOne(name) {
  const dest = join(OUT_DIR, name);
  try {
    await access(dest);
    skipped++;
    return; // уже скачано — не трогаем
  } catch {}

  try {
    const res = await fetch(REMOTE_BASE + name, {
      headers: { "User-Agent": "Mozilla/5.0 (MOMO site migration)" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) throw new Error(`подозрительно мал (${buf.length} Б)`);
    await writeFile(dest, buf);
    done++;
  } catch (e) {
    failed.push({ name, reason: e.message });
  }
  const total = done + skipped + failed.length;
  if (total % 10 === 0 || total === images.length) {
    process.stdout.write(`\r  обработано ${total}/${images.length}…`);
  }
}

// простой пул параллельных загрузок
const queue = [...images];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await fetchOne(queue.pop());
  }),
);

console.log(`\n\nСкачано: ${done} | уже было: ${skipped} | ошибок: ${failed.length}`);
if (failed.length) {
  console.log("\nНе удалось загрузить:");
  failed.slice(0, 20).forEach((f) => console.log(`  ${f.name} — ${f.reason}`));
  if (failed.length > 20) console.log(`  …и ещё ${failed.length - 20}`);
  console.log("\nПовторный запуск догрузит только недостающие.");
} else {
  console.log("\nВсё на месте. Теперь поменяйте в data/site.json:");
  console.log('    "imageBase": "/uploads/"');
  console.log("и перезапустите dev-сервер.");
}
