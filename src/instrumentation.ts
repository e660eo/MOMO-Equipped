/*
  Точка, которую Next вызывает один раз при старте сервера.

  Держим в самом процессе фоновые задачи, чтобы владельцу не заводить
  системный крон вручную:
    • ежедневный бэкап данных (lib/backup-scheduler.ts);
    • сторож само-диагностики — письмо владельцу, если сайт тихо сломался
      (lib/health-watch.ts).
  Плюс одноразовая миграция названий каталога (lib/title-cleanup.ts): данные
  живут вне репозитория, поэтому чистим их на сервере, где они лежат.
*/
export async function register() {
  // Только на боевом сервере и только в Node-рантайме: в разработке
  // архивировать нечего, а в edge-рантайме нет ни child_process, ни fs.
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Чистка названий каталога. Самоограничивается (пишет, только пока есть что
  // чистить) и никогда не роняет старт — обёрнута в try/catch.
  try {
    const { cleanupProductTitles } = await import("./lib/title-cleanup");
    const { changed } = cleanupProductTitles();
    if (changed) console.log(`[title-cleanup] очищено названий: ${changed}`);
  } catch (err) {
    console.error("[title-cleanup] пропущено:", err);
  }

  /*
    Миграцию photo-updates здесь больше не запускаем. Она уже перенесена в
    data/products.json, а повторный запуск делал её постоянной синхронизацией:
    после перезапуска сервера он возвращал старую галерею и стирал привязку
    фотографий, которые администратор добавил через панель.
  */

  // SKU Ozon нужны для передачи оплаченных товаров в Ozon Логистику.
  // Меняем только поля интеграции, оставляя живые данные каталога нетронутыми.
  try {
    const { syncOzonProductMappings } = await import("./lib/ozon-product-map");
    const { changed, mappings } = syncOzonProductMappings();
    if (changed) {
      console.log(`[ozon-product-map] обновлено товаров: ${changed}/${mappings}`);
    }
  } catch (err) {
    console.error("[ozon-product-map] пропущено:", err);
  }

  const { scheduleDailyBackup } = await import("./lib/backup-scheduler");
  scheduleDailyBackup();

  const { scheduleHealthWatch } = await import("./lib/health-watch");
  scheduleHealthWatch();

  const { scheduleIntegrationQueue } = await import("./lib/job-queue");
  scheduleIntegrationQueue();

  const { scheduleAdminNotifications } = await import("./lib/notification-watch");
  scheduleAdminNotifications();
}
