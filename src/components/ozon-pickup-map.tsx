"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/components/site-config-provider";
import type {
  OzonMapViewport,
  PublicOzonCluster,
  PublicOzonPoint,
} from "@/lib/ozon-delivery";

export interface MapTarget {
  lat: number;
  long: number;
  zoom: number;
}

export interface MapView extends MapTarget {
  viewport: OzonMapViewport;
}

interface OzonPickupMapProps {
  target: MapTarget;
  points: PublicOzonPoint[];
  clusters: PublicOzonCluster[];
  selectedPointId?: number;
  onViewChange: (view: MapView) => void;
  onSelect: (point: PublicOzonPoint) => void;
}

interface YandexEventManager {
  add(type: string, handler: () => void): void;
  remove(type: string, handler: () => void): void;
}

interface YandexPlacemark {
  events: YandexEventManager;
}

interface YandexMap {
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

interface YandexMapsApi {
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

function loadYandexMaps(apiKey: string): Promise<YandexMapsApi> {
  if (!apiKey) return Promise.reject(new Error("Для карты не настроен ключ Яндекс Карт."));
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
    const nonceSource = document.querySelector<HTMLScriptElement>("script[nonce]");
    if (nonceSource?.nonce) script.nonce = nonceSource.nonce;
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

function pointWord(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "пунктов";
  if (last === 1) return "пункт";
  if (last >= 2 && last <= 4) return "пункта";
  return "пунктов";
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
}

function currentView(map: YandexMap): MapView | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const center = map.getCenter();
  return {
    lat: center[0],
    long: center[1],
    zoom: map.getZoom(),
    viewport: {
      south: bounds[0][0],
      west: bounds[0][1],
      north: bounds[1][0],
      east: bounds[1][1],
    },
  };
}

export function OzonPickupMap({
  target,
  points,
  clusters,
  selectedPointId,
  onViewChange,
  onSelect,
}: OzonPickupMapProps) {
  const { yandexMapsApiKey } = useSiteConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const viewHandlerRef = useRef(onViewChange);
  const selectHandlerRef = useRef(onSelect);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    viewHandlerRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    selectHandlerRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let reportTimer: ReturnType<typeof setTimeout> | undefined;

    void loadYandexMaps(yandexMapsApiKey ?? "")
      .then((ymaps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [target.lat, target.long],
            zoom: target.zoom,
            controls: ["searchControl", "zoomControl", "fullscreenControl"],
          },
          {
            minZoom: 2,
            maxZoom: 19,
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true,
          },
        );
        const reportView = () => {
          clearTimeout(reportTimer);
          reportTimer = setTimeout(() => {
            const view = currentView(map);
            if (view) viewHandlerRef.current(view);
          }, 180);
        };
        map.events.add("boundschange", reportView);
        mapRef.current = map;
        reportView();
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "Карта временно недоступна.");
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(reportTimer);
      const map = mapRef.current;
      if (map) {
        map.destroy();
        mapRef.current = null;
      }
    };
    // Карта создаётся один раз; новые координаты применяет эффект ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yandexMapsApiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    const centerChanged =
      Math.abs(current[0] - target.lat) > 0.0004 ||
      Math.abs(current[1] - target.long) > 0.0004;
    const zoomChanged = Math.abs(map.getZoom() - target.zoom) >= 1;
    if (centerChanged || zoomChanged) {
      map.setCenter([target.lat, target.long], target.zoom, {
        duration: 260,
        checkZoomRange: true,
      });
    }
  }, [target.lat, target.long, target.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = window.ymaps;
    if (!map || !ymaps) return;
    map.geoObjects.removeAll();

    const clusterLayout = ymaps.templateLayoutFactory.createClass(
      '<button type="button" class="momo-yandex-cluster" aria-label="{{ properties.hintContent }}"><span class="momo-map-cluster"><b>{{ properties.iconContent }}</b><small>OZON</small></span></button>',
    );
    const pointLayout = ymaps.templateLayoutFactory.createClass(
      '<button type="button" class="momo-yandex-point" aria-label="{{ properties.hintContent }}"><span class="momo-map-marker"><span>OZON</span></span></button>',
    );
    const selectedPointLayout = ymaps.templateLayoutFactory.createClass(
      '<button type="button" class="momo-yandex-point is-selected" aria-label="{{ properties.hintContent }}"><span class="momo-map-marker is-selected"><span>OZON</span></span></button>',
    );

    for (const cluster of clusters) {
      const label = `${cluster.pointsCount} ${pointWord(cluster.pointsCount)} Ozon`;
      const placemark = new ymaps.Placemark(
        [cluster.lat, cluster.long],
        { hintContent: label, iconContent: cluster.pointsCount > 999 ? "999+" : cluster.pointsCount },
        {
          iconLayout: clusterLayout,
          iconOffset: [-26, -26],
          iconShape: { type: "Circle", coordinates: [26, 26], radius: 26 },
          zIndex: 500,
        },
      );
      placemark.events.add("click", () => {
        const { south, west, north, east } = cluster.viewport;
        if (north - south > 0.0005 || east - west > 0.0005) {
          map.setBounds(
            [
              [south, west],
              [north, east],
            ],
            { checkZoomRange: true, zoomMargin: 52, duration: 260 },
          );
        } else {
          map.setCenter(
            [cluster.lat, cluster.long],
            Math.min(19, map.getZoom() + 2),
            { duration: 260, checkZoomRange: true },
          );
        }
      });
      map.geoObjects.add(placemark);
    }

    for (const point of points) {
      const selected = point.id === selectedPointId;
      const placemark = new ymaps.Placemark(
        [point.lat, point.long],
        {
          hintContent: point.address,
          balloonContentHeader: escapeHtml(point.name),
          balloonContentBody: escapeHtml(point.address),
          balloonContentFooter: selected
            ? "ПВЗ выбран — подтвердите его под картой"
            : "Нажмите на метку, чтобы выбрать ПВЗ",
        },
        {
          iconLayout: selected ? selectedPointLayout : pointLayout,
          iconOffset: selected ? [-21, -42] : [-17, -34],
          iconShape: {
            type: "Rectangle",
            coordinates: selected ? [[0, 0], [42, 42]] : [[0, 0], [34, 34]],
          },
          zIndex: selected ? 1000 : 700,
          openBalloonOnClick: true,
        },
      );
      placemark.events.add("click", () => selectHandlerRef.current(point));
      map.geoObjects.add(placemark);
    }
  }, [clusters, points, selectedPointId]);

  return (
    <div className="relative h-[390px] w-full bg-[#eceff3] sm:h-[500px]">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Яндекс Карта пунктов выдачи Ozon по России"
      />
      {mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface/95 p-6 text-center">
          <div>
            <p className="text-sm font-semibold">Яндекс Карты пока не подключены</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {mapError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
