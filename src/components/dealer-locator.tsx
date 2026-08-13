"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock, LocateFixed, MapPin, Phone, Wrench } from "lucide-react";
import type { DealerLocation } from "@/lib/types";

function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function DealerLocator({ dealers }: { dealers: DealerLocation[] }) {
  const cities = useMemo(() => [...new Set(dealers.map((dealer) => dealer.city))].sort((a, b) => a.localeCompare(b, "ru")), [dealers]);
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("momo-city");
      if (saved && cities.includes(saved)) setCity(saved);
    } catch {}
  }, [cities]);

  function chooseCity(value: string) {
    setCity(value);
    try { if (value) localStorage.setItem("momo-city", value); } catch {}
  }

  function locate() {
    if (!navigator.geolocation) {
      setGeoMessage("Браузер не поддерживает определение местоположения. Выберите город вручную.");
      return;
    }
    setGeoMessage("Определяем ближайшую точку…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const withCoords = dealers.filter((dealer): dealer is DealerLocation & { latitude: number; longitude: number } => Number.isFinite(dealer.latitude) && Number.isFinite(dealer.longitude));
        if (!withCoords.length) {
          setGeoMessage("У опубликованных точек пока нет координат. Выберите город вручную.");
          return;
        }
        const nearest = withCoords.reduce((best, dealer) => distance(coords, dealer) < distance(coords, best) ? dealer : best);
        chooseCity(nearest.city);
        const km = Math.round(distance(coords, nearest));
        setGeoMessage(`Ближайшая опубликованная точка — ${nearest.city}${km ? `, около ${km} км` : ""}.`);
      },
      () => setGeoMessage("Доступ к геопозиции не разрешён. Выберите город вручную."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = dealers.filter((dealer) => {
    if (city && dealer.city !== city) return false;
    if (needle && !`${dealer.name} ${dealer.city} ${dealer.address}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  return <div>
    <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-[0.72rem] font-medium uppercase tracking-wider text-muted-foreground">Город<select value={city} onChange={(event) => chooseCity(event.target.value)} className="mt-1.5 w-full rounded-sm border border-input bg-bg px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"><option value="">Все города</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="text-[0.72rem] font-medium uppercase tracking-wider text-muted-foreground">Поиск<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или адрес" className="mt-1.5 w-full rounded-sm border border-input bg-bg px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-signal" /></label>
      <button type="button" onClick={locate} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold transition hover:border-signal hover:text-signal"><LocateFixed size={16} /> Определить</button>
    </div>
    {geoMessage && <p className="mt-3 text-sm text-muted-foreground" role="status">{geoMessage}</p>}

    {shown.length ? <div className="mt-7 grid gap-4 md:grid-cols-2">{shown.map((dealer) => <article key={dealer.id} className="group rounded-xl border border-border bg-surface p-6 transition hover:border-signal/50">
      <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-signal">Официальная точка</p><h2 className="mt-2 font-display text-lg font-bold">{dealer.name}</h2></div><BadgeCheck size={22} className="shrink-0 text-signal" /></div>
      <ul className="mt-5 space-y-3 text-sm"><li className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-signal" /><span><b className="font-medium">{dealer.city}</b>, {dealer.address}</span></li>{dealer.hours && <li className="flex gap-2.5 text-muted-foreground"><Clock size={16} className="mt-0.5 shrink-0" />{dealer.hours}</li>}{dealer.authorizedInstallation && <li className="flex gap-2.5 text-muted-foreground"><Wrench size={16} className="mt-0.5 shrink-0" />Авторизованная установка</li>}</ul>
      <div className="mt-6 flex flex-wrap gap-2"><a href={`tel:${dealer.phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-foreground px-4 text-sm font-semibold text-bg"><Phone size={15} /> Позвонить</a>{dealer.website && <a href={dealer.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-sm border border-border px-4 text-sm font-semibold hover:border-signal hover:text-signal">Сайт ↗</a>}</div>
      <p className="mt-3 text-[0.72rem] text-muted-foreground">Наличие и время визита уточняйте у точки.</p>
    </article>)}</div> : <div className="mt-7 rounded-xl border border-dashed border-border p-8 text-center"><p className="font-display text-lg font-bold">Точек по выбранным условиям пока нет</p><p className="mx-auto mt-2 max-w-[50ch] text-sm text-muted-foreground">Сбросьте фильтр или напишите нам — подскажем доставку и ближайшего партнёра.</p></div>}
  </div>;
}
