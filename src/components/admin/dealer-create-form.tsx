"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, LocateFixed, LoaderCircle, MailCheck, MailWarning, MapPinned } from "lucide-react";
import { createDealerAdmin, type CreateDealerState } from "@/app/admin/dealers/actions";
import { DealerMapPicker } from "@/components/admin/dealer-map-picker";
import { dealerGeocodeQuery, formatDealerCoordinate } from "@/lib/dealer-geocoding";
import { geocodeYandexAddress } from "@/lib/yandex-maps-client";

export type DealerCreateInitial = { applicationId?: string; name?: string; city?: string; phone?: string; contactName?: string; loginEmail?: string; website?: string };

type GeocodeState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; address: string }
  | { type: "map" }
  | { type: "error"; message: string };

export function DealerCreateForm({
  initial = {},
  yandexMapsApiKey,
}: {
  initial?: DealerCreateInitial;
  yandexMapsApiKey: string;
}) {
  const [state, action, pending] = useActionState<CreateDealerState, FormData>(createDealerAdmin, {});
  const [copied, setCopied] = useState(false);
  const [city, setCity] = useState(initial.city ?? "");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [geocodeState, setGeocodeState] = useState<GeocodeState>({ type: "idle" });
  const coordinateSourceRef = useRef<"empty" | "auto" | "manual" | "map">("empty");
  const lastRequestedQueryRef = useRef("");
  const requestIdRef = useRef(0);
  const input = "h-11 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-signal";

  const resetAutoCoordinates = () => {
    if (coordinateSourceRef.current === "auto") {
      setLatitude("");
      setLongitude("");
      coordinateSourceRef.current = "empty";
    }
    lastRequestedQueryRef.current = "";
    requestIdRef.current += 1;
    setGeocodeState({ type: "idle" });
  };

  const findCoordinates = useCallback(async (force = false) => {
    const query = dealerGeocodeQuery(city, address);
    if (!query || address.trim().length < 5) return;
    if (!force && (coordinateSourceRef.current === "manual" || coordinateSourceRef.current === "map")) return;
    if (!force && lastRequestedQueryRef.current === query) return;
    if (!yandexMapsApiKey) {
      setGeocodeState({ type: "error", message: "В настройках сайта не указан ключ Яндекс Карт. Координаты можно ввести вручную." });
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
        setGeocodeState({ type: "error", message: "Адрес не найден. Уточните его или выберите точку на карте." });
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
        message: error instanceof Error ? error.message : "Не удалось определить координаты. Выберите точку на карте.",
      });
    }
  }, [address, city, yandexMapsApiKey]);

  useEffect(() => {
    const query = dealerGeocodeQuery(city, address);
    if (!query || address.trim().length < 5 || coordinateSourceRef.current === "manual" || coordinateSourceRef.current === "map") return;
    const timer = window.setTimeout(() => void findCoordinates(), 800);
    return () => window.clearTimeout(timer);
  }, [address, city, findCoordinates]);

  const setManualCoordinate = (field: "latitude" | "longitude", value: string) => {
    requestIdRef.current += 1;
    coordinateSourceRef.current = value || (field === "latitude" ? longitude : latitude) ? "manual" : "empty";
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

  return <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
    {initial.applicationId && <input type="hidden" name="applicationId" value={initial.applicationId} />}
    <label className="grid gap-1 text-xs text-muted-foreground">Компания<input className={input} name="name" defaultValue={initial.name} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Город<input className={input} name="city" value={city} onChange={(event) => { resetAutoCoordinates(); setCity(event.target.value); }} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">Публичный адрес<input className={input} name="address" value={address} onChange={(event) => { resetAutoCoordinates(); setAddress(event.target.value); }} autoComplete="street-address" required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Публичный телефон<input className={input} name="phone" defaultValue={initial.phone} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Публичный email<input className={input} type="email" name="publicEmail" defaultValue={initial.loginEmail} /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Контактное лицо<input className={input} name="contactName" defaultValue={initial.contactName} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Email для входа<input className={input} type="email" name="loginEmail" defaultValue={initial.loginEmail} required /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Сайт<input className={input} type="url" name="website" defaultValue={initial.website} placeholder="https://" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Режим работы<input className={input} name="hours" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Широта<input className={input} inputMode="decimal" name="latitude" value={latitude} onChange={(event) => setManualCoordinate("latitude", event.target.value)} placeholder="Заполнится автоматически" /></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Долгота<input className={input} inputMode="decimal" name="longitude" value={longitude} onChange={(event) => setManualCoordinate("longitude", event.target.value)} placeholder="Заполнится автоматически" /></label>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-black/[.02] p-3 sm:col-span-2" aria-live="polite">
      <button type="button" disabled={geocodeState.type === "loading" || !dealerGeocodeQuery(city, address) || address.trim().length < 5} onClick={() => void findCoordinates(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-xs font-bold transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-50">
        {geocodeState.type === "loading" ? <LoaderCircle className="animate-spin" size={16} /> : <LocateFixed size={16} />}
        {geocodeState.type === "loading" ? "Ищем адрес…" : "Найти по адресу"}
      </button>
      <button type="button" onClick={() => setMapPickerOpen(true)} className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-xs font-bold transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
        <MapPinned size={16} aria-hidden />
        Выбрать на карте
      </button>
      <div className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
        {geocodeState.type === "idle" && <p>Найдите координаты по адресу или выберите точку на карте.</p>}
        {geocodeState.type === "loading" && <p>Проверяем адрес в Яндекс Картах…</p>}
        {geocodeState.type === "success" && <p className="flex items-start gap-1.5 text-emerald-700"><CheckCircle2 className="mt-0.5 shrink-0" size={15} /><span>Найдено: {geocodeState.address}</span></p>}
        {geocodeState.type === "map" && <p className="flex items-start gap-1.5 text-emerald-700"><CheckCircle2 className="mt-0.5 shrink-0" size={15} /><span>Точка выбрана на карте.</span></p>}
        {geocodeState.type === "error" && <p className="flex items-start gap-1.5 text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={15} /><span>{geocodeState.message}</span></p>}
      </div>
    </div>
    {mapPickerOpen && <DealerMapPicker apiKey={yandexMapsApiKey} city={city} address={address} initialLatitude={latitude} initialLongitude={longitude} onClose={() => setMapPickerOpen(false)} onSelect={setMapCoordinates} />}
    <label className="grid gap-1 text-xs text-muted-foreground">Ценовой уровень<select className={input} name="priceTier" defaultValue="dealer" required><option value="dealer">Дилерский прайс</option><option value="dagestan">Дагестанский прайс</option><option value="wholesale">Оптовый прайс</option></select></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Резервная скидка от РРЦ, %<input className={input} type="number" min="0" max="80" step="0.1" name="discountPercent" defaultValue="0" required /><span className="text-[10px] leading-4">Применится только к товарам, которых нет в выбранном прайсе.</span></label>
    <label className="grid gap-1 text-xs text-muted-foreground">Тип точки<select className={input} name="kind" defaultValue="store" required><option value="store">Магазин</option><option value="installation">Установочный центр</option><option value="store_install">Магазин / Установочный центр</option></select></label>
    <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="authorizedInstallation" /> Авторизованная установка — гарантия 24 месяца</label>
    {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>}
    {state.ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"><p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 size={17} /> Дилер создан</p><p className="mt-2 flex items-center gap-2 text-xs text-emerald-700">{state.mailSent ? <><MailCheck size={15} /> Ссылка отправлена на email.</> : <><MailWarning size={15} /> Почта не отправилась — передайте ссылку вручную.</>}</p>{state.inviteUrl && <div className="mt-3 flex gap-2"><input readOnly value={state.inviteUrl} className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-xs" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(state.inviteUrl!); setCopied(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"><Copy size={14} /> {copied ? "Скопировано" : "Копировать"}</button></div>}</div>}
    <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 text-sm font-bold text-white sm:col-span-2 sm:justify-self-start">{pending && <LoaderCircle className="animate-spin" size={17} />} Создать и отправить доступ</button>
  </form>;
}
