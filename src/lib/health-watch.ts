import { runHealthChecks } from "./health";
import { notifyHealthProblem, notifyHealthRecovered } from "./health-mail";

/*
  Сторож само-диагностики: раз в час прогоняет проверки (health.ts) и, если
  всё плохо (уровень fail — некуда писать данные, кончился диск), шлёт письмо
  владельцу. Живёт в самом процессе, как и планировщик бэкапов, — отдельного
  крона заводить не надо (см. backup-scheduler.ts, instrumentation.ts).

  Это не замена внешнему монитору, а дополнение: письмо ловит тихую деградацию
  живого сайта, а внешний монитор — падение сервера целиком, которого сторож
  внутри процесса увидеть не может.

  Состояние держим в памяти процесса намеренно. Писать «уже отправлял» на диск
  нельзя: диск и папка данных — это ровно то, что может быть сломано. Перезапуск
  сбросит память и при живой проблеме письмо придёт заново — это приемлемо,
  повторный сигнал о реальном отказе не вреден.
*/

const HOUR = 60 * 60 * 1000;
// Повторное письмо о той же длящейся проблеме — не чаще, чем раз в 6 часов:
// чинить всё равно руками, поток одинаковых писем только притупляет внимание.
const REALERT_MS = 6 * HOUR;

let started = false;
let inFailure = false;
let lastAlertAt = 0;

async function tick(): Promise<void> {
  let report;
  try {
    report = await runHealthChecks();
  } catch (e) {
    // Сама проверка не должна ронять процесс — просто в лог.
    console.error("Health: проверка не выполнилась", e);
    return;
  }

  if (report.status === "fail") {
    const now = Date.now();
    if (!inFailure || now - lastAlertAt > REALERT_MS) {
      inFailure = true;
      lastAlertAt = now;
      await notifyHealthProblem(report);
    }
    return;
  }

  // Вернулись в норму после того, как отправляли тревогу, — сообщим «отпустило».
  if (inFailure) {
    inFailure = false;
    await notifyHealthRecovered();
  }
}

export function scheduleHealthWatch(): void {
  if (started) return;
  started = true;

  // Первая проверка — через две минуты после старта (дать серверу и почте
  // подняться), дальше раз в час.
  setTimeout(() => void tick(), 2 * 60 * 1000).unref?.();
  setInterval(() => void tick(), HOUR).unref?.();
}
