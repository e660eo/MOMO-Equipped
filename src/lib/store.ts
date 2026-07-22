import fs from "node:fs";
import path from "node:path";

/*
  Хранилище данных сайта.

  Файлы каталога лежат ВНЕ репозитория: `scripts/deploy.sh` начинается с
  `git pull --ff-only`, поэтому правки из админки внутри `data/` конфликтовали
  бы с автовыкатом и терялись. Путь задаётся переменной MOMO_DATA_DIR;
  локально по умолчанию — папка `data/` репозитория, чтобы разработка
  и сиды выглядели как раньше.

  Пустая папка данных засеивается копией из репозитория при первом чтении —
  на сервере достаточно создать каталог и указать путь.

  Сборщик предупреждает про «unexpected file in NFT list»: чтение с диска в
  рантайме мешает ему точно вычислить список нужных файлов. Для нашего
  запуска (обычный `next start` рядом с исходниками) это безразлично —
  трассировка нужна только сборкам standalone, которых у нас нет.
*/

const SEED_DIR = path.join(process.cwd(), "data");

/** Папка с данными: прод — MOMO_DATA_DIR, разработка — data/ репозитория. */
export function dataDir(): string {
  return process.env.MOMO_DATA_DIR?.trim() || SEED_DIR;
}

/** Папка, куда админка кладёт загруженные фото. */
export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

/**
 * Исходные снимки каталога, приехавшие вместе с кодом. Роут /media смотрит
 * сюда, если файла нет среди загруженных, — так работают все нынешние
 * карточки, не заводя копию папки на сервере.
 */
export function seedUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

/** Пишем ли мы в саму папку репозитория (локальная разработка). */
export function isRepoData(): boolean {
  return path.resolve(dataDir()) === path.resolve(SEED_DIR);
}

/*
  Кэш прочитанных файлов. Живёт в процессе: писатель у данных ровно один
  (тот же процесс Next под PM2), поэтому сброс при записи достаточен.
  Если приложение когда-нибудь поднимут в несколько процессов, сюда
  понадобится общий механизм инвалидации.
*/
const cache = new Map<string, unknown>();

let seeded = false;

/**
 * Засев папки данных из репозитория: копируем только то, чего ещё нет,
 * поэтому повторный вызов ничего не портит и не перетирает правки.
 */
function ensureSeeded(): void {
  if (seeded || isRepoData()) {
    seeded = true;
    return;
  }
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });

  for (const file of fs.readdirSync(SEED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) {
      fs.copyFileSync(path.join(SEED_DIR, file), target);
    }
  }

  // Исходные снимки каталога остаются в public/uploads репозитория — их
  // отдаёт тот же роут /media запасным путём (см. seedUploadsDir). Копировать
  // 6,5 МБ в папку данных незачем: они не меняются.
  seeded = true;
}

/** Читает JSON-коллекцию из папки данных. Результат кэшируется. */
export function readJson<T>(file: string): T {
  const cached = cache.get(file);
  if (cached !== undefined) return cached as T;

  ensureSeeded();
  const full = path.join(dataDir(), file);
  const raw = fs.readFileSync(full, "utf8");
  const parsed = JSON.parse(raw) as T;
  cache.set(file, parsed);
  return parsed;
}

/**
 * Атомарная запись: сначала временный файл, потом rename — читатель никогда
 * не увидит половину файла. Предыдущая версия сохраняется в backups/,
 * чтобы ошибочную правку цены можно было откатить.
 */
export function writeJson(file: string, data: unknown): void {
  ensureSeeded();
  const dir = dataDir();
  const full = path.join(dir, file);

  if (fs.existsSync(full)) {
    const backups = path.join(dir, "backups");
    fs.mkdirSync(backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(full, path.join(backups, `${file}.${stamp}`));
    pruneBackups(backups, file);
  }

  const tmp = `${full}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, full);
  cache.delete(file);
}

/** Держим последние 20 копий каждого файла — этого хватает для отката. */
function pruneBackups(dir: string, file: string): void {
  const mine = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${file}.`))
    .sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - 20))) {
    fs.rmSync(path.join(dir, old), { force: true });
  }
}

/**
 * Проверка перед записью. В проде без MOMO_DATA_DIR правки ушли бы в файлы
 * репозитория и погибли на ближайшем `git pull --ff-only` — лучше честно
 * отказаться и объяснить, чем молча потерять работу владельца магазина.
 */
export function assertWritable(): void {
  if (process.env.NODE_ENV === "production" && isRepoData()) {
    throw new Error(
      "Не задана переменная MOMO_DATA_DIR — сохранять правки некуда: " +
        "файлы репозитория перезаписываются при каждом обновлении сайта. " +
        "Смотрите раздел «Папка данных» в DEPLOY.md.",
    );
  }
}
