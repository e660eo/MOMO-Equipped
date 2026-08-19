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

/** Разбирает пару координат из полей формы и проверяет допустимые диапазоны. */
export function parseDealerCoordinates(
  latitude: string,
  longitude: string,
): { latitude: number; longitude: number } | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const parsedLatitude = Number(latitude.replace(",", "."));
  const parsedLongitude = Number(longitude.replace(",", "."));
  if (
    !Number.isFinite(parsedLatitude) ||
    !Number.isFinite(parsedLongitude) ||
    parsedLatitude < -90 ||
    parsedLatitude > 90 ||
    parsedLongitude < -180 ||
    parsedLongitude > 180
  ) {
    return null;
  }
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}
