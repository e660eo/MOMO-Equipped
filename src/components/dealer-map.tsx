"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/components/site-config-provider";
import {
  dealerLocationKind,
  DEALER_LOCATION_KIND_LABELS,
} from "@/lib/dealer-location";
import type { DealerLocation, DealerLocationKind } from "@/lib/types";
import {
  loadYandexMaps,
  type YandexMap,
  type YandexPlacemark,
} from "@/lib/yandex-maps-client";

interface DealerMapProps {
  dealers: DealerLocation[];
  selectedDealerId: string | null;
  onSelect: (dealerId: string) => void;
}

type DealerWithCoordinates = DealerLocation & {
  latitude: number;
  longitude: number;
};

const KIND_MARKERS: Record<DealerLocationKind, { className: string; label: string }> = {
  store: { className: "is-store", label: "М" },
  installation: { className: "is-installation", label: "У" },
  store_install: { className: "is-combined", label: "М+У" },
};

function hasCoordinates(dealer: DealerLocation): dealer is DealerWithCoordinates {
  return Number.isFinite(dealer.latitude) && Number.isFinite(dealer.longitude);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

function dealerSignature(dealers: DealerWithCoordinates[]): string {
  return dealers
    .map((dealer) => `${dealer.id}:${dealer.latitude}:${dealer.longitude}`)
    .sort()
    .join("|");
}

export function DealerMap({ dealers, selectedDealerId, onSelect }: DealerMapProps) {
  const { yandexMapsApiKey } = useSiteConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const placemarksRef = useRef(new Map<string, YandexPlacemark>());
  const selectHandlerRef = useRef(onSelect);
  const previousSignatureRef = useRef("");
  const previousSelectionRef = useRef<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    selectHandlerRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || shouldLoad) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    const placemarks = placemarksRef.current;

    void loadYandexMaps(yandexMapsApiKey ?? "")
      .then((ymaps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new ymaps.Map(
          containerRef.current,
          {
            center: [48.7, 43.8],
            zoom: 4,
            controls: ["zoomControl", "fullscreenControl"],
          },
          {
            minZoom: 3,
            maxZoom: 18,
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true,
          },
        );
        setIsReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(
            error instanceof Error ? error.message : "Карта временно недоступна.",
          );
        }
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      placemarks.clear();
    };
  }, [shouldLoad, yandexMapsApiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = window.ymaps;
    if (!isReady || !map || !ymaps) return;

    const locatedDealers = dealers.filter(hasCoordinates);
    const signature = dealerSignature(locatedDealers);
    const signatureChanged = signature !== previousSignatureRef.current;
    const selectionChanged = selectedDealerId !== previousSelectionRef.current;
    previousSignatureRef.current = signature;
    previousSelectionRef.current = selectedDealerId;

    map.geoObjects.removeAll();
    placemarksRef.current.clear();

    for (const dealer of locatedDealers) {
      const kind = dealerLocationKind(dealer);
      const marker = KIND_MARKERS[kind];
      const selected = dealer.id === selectedDealerId;
      const pointLayout = ymaps.templateLayoutFactory.createClass(
        `<button type="button" class="momo-yandex-dealer-point${selected ? " is-selected" : ""}" aria-label="{{ properties.hintContent }}"><span class="momo-dealer-map-marker ${marker.className}${selected ? " is-selected" : ""}"><span>${marker.label}</span></span></button>`,
      );
      const placemark = new ymaps.Placemark(
        [dealer.latitude, dealer.longitude],
        {
          hintContent: `${dealer.name} — ${DEALER_LOCATION_KIND_LABELS[kind]}`,
          balloonContentHeader: escapeHtml(dealer.name),
          balloonContentBody: `${escapeHtml(dealer.city)}, ${escapeHtml(dealer.address)}`,
          balloonContentFooter: escapeHtml(DEALER_LOCATION_KIND_LABELS[kind]),
        },
        {
          iconLayout: pointLayout,
          iconOffset: [-22, -44],
          iconShape: {
            type: "Rectangle",
            coordinates: [[0, 0], [44, 44]],
          },
          zIndex: selected ? 1000 : 700,
          openBalloonOnClick: true,
        },
      );
      placemark.events.add("click", () => selectHandlerRef.current(dealer.id));
      placemarksRef.current.set(dealer.id, placemark);
      map.geoObjects.add(placemark);
    }

    const selectedDealer = locatedDealers.find(
      (dealer) => dealer.id === selectedDealerId,
    );
    if (selectedDealer && selectionChanged) {
      map.setCenter(
        [selectedDealer.latitude, selectedDealer.longitude],
        Math.max(map.getZoom(), 12),
        { duration: 260, checkZoomRange: true },
      );
      placemarksRef.current.get(selectedDealer.id)?.balloon?.open();
      return;
    }

    if (!signatureChanged || !locatedDealers.length) return;
    if (locatedDealers.length === 1) {
      map.setCenter(
        [locatedDealers[0].latitude, locatedDealers[0].longitude],
        12,
        { duration: 260, checkZoomRange: true },
      );
      return;
    }

    const latitudes = locatedDealers.map((dealer) => dealer.latitude);
    const longitudes = locatedDealers.map((dealer) => dealer.longitude);
    map.setBounds(
      [
        [Math.min(...latitudes), Math.min(...longitudes)],
        [Math.max(...latitudes), Math.max(...longitudes)],
      ],
      { checkZoomRange: true, zoomMargin: 68, duration: 260 },
    );
  }, [dealers, isReady, selectedDealerId]);

  const pointsWithCoordinates = dealers.filter(hasCoordinates).length;

  return (
    <div className="relative h-[360px] w-full bg-[#e8e6e2] sm:h-[460px]">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label={`Карта дилерской сети MOMO. Количество точек: ${pointsWithCoordinates}`}
      />
      {!shouldLoad && pointsWithCoordinates > 0 && !mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface/90 p-6 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Загружаем карту…</p>
        </div>
      )}
      {!pointsWithCoordinates && !mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface/90 p-6 text-center">
          <div>
            <p className="font-display text-base font-bold">На карте нет точек</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Измените фильтры, чтобы снова показать дилеров.
            </p>
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface/95 p-6 text-center">
          <div>
            <p className="font-display text-base font-bold">Карта временно недоступна</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {mapError} Все адреса остаются доступны в списке ниже.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
