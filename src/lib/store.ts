import fs from "node:fs";
import path from "node:path";
import { ExpectedError } from "./errors";
import { SEED_DIR, dataDir, isRepoData } from "./store-paths";
import { withDataFileLock } from "./data-file-lock";

export { dataDir, uploadsDir, seedUploadsDir, isRepoData } from "./store-paths";

/*
  Хранилище данных сайта.

  Файлы каталога лежат ВНЕ репозитория: `scripts/deploy.sh` начинается с
  `git pull --ff-only`, поэтому правки из админки внутри `data/` конфликтовали
  бы с автовыкатом и терялись. Путь задаётся переменной MOMO_DATA_DIR;
  локально по умолчанию — папка `data/` репозитория, чтобы разработка
  и сиды выглядели как раньше.

  Пустая папка данных засеивается копией из репозитория при первом чтении —
  на сервере достаточно создать каталог и указать путь.

  Вычисление путей вынесено в store-paths.ts. Роут /media импортирует только
  этот лёгкий модуль и не затягивает весь файловый store в NFT trace.
*/

/*
  Next собирает страницы и server actions в разные экземпляры модуля,
  даже внутри одного процесса. Сброс локального Map при записи не очищает
  кэш страницы. Поэтому перед чтением проверяем версию файла на диске.
  inode и время изменения метаданных учитывают и атомарную замену файла.
*/
const cache = new Map<string, { version: string; value: unknown }>();
let lockedDirectory: string | undefined;
let transaction: Map<string, unknown> | undefined;
const JOURNAL = "store-transaction.pending.json";

function recoverTransaction(): void {
  const file = path.join(dataDir(), JOURNAL);
  if (!fs.existsSync(file)) return;
  const entries: Array<[string, unknown]> = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(entries) || entries.some((entry) => !Array.isArray(entry) || entry.length !== 2 || !/^[a-z0-9][a-z0-9._-]*\.json$/i.test(entry[0]) || entry[0] === JOURNAL)) throw new Error("Invalid store transaction journal");
  for (const [name, value] of entries) writeJsonFile(name, value);
  fs.unlinkSync(file);
}

function withStoreLock<T>(operation: () => T): T {
  const directory = path.resolve(dataDir());
  if (lockedDirectory === directory) return operation();
  return withDataFileLock("store-transaction.json", () => {
    lockedDirectory = directory;
    try { recoverTransaction(); return operation(); }
    finally { lockedDirectory = undefined; }
  });
}

/** Synchronous multi-file commit. A durable journal completes interrupted commits on the next read/write. */
export function withStoreTransaction<T>(operation: () => T): T {
  assertWritable();
  ensureSeeded();
  return withStoreLock(() => {
    if (transaction) return operation();
    transaction = new Map();
    let result: T;
    let entries: Array<[string, unknown]>;
    try { result = operation(); entries = [...transaction]; }
    finally { transaction = undefined; }
    if (!entries.length) return result;
    const journal = path.join(dataDir(), JOURNAL);
    const temporary = `${journal}.tmp`;
    const descriptor = fs.openSync(temporary, "w", PRIVATE_FILE_MODE);
    try { fs.writeFileSync(descriptor, JSON.stringify(entries), "utf8"); fs.fsyncSync(descriptor); }
    finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, journal);
    recoverTransaction();
    return result;
  });
}

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

function makePrivate(target: string, mode: number): void {
  if (process.platform === "win32") return;
  try {
    fs.chmodSync(target, mode);
  } catch (error) {
    console.error(`Не удалось ограничить права ${target}:`, error);
  }
}

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
  makePrivate(dir, PRIVATE_DIR_MODE);
  makePrivate(path.join(dir, "uploads"), PRIVATE_DIR_MODE);

  for (const file of fs.readdirSync(SEED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) {
      fs.copyFileSync(path.join(SEED_DIR, file), target);
      makePrivate(target, PRIVATE_FILE_MODE);
    }
  }

  // Исходные снимки каталога остаются в public/uploads репозитория — их
  // отдаёт тот же роут /media запасным путём (см. seedUploadsDir). Копировать
  // 6,5 МБ в папку данных незачем: они не меняются.
  seeded = true;
}

/** Читает JSON-коллекцию из папки данных. Результат кэшируется. */
export function readJson<T>(file: string): T {
  ensureSeeded();
  if (!lockedDirectory && fs.existsSync(path.join(dataDir(), JOURNAL))) withStoreLock(() => undefined);
  if (transaction?.has(file)) return structuredClone(transaction.get(file)) as T;
  const full = path.resolve(dataDir(), file);
  const stat = fs.statSync(full, { bigint: true });
  const version = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  const cached = cache.get(full);
  if (cached?.version === version) return (transaction ? structuredClone(cached.value) : cached.value) as T;

  const raw = fs.readFileSync(full, "utf8");
  const parsed = JSON.parse(raw) as T;
  cache.set(full, { version, value: parsed });
  return transaction ? structuredClone(parsed) : parsed;
}

/**
 * Атомарная запись: сначала временный файл, потом rename — читатель никогда
 * не увидит половину файла. Предыдущая версия сохраняется в backups/,
 * чтобы ошибочную правку цены можно было откатить.
 */
export function writeJson(file: string, data: unknown): void {
  ensureSeeded();
  if (transaction) { transaction.set(file, structuredClone(data)); return; }
  withStoreLock(() => writeJsonFile(file, data));
}

function writeJsonFile(file: string, data: unknown): void {
  const dir = dataDir();
  const full = path.join(dir, file);

  if (fs.existsSync(full)) {
    const backups = path.join(dir, "backups");
    fs.mkdirSync(backups, { recursive: true });
    makePrivate(backups, PRIVATE_DIR_MODE);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(backups, `${file}.${stamp}`);
    fs.copyFileSync(full, backup);
    makePrivate(backup, PRIVATE_FILE_MODE);
    pruneBackups(backups, file);
  }

  const tmp = `${full}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: PRIVATE_FILE_MODE });
  fs.renameSync(tmp, full);
  makePrivate(full, PRIVATE_FILE_MODE);
  cache.delete(path.resolve(full));
}

/**
 * Правка файла целиком: читаем с диска (мимо кэша), меняем, пишем.
 *
 * Так и только так следует менять данные. Раньше код брал список из кэша,
 * менял и сохранял — и одновременная правка в соседнем запросе затирала
 * чужую: сброшенный пароль покупателя, например, исчезал от того, что он
 * же в этот момент вошёл на сайт и обновил отметку о входе.
 */
export function updateJson<T>(file: string, update: (current: T) => T): T {
  ensureSeeded();
  return withStoreLock(() => {
    let current: T;
    try { current = structuredClone(readJson<T>(file)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; current = [] as unknown as T; }
    const next = update(current);
    writeJson(file, next);
    return next;
  });
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
    /*
      ExpectedError — текст написан для владельца магазина и показывается
      ему в панели. Наружу, в формы покупателя, он не уходит: там этот
      отказ ловится отдельно (см. signUp) и заменяется на «напишите нам».
    */
    throw new ExpectedError(
      "Не задана переменная MOMO_DATA_DIR — сохранять правки некуда: " +
        "файлы репозитория перезаписываются при каждом обновлении сайта. " +
        "Смотрите раздел «Папка данных» в DEPLOY.md.",
    );
  }
}
