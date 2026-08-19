"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LocateFixed,
  LoaderCircle,
  MapPinned,
  Save,
} from "lucide-react";
import {
  updateDealerAdmin,
  type UpdateDealerState,
} from "@/app/admin/dealers/actions";
import { DealerMapPicker } from "@/components/admin/dealer-map-picker";
import {
  dealerGeocodeQuery,
  formatDealerCoordinate,
} from "@/lib/dealer-geocoding";
import { dealerLocationKind } from "@/lib/dealer-location";
import type { DealerAccount, DealerLocation } from "@/lib/types";
import { geocodeYandexAddress } from "@/lib/yandex-maps-client";

type GeocodeState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; address: string }
  | { type: "map" }
  | { type: "error"; message: string };

type CoordinateSource = "empty" | "saved" | "auto" | "manual" | "map";

export function DealerEditForm({
  dealer,
  account,
  yandexMapsApiKey,
}: {
  dealer: DealerLocation;
  account: DealerAccount | null;
  yandexMapsApiKey: string;
}) {
  const [state, action, pending] = useActionState<UpdateDealerState, FormData>(
    updateDealerAdmin,
    {},
  );
  const [city, setCity] = useState(dealer.city);
  const [address, setAddress] = useState(dealer.address);
  const [latitude, setLatitude] = useState(
    Number.isFinite(dealer.latitude) ? formatDealerCoordinate(dealer.latitude!) : "",
  );
  const [longitude, setLongitude] = useState(
    Number.isFinite(dealer.longitude) ? formatDealerCoordinate(dealer.longitude!) : "",
  );
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [geocodeState, setGeocodeState] = useState<GeocodeState>({ type: "idle" });
  const coordinateSourceRef = useRef<CoordinateSource>(
    Number.isFinite(dealer.latitude) && Number.isFinite(dealer.longitude)
      ? "saved"
      : "empty",
  );
  const lastRequestedQueryRef = useRef("");
  const requestIdRef = useRef(0);
  const input = "h-11 rounded-lg border border-border bg-white px-3 text-sm text-black outline-none transition-colors placeholder:text-black/35 focus:border-signal";

  const resetCoordinatesForAddressChange = () => {
    setLatitude("");
    setLongitude("");
    coordinateSourceRef.current = "empty";
    lastRequestedQueryRef.current = "";
    requestIdRef.current += 1;
    setGeocodeState({ type: "idle" });
  };

  const findCoordinates = useCallback(async (force = false) => {
    const query = dealerGeocodeQuery(city, address);
    if (!query || address.trim().length < 5) return;
    if (!force && ["saved", "manual", "map"].includes(coordinateSourceRef.current)) return;
    if (!force && lastRequestedQueryRef.current === query) return;
    if (!yandexMapsApiKey) {
      setGeocodeState({
        type: "error",
        message: "В настройках сайта не указан ключ Яндекс Карт. Координаты можно ввести вручную.",
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    lastRequestedQueryRef.current = query;
    setGeocodeState({ type: "loading" });

    try {
      const result = await geocodeYandexAddress(yandexMapsApiKey, query);
      if (requestId !== requestIdRef.current) return;
      if (!result) {
        setGeocodeState({
          type: "error",
          message: "Адрес не найден. Уточните его или выберите точку на карте.",
        });
        return;
      }
      setLatitude(formatDealerCoordinate(result.latitude));
      setLongitude(formatDealerCoordinate(result.longitude));
      coordinateSourceRef.current = "auto";
      setGeocodeState({ type: "success", address: result.address });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setGeocodeState({
        type: "error",
        message: error instanceof Error
          ? error.message
          : "Не удалось определить координаты. Выберите точку на карте.",
      });
    }
  }, [address, city, yandexMapsApiKey]);

  useEffect(() => {
    const query = dealerGeocodeQuery(city, address);
    if (
      !query ||
      address.trim().length < 5 ||
      ["saved", "manual", "map"].includes(coordinateSourceRef.current)
    ) return;
    const timer = window.setTimeout(() => void findCoordinates(), 800);
    return () => window.clearTimeout(timer);
  }, [address, city, findCoordinates]);

  const setManualCoordinate = (field: "latitude" | "longitude", value: string) => {
    requestIdRef.current += 1;
    coordinateSourceRef.current = value || (field === "latitude" ? longitude : latitude)
      ? "manual"
      : "empty";
    lastRequestedQueryRef.current = "";
    setGeocodeState({ type: "idle" });
    if (field === "latitude") setLatitude(value);
    else setLongitude(value);
  };

  const setMapCoordinates = (coordinates: { latitude: number; longitude: number }) => {
    requestIdRef.current += 1;
    setLatitude(formatDealerCoordinate(coordinates.latitude));
    setLongitude(formatDealerCoordinate(coordinates.longitude));
    coordinateSourceRef.current = "map";
    lastRequestedQueryRef.current = "";
    setGeocodeState({ type: "map" });
    setMapPickerOpen(false);
  };

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="id" value={dealer.id} />

      <fieldset className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">
          Публичная карточка
        </legend>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Компания
          <input className={input} name="name" defaultValue={dealer.name} autoComplete="organization" required />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Город
          <input
            className={input}
            name="city"
            value={city}
            autoComplete="address-level2"
            onChange={(event) => {
              resetCoordinatesForAddressChange();
              setCity(event.target.value);
            }}
            required
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
          Публичный адрес
          <input
            className={input}
            name="address"
            value={address}
            onChange={(event) => {
              resetCoordinatesForAddressChange();
              setAddress(event.target.value);
            }}
            autoComplete="street-address"
            required
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Публичный телефон
          <input className={input} type="tel" name="phone" defaultValue={dealer.phone} autoComplete="tel" required />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Публичный email
          <input className={input} type="email" name="publicEmail" defaultValue={dealer.email} autoComplete="email" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Сайт
          <input className={input} type="url" name="website" defaultValue={dealer.website} placeholder="https://" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Режим работы
          <input className={input} name="hours" defaultValue={dealer.hours} placeholder="Пн–Пт: 9:00–18:00" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Тип точки
          <select className={input} name="kind" defaultValue={dealerLocationKind(dealer)} required>
            <option value="store">Магазин</option>
            <option value="installation">Установочный центр</option>
            <option value="store_install">Магазин / Установочный центр</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="authorizedInstallation" defaultChecked={dealer.authorizedInstallation} />
          Авторизованная установка — гарантия 24 месяца
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">
          Точка на карте
        </legend>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Широта
          <input className={input} inputMode="decimal" name="latitude" value={latitude} onChange={(event) => setManualCoordinate("latitude", event.target.value)} placeholder="Заполнится автоматически" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Долгота
          <input className={input} inputMode="decimal" name="longitude" value={longitude} onChange={(event) => setManualCoordinate("longitude", event.target.value)} placeholder="Заполнится автоматически" />
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-black/[.02] p-3 sm:col-span-2" aria-live="polite">
          <button
            type="button"
            disabled={geocodeState.type === "loading" || !dealerGeocodeQuery(city, address) || address.trim().length < 5}
            onClick={() => void findCoordinates(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-xs font-bold text-black transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
          >
            {geocodeState.type === "loading" ? <LoaderCircle className="animate-spin" size={16} /> : <LocateFixed size={16} />}
            {geocodeState.type === "loading" ? "Ищем адрес…" : "Найти по адресу"}
          </button>
          <button
            type="button"
            onClick={() => setMapPickerOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-xs font-bold text-black transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <MapPinned size={16} aria-hidden />
            Выбрать на карте
          </button>
          <div className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            {geocodeState.type === "idle" && <p>Сохранённую точку можно уточнить по адресу или выбрать вручную.</p>}
            {geocodeState.type === "loading" && <p>Проверяем адрес в Яндекс Картах…</p>}
            {geocodeState.type === "success" && <p className="flex items-start gap-1.5 text-emerald-700"><CheckCircle2 className="mt-0.5 shrink-0" size={15} /><span>Найдено: {geocodeState.address}</span></p>}
            {geocodeState.type === "map" && <p className="flex items-start gap-1.5 text-emerald-700"><CheckCircle2 className="mt-0.5 shrink-0" size={15} /><span>Точка выбрана на карте.</span></p>}
            {geocodeState.type === "error" && <p className="flex items-start gap-1.5 text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={15} /><span>{geocodeState.message}</span></p>}
          </div>
        </div>
      </fieldset>

      {account && (
        <fieldset className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
          <legend className="px-2 font-display text-sm font-bold uppercase tracking-wide">
            Дилерский кабинет
          </legend>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Контактное лицо
            <input className={input} name="contactName" defaultValue={account.contactName} required />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Email для входа
            <input className={input} type="email" name="loginEmail" defaultValue={account.email} autoComplete="username" required />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Ценовой уровень
            <select className={input} name="priceTier" defaultValue={account.priceTier ?? "dealer"} required>
              <option value="dealer">Дилерский прайс</option>
              <option value="dagestan">Дагестанский прайс</option>
              <option value="wholesale">Оптовый прайс</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Резервная скидка от РРЦ, %
            <input className={input} type="number" min="0" max="80" step="0.1" name="discountPercent" defaultValue={account.discountPercent} required />
          </label>
        </fieldset>
      )}

      {mapPickerOpen && (
        <DealerMapPicker
          apiKey={yandexMapsApiKey}
          city={city}
          address={address}
          initialLatitude={latitude}
          initialLongitude={longitude}
          onClose={() => setMapPickerOpen(false)}
          onSelect={setMapCoordinates}
        />
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
          <CheckCircle2 size={17} aria-hidden />
          Изменения сохранены и опубликованы на сайте.
        </p>
      )}

      <button
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:justify-self-start"
      >
        {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden /> : <Save size={17} aria-hidden />}
        {pending ? "Сохраняем…" : "Сохранить изменения"}
      </button>
    </form>
  );
}
