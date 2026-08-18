"use client";

export interface YandexEventManager {
  add(type: string, handler: () => void): void;
  remove(type: string, handler: () => void): void;
}

export interface YandexPlacemark {
  events: YandexEventManager;
  balloon?: {
    open(): void;
    close(): void;
  };
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
