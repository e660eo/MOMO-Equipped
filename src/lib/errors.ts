/*
  Что можно показать человеку, а что нельзя.

  Действия ловили всё подряд и возвращали в браузер `e.message`. Для
  задуманных отказов это правильно — «нет остатка», «файл не похож на фото»
  написаны для владельца магазина. Но туда же уходил текст любой поломки:
  assertWritable рассказывал про MOMO_DATA_DIR и устройство выката, ошибка
  файловой системы — полный путь на сервере. Подсказывать устройство сервера
  на форме незачем.

  Поэтому отказы, написанные для человека, наследуются от ExpectedError,
  а всё остальное заменяется общей фразой и уезжает в лог сервера.
*/
export class ExpectedError extends Error {}

/**
 * Текст для браузера. Задуманный отказ отдаём как есть, неожиданную поломку
 * пишем в лог и заменяем общей фразой.
 */
export function messageFor(e: unknown, fallback: string, where: string): string {
  if (e instanceof ExpectedError) return e.message;
  console.error(`${where}:`, e);
  return fallback;
}

/**
 * Управляющее исключение redirect() — его нельзя глотать в catch.
 *
 * Смотрим и digest, и текст: Next помечает его полем digest, но раньше в
 * проекте проверялось сообщение, и терять этот путь на смене версии не хочется.
 */
export function isRedirect(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return true;
  const message = (e as { message?: unknown }).message;
  return typeof message === "string" && message.includes("NEXT_REDIRECT");
}
