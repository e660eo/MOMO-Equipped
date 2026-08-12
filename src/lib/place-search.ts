export interface PublicPlaceResult {
  id: string;
  label: string;
  lat: number;
  long: number;
  zoom: number;
}

interface NominatimResult {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: [string, string, string, string];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; results: PublicPlaceResult[] }>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function zoomForBounds(bounds?: NominatimResult["boundingbox"]): number {
  if (!bounds) return 12;
  const [south, north, west, east] = bounds.map(Number);
  if (![south, north, west, east].every(Number.isFinite)) return 12;
  const span = Math.max(north - south, east - west);
  if (span > 12) return 4;
  if (span > 4) return 6;
  if (span > 1) return 8;
  if (span > 0.2) return 10;
  return 13;
}

async function rateLimitedFetch(url: string): Promise<Response> {
  let release = () => {};
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  try {
    const waitMs = Math.max(0, 1_050 - (Date.now() - lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    return await fetch(url, {
      headers: {
        "Accept-Language": "ru",
        Referer: "https://momo-eq.ru/cart",
        "User-Agent": "momo-eq.ru checkout map (admin@momo-eq.ru)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } finally {
    lastRequestAt = Date.now();
    release();
  }
}

/** Явный поиск пользователя, без автодополнения; результаты кэшируются. */
export async function searchRussianPlaces(query: string): Promise<PublicPlaceResult[]> {
  const clean = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (clean.length < 2) throw new Error("Введите город или адрес.");

  const cacheKey = clean.toLocaleLowerCase("ru-RU");
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const params = new URLSearchParams({
    q: clean,
    format: "jsonv2",
    countrycodes: "ru",
    layer: "address",
    addressdetails: "0",
    limit: "5",
  });
  const response = await rateLimitedFetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
  );
  if (!response.ok) throw new Error("Поиск адреса временно недоступен.");
  const body = (await response.json()) as NominatimResult[];
  const results = body
    .map((place, index) => {
      const lat = Number(place.lat);
      const long = Number(place.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(long) || !place.display_name) {
        return null;
      }
      return {
        id: String(place.place_id ?? `${lat}:${long}:${index}`),
        label: place.display_name,
        lat,
        long,
        zoom: zoomForBounds(place.boundingbox),
      };
    })
    .filter((place): place is PublicPlaceResult => place !== null);

  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value ?? "");
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, results });
  return results;
}
