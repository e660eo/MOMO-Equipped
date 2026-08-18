function cleanPart(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Формирует устойчивый запрос для российских адресов дилерской сети. */
export function dealerGeocodeQuery(city: string, address: string): string {
  const cleanCity = cleanPart(city);
  const cleanAddress = cleanPart(address);
  if (!cleanCity || !cleanAddress) return "";
  return `Россия, ${cleanCity}, ${cleanAddress}`;
}

/** Оставляет достаточную для карты точность без длинного хвоста дроби. */
export function formatDealerCoordinate(value: number): string {
  return Number(value.toFixed(6)).toString();
}
