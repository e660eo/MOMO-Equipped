import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import { dataDir, isRepoData } from "./store";
import { isMailerConfigured, lastMailResult } from "./mailer";
import { plural } from "./utils";

/*
  Само-диагностика сайта.

  Задача — ловить тихие отказы: сайт отвечает и страницы рисуются, но что-то
  под ним сломано так, что владелец узнаёт об этом только на потерянном заказе.
  Папка данных перестала писаться, диск забился, автобэкап молча встал, почта
  отвалилась — снаружи всё это выглядит как рабочий сайт.

  Важное ограничение: эта проверка живёт ВНУТРИ приложения. «Весь сервер лёг»
  или «процесс не поднимается» она поймать не может — мёртвый процесс ничего
  не проверит. Для этого нужен внешний монитор, который опрашивает /api/health
  со стороны (см. DEPLOY.md, «Мониторинг доступности»). Здесь — только то, что
  видно изнутри работающего процесса.

  Уровни:
    ok    всё в порядке;
    warn  стоит посмотреть, но сайт работает и данные целы (нет свежего
          бэкапа, не подключена почта) — внешний монитор такое не будит;
    fail  сайт работает, но прямо сейчас теряет данные или вот-вот начнёт
          (некуда писать, кончился диск) — на это шлём письмо и отдаём 503.
*/

export type HealthLevel = "ok" | "warn" | "fail";

export interface HealthCheck {
  id: string;
  label: string;
  level: HealthLevel;
  detail: string;
}

export interface HealthReport {
  status: HealthLevel;
  checkedAt: string;
  checks: HealthCheck[];
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Порог «диск кончился»: ниже — записи вот-вот начнут падать. */
const DISK_FAIL = 256 * MB;
/** Порог «диск на исходе»: ещё пишем, но пора чистить. */
const DISK_WARN = GB;
/** Старше этого бэкап считаем несвежим: два суточных цикла подряд пропущены. */
const BACKUP_STALE_H = 30;

function human(bytes: number): string {
  if (bytes >= GB) {
    const gb = bytes / GB;
    return `${gb.toFixed(gb < 10 ? 1 : 0)} ГБ`;
  }
  return `${Math.round(bytes / MB)} МБ`;
}

/** «3 часа назад», «2 дня назад» — по-русски, для последнего бэкапа. */
function ago(ms: number): string {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 1) return "только что";
  if (min < 60) return `${min} ${plural(min, "минуту", "минуты", "минут")} назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${plural(h, "час", "часа", "часов")} назад`;
  const d = Math.round(h / 24);
  return `${d} ${plural(d, "день", "дня", "дней")} назад`;
}

/*
  Папка данных пишется. Самая важная проверка: если сюда нельзя писать, каждый
  новый заказ и каждая правка каталога теряются молча. В проде без MOMO_DATA_DIR
  правки ушли бы в файлы репозитория и погибли на ближайшем `git pull` — это
  тоже отказ, только отложенный.
*/
async function checkDataDir(): Promise<HealthCheck> {
  const base = { id: "data", label: "Папка данных" };
  const dir = dataDir();

  if (process.env.NODE_ENV === "production" && isRepoData()) {
    return {
      ...base,
      level: "fail",
      detail:
        "Переменная MOMO_DATA_DIR не задана — новые заказы и правки из панели " +
        "сохранять некуда, они не переживут обновление сайта.",
    };
  }

  try {
    await fs.access(dir, fsConstants.W_OK);
    return { ...base, level: "ok", detail: "Доступна для записи." };
  } catch {
    return {
      ...base,
      level: "fail",
      detail: `Папка ${dir} недоступна для записи — заказы и правки не сохранятся.`,
    };
  }
}

/*
  Свободное место. statfs есть не на всех платформах (на Windows в разработке
  может отсутствовать) — если цифры нет, честно опускаем проверку, а не
  выдумываем «ок».
*/
async function checkDisk(): Promise<HealthCheck | null> {
  const base = { id: "disk", label: "Место на диске" };
  try {
    const stat = await fs.statfs(dataDir());
    // bavail — блоки, доступные обычному пользователю (bfree включает
    // зарезервированные root, их считать нельзя: писать-то нам не под root).
    const free = stat.bsize * Number(stat.bavail);

    if (free < DISK_FAIL) {
      return {
        ...base,
        level: "fail",
        detail: `Свободно всего ${human(free)} — записи вот-вот начнут падать. Нужно освободить место.`,
      };
    }
    if (free < DISK_WARN) {
      return {
        ...base,
        level: "warn",
        detail: `Свободно ${human(free)} — на исходе, пора почистить старые бэкапы или логи.`,
      };
    }
    return { ...base, level: "ok", detail: `Свободно ${human(free)}.` };
  } catch {
    return null;
  }
}

/*
  Свежесть бэкапа. Ежедневный архив кладёт scripts/backup.sh (его дёргает
  планировщик в процессе, см. backup-scheduler.ts). Если самый свежий архив
  старше двух суток — планировщик, вероятно, встал. Это warn, не fail: данные
  целы, сайт работает, но резервной копии за сегодня нет.
*/
async function checkBackup(): Promise<HealthCheck> {
  const base = { id: "backup", label: "Резервные копии" };
  const dir = path.join(dataDir(), "backups");
  const none = {
    ...base,
    level: "warn" as const,
    detail: "Автоматических архивов ещё нет — первый появится после 3 часов ночи.",
  };

  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter(
      (f) => f.startsWith("momo-data-") && f.endsWith(".tar.gz"),
    );
  } catch (e) {
    // Папки ещё нет (первый запуск, бэкап не отрабатывал) — это «архивов нет»,
    // а не сбой; отличаем от настоящей ошибки чтения.
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return none;
    return { ...base, level: "warn", detail: "Папку с архивами прочитать не удалось." };
  }

  if (files.length === 0) return none;

  let newest = 0;
  for (const f of files) {
    try {
      const st = await fs.stat(path.join(dir, f));
      if (st.mtimeMs > newest) newest = st.mtimeMs;
    } catch {
      // Файл исчез между чтением списка и stat — пропускаем.
    }
  }
  if (newest === 0) return none;

  const ageH = (Date.now() - newest) / (60 * 60 * 1000);
  if (ageH > BACKUP_STALE_H) {
    return {
      ...base,
      level: "warn",
      detail: `Последний архив создан ${ago(newest)} — похоже, ежедневный бэкап не отработал.`,
    };
  }
  return { ...base, level: "ok", detail: `Последний архив создан ${ago(newest)}.` };
}

/*
  Почта о заказах. warn, не fail: заказ сохраняется и виден в панели без
  всякой почты. Показываем здесь для полноты картины и заодно отражаем
  последнюю неудачную отправку — то же, что красный баннер на дашборде.
*/
function checkMail(): HealthCheck {
  const base = { id: "mail", label: "Почта о заказах" };

  if (!isMailerConfigured()) {
    return {
      ...base,
      level: "warn",
      detail: "Не подключена — заказы приходят только в панель, письма не отправляются.",
    };
  }

  const last = lastMailResult();
  if (last && !last.ok) {
    return { ...base, level: "warn", detail: `Последнее письмо не ушло: ${last.error}` };
  }
  return { ...base, level: "ok", detail: "Подключена." };
}

function worst(checks: HealthCheck[]): HealthLevel {
  if (checks.some((c) => c.level === "fail")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "ok";
}

/** Прогоняет все проверки заново. */
export async function runHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheck[] = [await checkDataDir()];
  const disk = await checkDisk();
  if (disk) checks.push(disk);
  checks.push(await checkBackup());
  checks.push(checkMail());

  return {
    status: worst(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

/*
  Короткий кэш, чтобы частый опрос внешним монитором (раз в минуту — норма) не
  дёргал диск на каждый запрос и не давал флудом устроить лишнюю работу.
  Планировщик берёт свежие данные принудительно.
*/
const CACHE_MS = 30_000;
let cached: { at: number; report: HealthReport } | null = null;

export async function getHealthReport(): Promise<HealthReport> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  const report = await runHealthChecks();
  cached = { at: Date.now(), report };
  return report;
}

/** 503 при fail — на это внешний монитор поднимет тревогу; иначе 200. */
export function httpStatusForHealth(status: HealthLevel): number {
  return status === "fail" ? 503 : 200;
}
