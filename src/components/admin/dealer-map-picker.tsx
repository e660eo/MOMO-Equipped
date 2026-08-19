"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, MapPinned, MousePointerClick, X } from "lucide-react";
import {
  dealerGeocodeQuery,
  formatDealerCoordinate,
  parseDealerCoordinates,
} from "@/lib/dealer-geocoding";
import {
  geocodeYandexAddress,
  loadYandexMaps,
  type YandexMap,
  type YandexMapEvent,
  type YandexPlacemark,
} from "@/lib/yandex-maps-client";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface DealerMapPickerProps {
  apiKey: string;
  city: string;
  address: string;
  initialLatitude: string;
  initialLongitude: string;
  onClose: () => void;
  onSelect: (coordinates: Coordinates) => void;
}

function eventCoordinates(event: YandexMapEvent): Coordinates | null {
  const coordinates = event.get("coords");
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const latitude = Number(coordinates[0]);
  const longitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function DealerMapPicker({
  apiKey,
  city,
  address,
  initialLatitude,
  initialLongitude,
  onClose,
  onSelect,
}: DealerMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const placemarkRef = useRef<YandexPlacemark | null>(null);
  const initialCoordinates = useMemo(
    () => parseDealerCoordinates(initialLatitude, initialLongitude),
    [initialLatitude, initialLongitude],
  );
  const [selection, setSelection] = useState<Coordinates | null>(initialCoordinates);
  const [isReady, setIsReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyboard);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeyboard);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let clickHandler: ((event: YandexMapEvent) => void) | null = null;

    void (async () => {
      try {
        const ymaps = await loadYandexMaps(apiKey);
        if (cancelled || !containerRef.current) return;

        let center: [number, number] = initialCoordinates
          ? [initialCoordinates.latitude, initialCoordinates.longitude]
          : [55.751244, 37.618423];
        let zoom = initialCoordinates ? 16 : 4;
        let addressCoordinates: Coordinates | null = null;

        if (!initialCoordinates) {
          const query = dealerGeocodeQuery(city, address);
          const precise = query
            ? await geocodeYandexAddress(apiKey, query).catch(() => null)
            : null;
          if (precise) {
            addressCoordinates = {
              latitude: precise.latitude,
              longitude: precise.longitude,
            };
            center = [precise.latitude, precise.longitude];
            zoom = 16;
          } else if (city.trim()) {
            const cityResult = await geocodeYandexAddress(apiKey, city.trim()).catch(
              () => null,
            );
            if (cityResult) {
              center = [cityResult.latitude, cityResult.longitude];
              zoom = 11;
            }
          }
        }

        if (cancelled || !containerRef.current) return;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center,
            zoom,
            controls: ["zoomControl", "searchControl", "fullscreenControl"],
          },
          {
            minZoom: 3,
            maxZoom: 19,
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true,
          },
        );
        mapRef.current = map;

        const placeMarker = (coordinates: Coordinates) => {
          const point: [number, number] = [
            coordinates.latitude,
            coordinates.longitude,
          ];
          setSelection(coordinates);
          if (placemarkRef.current) {
            placemarkRef.current.geometry.setCoordinates(point);
            return;
          }

          const placemark = new ymaps.Placemark(
            point,
            { hintContent: "Выбранная точка" },
            {
              draggable: true,
              preset: "islands#redDotIcon",
              zIndex: 1000,
            },
          );
          placemark.events.add("dragend", () => {
            const [latitude, longitude] = placemark.geometry.getCoordinates();
            setSelection({ latitude, longitude });
          });
          placemarkRef.current = placemark;
          map.geoObjects.add(placemark);
        };

        clickHandler = (event) => {
          const coordinates = eventCoordinates(event);
          if (coordinates) placeMarker(coordinates);
        };
        map.events.add("click", clickHandler);

        if (initialCoordinates) placeMarker(initialCoordinates);
        else if (addressCoordinates) placeMarker(addressCoordinates);
        setIsReady(true);
      } catch (error) {
        if (!cancelled) {
          setMapError(
            error instanceof Error ? error.message : "Карта временно недоступна.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (clickHandler && mapRef.current) {
        mapRef.current.events.remove("click", clickHandler);
      }
      mapRef.current?.destroy();
      mapRef.current = null;
      placemarkRef.current = null;
    };
  }, [address, apiKey, city, initialCoordinates]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-stretch justify-center bg-black/55 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-map-picker-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-[min(760px,calc(100dvh-2.5rem))] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-border"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-signal">
              <MapPinned size={19} aria-hidden />
              <p className="text-xs font-bold uppercase tracking-[0.14em]">Расположение точки</p>
            </div>
            <h2 id="dealer-map-picker-title" className="mt-1 font-display text-xl font-bold">
              Выберите место на карте
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Нажмите на нужное здание или перетащите установленную метку.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            aria-label="Закрыть карту"
          >
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 bg-[#e8e6e2]">
          <div
            ref={containerRef}
            className="h-full w-full"
            role="region"
            aria-label="Карта для выбора расположения дилера"
          />
          {!isReady && !mapError && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-surface/90 p-6 text-center">
              <div>
                <LoaderCircle className="mx-auto animate-spin text-signal" size={28} />
                <p className="mt-3 text-sm font-semibold">Открываем карту…</p>
              </div>
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-surface/95 p-6 text-center">
              <div className="max-w-md">
                <p className="font-display text-lg font-bold">Карта не загрузилась</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{mapError}</p>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {selection ? (
                <p className="flex items-start gap-2 text-sm text-emerald-700">
                  <Check className="mt-0.5 shrink-0" size={17} aria-hidden />
                  <span>
                    Выбрано: {formatDealerCoordinate(selection.latitude)}, {" "}
                    {formatDealerCoordinate(selection.longitude)}
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MousePointerClick className="mt-0.5 shrink-0" size={17} aria-hidden />
                  <span>Нажмите на карту, чтобы поставить метку.</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Публичный адрес в форме останется без изменений.
              </p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 cursor-pointer whitespace-nowrap rounded-lg border border-border px-3 text-xs font-bold transition-colors hover:border-signal sm:flex-none sm:px-4 sm:text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!selection || Boolean(mapError)}
                onClick={() => selection && onSelect(selection)}
                className="inline-flex h-11 flex-[1.2] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-signal px-3 text-xs font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-5 sm:text-sm"
              >
                <Check size={17} aria-hidden />
                Применить точку
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
