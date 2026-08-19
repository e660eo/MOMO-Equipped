export const CITY_STORAGE_KEY = "momo-city";
export const CITY_CENTER_STORAGE_KEY = "momo-city-center";
export const CITY_CHANGE_EVENT = "momo:city-change";

export interface CityCenter {
  city: string;
  lat: number;
  long: number;
}

export interface RussianCityOption extends CityCenter {
  region: string;
}

export const POPULAR_RUSSIAN_CITIES: CityCenter[] = [
  { city: "Махачкала", lat: 42.9849, long: 47.5047 },
  { city: "Москва", lat: 55.7558, long: 37.6176 },
  { city: "Санкт-Петербург", lat: 59.9343, long: 30.3351 },
  { city: "Краснодар", lat: 45.0355, long: 38.9753 },
  { city: "Ростов-на-Дону", lat: 47.2357, long: 39.7015 },
  { city: "Казань", lat: 55.7961, long: 49.1064 },
  { city: "Екатеринбург", lat: 56.8389, long: 60.6057 },
  { city: "Новосибирск", lat: 55.0084, long: 82.9357 },
];

export function parseStoredCityCenter(
  value: string | null,
  selectedCity: string | null,
): CityCenter | null {
  if (!value || !selectedCity) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CityCenter>;
    if (
      parsed.city !== selectedCity ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.long)
    ) {
      return null;
    }
    return { city: parsed.city, lat: parsed.lat!, long: parsed.long! };
  } catch {
    return null;
  }
}

export function popularCityCenter(city: string | null): CityCenter | null {
  if (!city) return null;
  return POPULAR_RUSSIAN_CITIES.find((item) => item.city === city) ?? null;
}

function normalizeCitySearch(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е");
}

export function findRussianCities(
  cities: RussianCityOption[],
  query: string,
  limit = 40,
): RussianCityOption[] {
  const needle = normalizeCitySearch(query);
  if (needle.length < 2) return [];

  return cities
    .filter((item) => normalizeCitySearch(item.city).includes(needle))
    .sort((a, b) => {
      const aName = normalizeCitySearch(a.city);
      const bName = normalizeCitySearch(b.city);
      const aRank = aName === needle ? 0 : aName.startsWith(needle) ? 1 : 2;
      const bRank = bName === needle ? 0 : bName.startsWith(needle) ? 1 : 2;
      return (
        aRank - bRank ||
        a.city.localeCompare(b.city, "ru") ||
        a.region.localeCompare(b.region, "ru")
      );
    })
    .slice(0, Math.max(1, limit));
}
