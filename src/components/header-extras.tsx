"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";
import SpecularButton from "./ui/SpecularButton";

// Махачкала первой: здесь магазин и склад, отсюда идёт доставка.
// Дефолт «Москва» противоречил адресу в футере и на контактах.
const cities = [
  "Махачкала",
  "Москва",
  "Санкт-Петербург",
  "Краснодар",
  "Ростов-на-Дону",
  "Казань",
  "Екатеринбург",
  "Новосибирск",
];

// Выбор города — стоит слева в нав-ряду, рядом с пунктами меню.
export function CityPicker() {
  const [city, setCity] = useState("Махачкала");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("momo-city");
      if (saved) setCity(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(c: string) {
    setCity(c);
    setOpen(false);
    try {
      localStorage.setItem("momo-city", c);
    } catch {}
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-muted-foreground transition-colors hover:text-signal"
        aria-expanded={open}
      >
        <MapPin size={15} className="text-signal" />
        {city}
        <ChevronDown
          size={14}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => choose(c)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:text-signal"
            >
              {c}
              {c === city && <Check size={15} className="text-signal" />}
            </button>
          ))}
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
        onClick={() => router.push("/dealers")}
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
        onClick={() => router.push("/install")}
      >
        Где установить
      </SpecularButton>
    </div>
  );
}
