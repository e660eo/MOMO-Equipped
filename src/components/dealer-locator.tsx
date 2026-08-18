"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock,
  LocateFixed,
  MapPinned,
  MapPin,
  Phone,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { DealerMap } from "@/components/dealer-map";
import {
  DEALER_LOCATION_KIND_LABELS,
  dealerLocationKind,
  dealerSupportsInstallation,
  dealerSupportsSales,
} from "@/lib/dealer-location";
import type { DealerLocation } from "@/lib/types";

type DealerService = "" | "store" | "installation";

function distance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function matchesService(dealer: DealerLocation, service: DealerService): boolean {
  if (service === "store") return dealerSupportsSales(dealer);
  if (service === "installation") return dealerSupportsInstallation(dealer);
  return true;
}

function locationWord(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "точек";
  if (last === 1) return "точка";
  if (last >= 2 && last <= 4) return "точки";
  return "точек";
}

export function DealerLocator({ dealers }: { dealers: DealerLocation[] }) {
  const cities = useMemo(
    () =>
      [...new Set(dealers.map((dealer) => dealer.city))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [dealers],
  );
  // Каждый новый визит начинается со всей сети. Город сужается только после
  // явного выбора или определения геопозиции в рамках текущего открытия.
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [service, setService] = useState<DealerService>("");
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  function chooseCity(value: string) {
    setCity(value);
    setSelectedDealerId(null);
  }

  function chooseService(value: DealerService) {
    setService(value);
    setSelectedDealerId(null);
  }

  function locate() {
    if (!navigator.geolocation) {
      setGeoMessage(
        "Браузер не поддерживает определение местоположения. Выберите город вручную.",
      );
      return;
    }
    setGeoMessage("Определяем ближайшую точку…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const withCoords = dealers.filter(
          (
            dealer,
          ): dealer is DealerLocation & { latitude: number; longitude: number } =>
            matchesService(dealer, service) &&
            Number.isFinite(dealer.latitude) &&
            Number.isFinite(dealer.longitude),
        );
        if (!withCoords.length) {
          setGeoMessage(
            "У опубликованных точек пока нет координат. Выберите город вручную.",
          );
          return;
        }
        const nearest = withCoords.reduce((best, dealer) =>
          distance(coords, dealer) < distance(coords, best) ? dealer : best,
        );
        setCity(nearest.city);
        setSelectedDealerId(nearest.id);
        const km = Math.round(distance(coords, nearest));
        setGeoMessage(
          `Ближайшая опубликованная точка — ${nearest.city}${
            km ? `, около ${km} км` : ""
          }.`,
        );
      },
      () =>
        setGeoMessage(
          "Доступ к геопозиции не разрешён. Выберите город вручную.",
        ),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = dealers.filter((dealer) => {
    if (city && dealer.city !== city) return false;
    if (!matchesService(dealer, service)) return false;
    if (
      needle &&
      !`${dealer.name} ${dealer.city} ${dealer.address}`.toLowerCase().includes(needle)
    ) {
      return false;
    }
    return true;
  });

  function showDealerOnMap(dealerId: string) {
    setSelectedDealerId(dealerId);
    document.getElementById("dealer-network-map")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  return (
    <div>
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-[0.72rem] font-medium uppercase tracking-wider text-muted-foreground">
          Город
          <select
            value={city}
            onChange={(event) => chooseCity(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-sm border border-input bg-bg px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"
          >
            <option value="">Все города</option>
            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.72rem] font-medium uppercase tracking-wider text-muted-foreground">
          Поиск
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedDealerId(null);
            }}
            placeholder="Название или адрес"
            className="mt-1.5 min-h-11 w-full rounded-sm border border-input bg-bg px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-signal"
          />
        </label>
        <button
          type="button"
          onClick={locate}
          className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold transition hover:border-signal hover:text-signal"
        >
          <LocateFixed size={16} aria-hidden="true" /> Определить
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Тип дилерской точки">
        {(
          [
            ["", "Все точки"],
            ["store", "Где купить"],
            ["installation", "Где установить"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={service === value}
            onClick={() => chooseService(value)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              service === value
                ? "border-signal bg-signal text-white"
                : "border-border bg-surface hover:border-signal hover:text-signal"
            }`}
          >
            {value === "store" && <ShoppingBag size={15} aria-hidden="true" />}
            {value === "installation" && <Wrench size={15} aria-hidden="true" />}
            {label}
          </button>
        ))}
      </div>
      {geoMessage && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {geoMessage}
        </p>
      )}

      <section
        id="dealer-network-map"
        className="mt-7 scroll-mt-36 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_55px_rgba(20,20,22,0.08)]"
        aria-labelledby="dealer-map-title"
      >
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-signal">
              Сеть MOMO на карте
            </p>
            <h2
              id="dealer-map-title"
              className="mt-1 font-display text-lg font-bold sm:text-xl"
            >
              Магазины и установочные центры
            </h2>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              Показано {shown.length} {locationWord(shown.length)}
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2 text-xs font-semibold"
            aria-label="Обозначения на карте"
          >
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-bg px-3">
              <ShoppingBag size={14} className="text-signal" aria-hidden="true" />
              Магазин
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-bg px-3">
              <Wrench size={14} aria-hidden="true" /> Установочный центр
            </span>
          </div>
        </div>
        <DealerMap
          dealers={shown}
          selectedDealerId={selectedDealerId}
          onSelect={setSelectedDealerId}
        />
      </section>

      {shown.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {shown.map((dealer) => {
            const kind = dealerLocationKind(dealer);
            const selected = dealer.id === selectedDealerId;
            return (
              <article
                id={`dealer-card-${dealer.id}`}
                key={dealer.id}
                aria-current={selected ? "location" : undefined}
                className={`group rounded-xl border bg-surface p-6 transition ${
                  selected
                    ? "border-signal shadow-[0_12px_36px_rgba(255,85,0,0.12)]"
                    : "border-border hover:border-signal/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-signal">
                      Официальный дилер
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {DEALER_LOCATION_KIND_LABELS[kind]}
                    </p>
                    <h2 className="mt-2 font-display text-lg font-bold">{dealer.name}</h2>
                  </div>
                  <BadgeCheck
                    size={22}
                    className="shrink-0 text-signal"
                    aria-label="Официальная точка"
                  />
                </div>
                <ul className="mt-5 space-y-3 text-sm">
                  <li className="flex gap-2.5">
                    <MapPin
                      size={16}
                      className="mt-0.5 shrink-0 text-signal"
                      aria-hidden="true"
                    />
                    <span>
                      <b className="font-medium">{dealer.city}</b>, {dealer.address}
                    </span>
                  </li>
                  {dealer.hours && (
                    <li className="flex gap-2.5 text-muted-foreground">
                      <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {dealer.hours}
                    </li>
                  )}
                  {dealerSupportsSales(dealer) && (
                    <li className="flex gap-2.5 text-muted-foreground">
                      <ShoppingBag
                        size={16}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      Продажа оборудования
                    </li>
                  )}
                  {dealerSupportsInstallation(dealer) && (
                    <li className="flex gap-2.5 text-muted-foreground">
                      <Wrench size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      Установка оборудования
                    </li>
                  )}
                  {dealer.authorizedInstallation && (
                    <li className="flex gap-2.5 font-semibold text-signal">
                      <BadgeCheck
                        size={16}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      Гарантия 24 месяца при установке
                    </li>
                  )}
                </ul>
                <div className="mt-6 flex flex-wrap gap-2">
                  <a
                    href={`tel:${dealer.phone.replace(/[^+\d]/g, "")}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-foreground px-4 text-sm font-semibold text-bg"
                  >
                    <Phone size={15} aria-hidden="true" /> Позвонить
                  </a>
                  <button
                    type="button"
                    onClick={() => showDealerOnMap(dealer.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold hover:border-signal hover:text-signal"
                  >
                    <MapPinned size={15} aria-hidden="true" /> На карте
                  </button>
                  {dealer.website && (
                    <a
                      href={dealer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-sm border border-border px-4 text-sm font-semibold hover:border-signal hover:text-signal"
                    >
                      Сайт ↗
                    </a>
                  )}
                </div>
                <p className="mt-3 text-[0.72rem] text-muted-foreground">
                  Наличие и время визита уточняйте у точки.
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-7 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-display text-lg font-bold">
            Точек по выбранным условиям пока нет
          </p>
          <p className="mx-auto mt-2 max-w-[50ch] text-sm text-muted-foreground">
            Сбросьте фильтр или напишите нам — подскажем доставку и ближайшего
            партнёра.
          </p>
        </div>
      )}
    </div>
  );
}
