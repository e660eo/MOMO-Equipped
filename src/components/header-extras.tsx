"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check, LoaderCircle, Search } from "lucide-react";
import {
  CITY_CENTER_STORAGE_KEY,
  CITY_CHANGE_EVENT,
  CITY_STORAGE_KEY,
  findRussianCities,
  POPULAR_RUSSIAN_CITIES,
  type CityCenter,
  type RussianCityOption,
} from "@/lib/city-selection";
import SpecularButton from "./ui/SpecularButton";

// Махачкала первой: здесь магазин и склад, отсюда идёт доставка.
// Дефолт «Москва» противоречил адресу в футере и на контактах.
// Выбор города — стоит слева в нав-ряду, рядом с пунктами меню.
export function CityPicker({
  variant = "desktop",
  onChoose,
}: {
  variant?: "desktop" | "mobile";
  onChoose?: () => void;
}) {
  const [city, setCity] = useState("Махачкала");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<RussianCityOption[] | null>(null);
  const [results, setResults] = useState<RussianCityOption[]>([]);
  const [message, setMessage] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = `city-picker-panel-${variant}`;
  const inputId = `city-search-${variant}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CITY_STORAGE_KEY);
      if (saved) setCity(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const syncCity = (event: Event) => {
      const selected = (event as CustomEvent<Partial<CityCenter>>).detail?.city;
      if (typeof selected === "string" && selected.trim()) setCity(selected);
    };
    window.addEventListener(CITY_CHANGE_EVENT, syncCity);
    return () => window.removeEventListener(CITY_CHANGE_EVENT, syncCity);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || directory) return;
    let cancelled = false;
    setDirectoryLoading(true);
    void fetch("/data/russian-cities.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("Справочник городов не загрузился.");
        return (await response.json()) as RussianCityOption[];
      })
      .then((items) => {
        if (cancelled) return;
        setDirectory(items);
        setDirectoryLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDirectoryLoading(false);
        setMessage("Не удалось загрузить справочник. Популярные города доступны ниже.");
      });
    return () => {
      cancelled = true;
    };
  }, [directory, open]);

  function choose(c: string, center?: Omit<CityCenter, "city">) {
    const selected = c.trim();
    if (!selected) return;
    setCity(selected);
    setOpen(false);
    setQuery("");
    setResults([]);
    setMessage("");
    onChoose?.();
    try {
      localStorage.setItem(CITY_STORAGE_KEY, selected);
      if (center) {
        localStorage.setItem(
          CITY_CENTER_STORAGE_KEY,
          JSON.stringify({ city: selected, ...center }),
        );
      } else {
        localStorage.removeItem(CITY_CENTER_STORAGE_KEY);
      }
      window.dispatchEvent(
        new CustomEvent(CITY_CHANGE_EVENT, {
          detail: { city: selected, ...(center ?? {}) },
        }),
      );
    } catch {}
  }

  function findCities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = query.trim();
    if (clean.length < 2) {
      setMessage("Введите хотя бы две буквы.");
      return;
    }

    if (!directory) {
      setMessage("Справочник ещё загружается. Попробуйте через секунду.");
      return;
    }
    const found = findRussianCities(directory, clean);
    setResults(found);
    setMessage(found.length ? `Найдено: ${found.length}` : "Город не найден. Проверьте название.");
  }

  return (
    <div ref={ref} className={variant === "mobile" ? "relative border-b border-border py-1" : "relative"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[0.82rem] font-medium text-muted-foreground transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${variant === "mobile" ? "w-full justify-between" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin size={15} className="shrink-0 text-signal" aria-hidden />
          <span className="max-w-48 truncate sm:max-w-56" title={city}>{city}</span>
        </span>
        <ChevronDown
          size={14}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
          aria-hidden
        />
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label="Выбор города России" className={`${variant === "mobile" ? "relative mb-2 mt-1 w-full shadow-none" : "absolute left-0 top-[calc(100%+4px)] z-50 w-[min(21rem,calc(100vw-2rem))] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"} overflow-hidden rounded-xl border border-border bg-surface`}>
          <form onSubmit={findCities} className="border-b border-border p-3">
            <label htmlFor={inputId} className="text-xs font-semibold">Любой город России</label>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} aria-hidden />
                <input ref={inputRef} id={inputId} type="search" autoComplete="address-level2" value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setMessage(""); }} placeholder="Например, Тверь" className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-base outline-none transition-colors focus:border-signal sm:text-sm" />
              </div>
              <button type="submit" disabled={directoryLoading || query.trim().length < 2} className="inline-flex h-11 min-w-20 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-signal px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
                {directoryLoading ? <LoaderCircle className="animate-spin" size={16} aria-hidden /> : <Search size={16} aria-hidden />}
                Найти
              </button>
            </div>
            <p className="mt-2 min-h-4 text-xs text-muted-foreground" aria-live="polite">{directoryLoading ? "Загружаем справочник…" : message}</p>
          </form>

          <div className="max-h-[min(24rem,55vh)] overflow-y-auto py-1" id={`city-search-results-${variant}`}>
            {results.length > 0 ? results.map((result) => (
              <button key={`${result.city}:${result.region}`} type="button" onClick={() => choose(result.city, { lat: result.lat, long: result.long })} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[.035] hover:text-signal focus-visible:bg-black/[.035] focus-visible:outline-none">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{result.city}</span>
                  <span className="block truncate text-xs text-muted-foreground">{result.region}</span>
                </span>
                {result.city === city && <Check size={16} className="shrink-0 text-signal" aria-hidden />}
              </button>
            )) : POPULAR_RUSSIAN_CITIES.map((item) => (
              <button key={item.city} type="button" onClick={() => choose(item.city)} className="flex min-h-11 w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/[.035] hover:text-signal focus-visible:bg-black/[.035] focus-visible:outline-none">
                {item.city}
                {item.city === city && <Check size={15} className="text-signal" aria-hidden />}
              </button>
            ))}
          </div>
          <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">Справочник: <a href="https://github.com/hflabs/city" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-signal">HFLabs / DaData</a></p>
        </div>
      )}
    </div>
  );
}

// Плашки справа в нав-ряду — с эффектом SpecularButton.
export function HeaderExtras() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <SpecularButton
        size="sm"
        radius={9}
        tint="#ff5500"
        tintOpacity={1}
        textColor="#ffffff"
        lineColor="#ffffff"
        baseColor="#b23a00"
        intensity={1.1}
        followMouse
        proximity={220}
        className="!py-2 !text-[0.8rem]"
        onClick={() => router.push("/become-dealer")}
      >
        Стать дилером
      </SpecularButton>
      <SpecularButton
        size="sm"
        radius={9}
        tint="#18181b"
        tintOpacity={1}
        textColor="#f5f5f5"
        lineColor="#ff7a33"
        baseColor="#3f3f46"
        intensity={1.15}
        followMouse
        proximity={220}
        className="!py-2 !text-[0.8rem]"
        onClick={() => router.push("/dealers")}
      >
        Купить рядом
      </SpecularButton>
    </div>
  );
}
