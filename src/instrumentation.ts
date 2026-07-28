/*
  Точка, которую Next вызывает один раз при старте сервера.

  Держим в самом процессе две фоновые задачи, чтобы владельцу не заводить
  системный крон вручную:
    • ежедневный бэкап данных (lib/backup-scheduler.ts);
    • сторож само-диагностики — письмо владельцу, если сайт тихо сломался
      (lib/health-watch.ts).
*/
export async function register() {
  // Только на боевом сервере и только в Node-рантайме: в разработке
  // архивировать нечего, а в edge-рантайме нет ни child_process, ни fs.
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { scheduleDailyBackup } = await import("./lib/backup-scheduler");
  scheduleDailyBackup();

  const { scheduleHealthWatch } = await import("./lib/health-watch");
  scheduleHealthWatch();
}
