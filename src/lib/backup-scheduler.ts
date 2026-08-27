import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

/*
  Ежедневный бэкап без системного крона.

  Сайт под PM2 работает непрерывно, поэтому расписание держим прямо в процессе:
  раз в час смотрим, был ли сегодня бэкап, и если после 3 ночи его ещё нет —
  запускаем scripts/backup.sh (тот же, что и для ручного/кронового запуска —
  одна проверенная логика архивирования и чистки).

  Почему так, а не крон: владельцу не нужно ничего делать на сервере, а сбой
  планировщика в худшем случае оставит без бэкапа — но не тронет автовыкат,
  который живёт в системном кроне. Лезть в тот крон вслепую опаснее.

  Запускается один раз при старте сервера из instrumentation.ts и только в
  проде — в разработке архивировать нечего.
*/

const DATA_DIR =
  process.env.MOMO_DATA_DIR?.trim() || path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_HOUR = 3; // не раньше 3 ночи по времени сервера (Москва)

/** Дата в местном поясе, как её пишет backup.sh (`date +%F`). */
function localDate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function backupExistsToday(): boolean {
  try {
    const prefix = `momo-data-${localDate()}`;
    return readdirSync(BACKUP_DIR).some((f) => f.startsWith(prefix));
  } catch {
    // Папки ещё нет — значит бэкапа сегодня точно не было.
    return false;
  }
}

function runBackup(): void {
  const child = spawn("bash", ["scripts/backup.sh"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
  });
  child.on("error", (e) => console.error("Бэкап: не запустился —", e));
}

let started = false;

export function scheduleDailyBackup(): void {
  if (started) return;
  started = true;

  // Боевой сервер работает на Linux. Локальная production-сборка под Windows
  // не имеет bash и раньше каждую минуту печатала spawn bash ENOENT.
  if (process.platform === "win32") {
    console.warn("Бэкап: планировщик пропущен — scripts/backup.sh рассчитан на Linux.");
    return;
  }

  const check = () => {
    if (new Date().getHours() >= BACKUP_HOUR && !backupExistsToday()) {
      runBackup();
    }
  };

  // Первую проверку — через минуту после старта (дать серверу подняться),
  // дальше раз в час. Готовый за сегодня бэкап check пропустит.
  setTimeout(check, 60_000).unref?.();
  setInterval(check, 60 * 60 * 1000).unref?.();
}
