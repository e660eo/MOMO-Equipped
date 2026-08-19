"use client";

export interface YandexMapEvent {
  get(name: string): unknown;
}

export interface YandexEventManager {
  add(type: string, handler: (event: YandexMapEvent) => void): void;
  remove(type: string, handler: (event: YandexMapEvent) => void): void;
}

export interface YandexPlacemark {
  events: YandexEventManager;
  geometry: {
    getCoordinates(): [number, number];
    setCoordinates(coordinates: [number, number]): void;
  };
  balloon?: {
    open(): void;
    close(): void;
  };
}

export interface YandexGeocodeResult {
  geoObjects: {
    get(index: number): YandexGeoObject | null;
    getLength(): number;
  };
}

export interface YandexGeoObject {
  geometry: {
    getCoordinates(): [number, number];
  };
  properties: {
    get(name: string): unknown;
  };
  getAddressLine?(): string;
}

export interface YandexMap {
  events: YandexEventManager;
  geoObjects: {
    add(object: YandexPlacemark): void;
    removeAll(): void;
  };
  getBounds(): [[number, number], [number, number]] | null;
  getCenter(): [number, number];
  getZoom(): number;
  setBounds(
    bounds: [[number, number], [number, number]],
    options?: Record<string, unknown>,
  ): void;
  setCenter(
    center: [number, number],
    zoom?: number,
    options?: Record<string, unknown>,
  ): void;
  destroy(): void;
}

export interface YandexMapsApi {
  ready(handler: () => void): void;
  geocode(
    request: string,
    options?: Record<string, unknown>,
  ): PromiseLike<YandexGeocodeResult>;
  Map: new (
    container: HTMLElement,
    state: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YandexMap;
  Placemark: new (
    geometry: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YandexPlacemark;
  templateLayoutFactory: {
    createClass(template: string): unknown;
  };
}

export interface YandexGeocodedAddress {
  latitude: number;
  longitude: number;
  address: string;
}

declare global {
  interface Window {
    ymaps?: YandexMapsApi;
    __momoYandexMapsPromise?: Promise<YandexMapsApi>;
    __momoYandexMapsKey?: string;
  }
}

const SCRIPT_ID = "momo-yandex-maps-api";

/** Загружает один общий экземпляр API для карт доставки и дилерской сети. */
export function loadYandexMaps(apiKey: string): Promise<YandexMapsApi> {
  if (!apiKey) {
    return Promise.reject(new Error("Для карты не настроен ключ Яндекс Карт."));
  }
  if (
    window.__momoYandexMapsPromise &&
    window.__momoYandexMapsKey === apiKey
  ) {
    return window.__momoYandexMapsPromise;
  }

  window.__momoYandexMapsKey = apiKey;
  window.__momoYandexMapsPromise = new Promise<YandexMapsApi>((resolve, reject) => {
    const ready = () => {
      if (!window.ymaps) {
        reject(new Error("Яндекс Карты не загрузились."));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };

    if (window.ymaps) {
      ready();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Не удалось загрузить Яндекс Карты.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1.79/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&load=package.full&csp=true`;
    script.addEventListener("load", ready, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Не удалось загрузить Яндекс Карты.")),
      { once: true },
    );
    document.head.append(script);
  });

  return window.__momoYandexMapsPromise;
}

/** Находит одну наиболее подходящую точку по текстовому адресу. */
export async function geocodeYandexAddress(
  apiKey: string,
  query: string,
): Promise<YandexGeocodedAddress | null> {
  const ymaps = await loadYandexMaps(apiKey);
  const result = await ymaps.geocode(query, { results: 1 });
  const geoObject = result.geoObjects.get(0);
  if (!geoObject) return null;

  const [latitude, longitude] = geoObject.geometry.getCoordinates();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const propertyAddress = geoObject.properties.get("text");
  const address =
    geoObject.getAddressLine?.().trim() ||
    (typeof propertyAddress === "string" ? propertyAddress.trim() : "") ||
    query;

  return { latitude, longitude, address };
}
