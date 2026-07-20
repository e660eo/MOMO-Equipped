/*
  Форматирование российского номера: +7 999 123-45-67.

  Пользователи вводят номер как попало — с 8, с +7, со скобками и пробелами.
  Приводим всё к одному виду: оставляем только цифры, отбрасываем ведущую
  8 или 7 (префикс +7 подставляем сами) и расставляем разделители.
*/

/** Только значащие цифры номера — без кода страны. Максимум 10. */
export function phoneDigits(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("8")) d = d.slice(1);
  else if (d.startsWith("7")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Показываемое значение поля: +7 999 123-45-67 */
export function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (!d) return "";
  let out = "+7";
  if (d.length > 0) out += ` ${d.slice(0, 3)}`;
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

/** Номер введён полностью (10 цифр). */
export function isPhoneComplete(value: string): boolean {
  return phoneDigits(value).length === 10;
}

/** Канонический вид для ссылок tel: и отправки в WhatsApp. */
export function phoneE164(value: string): string {
  const d = phoneDigits(value);
  return d.length === 10 ? `+7${d}` : "";
}
