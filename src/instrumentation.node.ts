/*
  Node-only запуск фоновых задач при старте production-сервера.

  Файл намеренно отделён от instrumentation.ts: цепочка очереди уведомлений
  доходит до sharp и других модулей с Node API, которые нельзя собирать для
  Edge-рантайма.
*/
export async function registerNodeInstrumentation() {
  // Чистка названий каталога. Самоограничивается и не роняет старт.
  try {
    const { cleanupProductTitles } = await import("./lib/title-cleanup");
    const { changed } = cleanupProductTitles();
    if (changed) console.log(`[title-cleanup] очищено названий: ${changed}`);
  } catch (err) {
    console.error("[title-cleanup] пропущено:", err);
  }

  // SKU Ozon нужны для передачи оплаченных товаров в Ozon Логистику.
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
