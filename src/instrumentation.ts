/*
  Точка, которую Next вызывает один раз при старте сервера.

  Используем её для ежедневного бэкапа данных: планировщик живёт в самом
  процессе, чтобы владельцу не заводить системный крон вручную (см.
  lib/backup-scheduler.ts).
*/
export async function register() {
  // Только на боевом сервере и только в Node-рантайме: в разработке
  // архивировать нечего, а в edge-рантайме нет ни child_process, ни fs.
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { scheduleDailyBackup } = await import("./lib/backup-scheduler");
  scheduleDailyBackup();
}
