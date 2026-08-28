"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Headphones,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { AddToCartButton } from "./add-to-cart-button";
import { formatPrice, isInStock, productImageUrl } from "@/lib/format";
import {
  hasPublishedListeningAudio,
  listeningAudioUrl,
  REFERENCE_TRACK_URL,
} from "@/lib/listening-stand";
import type { Product } from "@/lib/types";

const wave = [28, 52, 38, 76, 44, 90, 58, 34, 68, 48, 82, 40, 62, 96, 54, 72, 36, 84, 46, 66, 32, 74, 50, 88, 42, 64, 30, 78, 56, 92, 48, 70, 36, 86, 52, 68, 40, 80, 46, 60];

function timeLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function Score({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[0.72rem]">
        <span className="font-semibold uppercase tracking-[0.12em] text-white/58">{label}</span>
        <span className="font-mono font-bold tabular-nums text-white">
          {value === undefined ? "—" : `${value}/10`}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-[#ff5500] transition-[width] duration-500"
          style={{ width: value === undefined ? "0%" : `${value * 10}%` }}
        />
      </div>
    </div>
  );
}

export function ListeningStand({ products }: { products: Product[] }) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [onlyRecorded, setOnlyRecorded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const selected = products.find((product) => product.slug === selectedSlug) ?? products[0];
  const ownRecording = selected ? listeningAudioUrl(selected) : undefined;
  const audioSource = ownRecording ?? REFERENCE_TRACK_URL;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return products.filter((product) => {
      if (brand !== "all" && product.brand.toUpperCase() !== brand) return false;
      if (onlyRecorded && !hasPublishedListeningAudio(product)) return false;
      return !normalized || `${product.brand} ${product.title}`.toLocaleLowerCase("ru-RU").includes(normalized);
    });
  }, [brand, onlyRecorded, products, query]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.load();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioSource, selectedSlug]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  if (!selected) return null;
  const available = isInStock(selected);

  return (
    <div className="mt-9 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 rounded-[22px] border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Найти динамик</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти модель MOMO или ZEUS"
              className="min-h-11 w-full rounded-full border border-border bg-bg py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-signal"
            />
          </label>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 md:w-36 md:flex-none">
              <SlidersHorizontal size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Бренд</span>
              <select
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                className="min-h-11 w-full appearance-none rounded-full border border-border bg-bg py-2 pl-9 pr-4 text-[0.78rem] font-semibold outline-none focus:border-signal"
              >
                <option value="all">Все бренды</option>
                <option value="MOMO">MOMO</option>
                <option value="ZEUS">ZEUS</option>
              </select>
            </label>
            <button
              type="button"
              aria-pressed={onlyRecorded}
              onClick={() => setOnlyRecorded((value) => !value)}
              className={`min-h-11 rounded-full border px-4 text-[0.75rem] font-semibold transition ${
                onlyRecorded
                  ? "border-signal bg-signal text-white"
                  : "border-border bg-bg text-muted-foreground hover:border-signal hover:text-signal"
              }`}
            >
              С записью
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="font-label text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Выберите динамик
          </p>
          <span className="text-[0.72rem] tabular-nums text-muted-foreground">
            {filtered.length} из {products.length}
          </span>
        </div>

        {filtered.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => {
              const active = selected.slug === product.slug;
              const recorded = hasPublishedListeningAudio(product);
              return (
                <article
                  key={product.slug}
                  className={`group relative overflow-hidden rounded-[16px] border transition ${
                    active
                      ? "border-signal bg-signal/[0.055] shadow-[0_0_0_1px_rgba(255,85,0,.22)]"
                      : "border-border bg-bg hover:-translate-y-0.5 hover:border-signal/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(product.slug)}
                    aria-pressed={active}
                    className="block w-full p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal"
                  >
                    <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[12px] bg-tile">
                      <Image
                        src={productImageUrl(product.image)}
                        alt=""
                        width={240}
                        height={240}
                        sizes="(max-width: 640px) 42vw, (max-width: 1280px) 25vw, 180px"
                        className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.04]"
                      />
                      <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.58rem] font-bold uppercase tracking-wider ${recorded ? "bg-[#17191c] text-white" : "bg-white/90 text-[#65666a]"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${recorded ? "bg-signal" : "bg-[#b7b7b7]"}`} />
                        {recorded ? "Есть запись" : "Готовится"}
                      </span>
                    </span>
                    <span className="mt-3 block text-[0.62rem] font-bold uppercase tracking-[0.15em] text-signal">
                      {product.brand}
                    </span>
                    <strong className="mt-1 line-clamp-2 block min-h-[2.5rem] text-[0.78rem] font-semibold leading-[1.25rem]">
                      {product.title}
                    </strong>
                    <span className="mt-2 block font-display text-[0.76rem] font-extrabold">
                      {formatPrice(product.price)}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-dashed border-border px-5 py-12 text-center">
            <p className="text-sm font-semibold">Таких моделей пока нет</p>
            <button type="button" onClick={() => { setQuery(""); setBrand("all"); setOnlyRecorded(false); }} className="mt-2 text-[0.78rem] font-semibold text-signal hover:underline">
              Сбросить фильтры
            </button>
          </div>
        )}
      </section>

      <aside className="overflow-hidden rounded-[22px] bg-[#111214] text-white shadow-[0_24px_70px_-34px_rgba(0,0,0,.7)] lg:sticky lg:top-32">
        <div className="relative border-b border-white/10 p-4 sm:p-5">
          <div aria-hidden className="absolute right-5 top-5 flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_10px_#ff5500]" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          </div>
          <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.24em] text-white/45">
            MOMO listening bench
          </p>
          <div className="mt-4 grid grid-cols-[88px_1fr] items-center gap-4">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#181a1e] shadow-[inset_0_0_0_8px_#0c0d0f,inset_0_0_30px_rgba(255,255,255,.06)]">
              <Image
                src={productImageUrl(selected.image)}
                alt=""
                width={150}
                height={150}
                className="h-[74%] w-[74%] object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-signal">{selected.brand}</p>
              <h2 className="mt-1 line-clamp-2 font-display text-[0.9rem] font-bold leading-snug">{selected.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] text-white/50">
                <span>{available === false ? "Под заказ" : available === true ? "В наличии" : "Наличие уточняется"}</span>
                <span aria-hidden>·</span>
                <span className="font-semibold text-white">{formatPrice(selected.price)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex h-20 items-center gap-[3px] overflow-hidden rounded-[12px] border border-white/[0.07] bg-[#0b0c0e] px-3" aria-hidden>
            {wave.map((height, index) => (
              <span
                key={index}
                className={`flex-1 rounded-full bg-gradient-to-t from-[#ff5500]/30 via-[#ff5500] to-[#ffb18b] ${playing ? "animate-[pulse_1s_ease-in-out_infinite]" : "opacity-55"}`}
                style={{ height: `${Math.max(10, height * (playing ? 1 : 0.55))}%`, animationDelay: `${index * -35}ms` }}
              />
            ))}
          </div>

          <audio
            ref={audioRef}
            src={audioSource}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playing ? "Пауза" : "Слушать"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-signal text-white transition hover:scale-105 hover:bg-[#ff6a1f] active:scale-95"
            >
              {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="translate-x-px" />}
            </button>
            <div className="min-w-0 flex-1">
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.01)}
                step={0.01}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (audioRef.current) audioRef.current.currentTime = value;
                  setCurrentTime(value);
                }}
                aria-label="Позиция воспроизведения"
                className="h-1 w-full cursor-pointer accent-[#ff5500]"
              />
              <div className="mt-1 flex justify-between font-mono text-[0.62rem] tabular-nums text-white/42">
                <span>{timeLabel(currentTime)}</span>
                <span>{timeLabel(duration)}</span>
              </div>
            </div>
            <label className="hidden items-center gap-2 sm:flex">
              <Volume2 size={15} className="text-white/48" />
              <span className="sr-only">Громкость</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                defaultValue={0.8}
                onChange={(event) => {
                  if (audioRef.current) audioRef.current.volume = Number(event.target.value);
                }}
                className="h-1 w-16 accent-[#ff5500]"
              />
            </label>
          </div>

          <div className={`mt-4 rounded-[12px] border p-3 text-[0.7rem] leading-relaxed ${ownRecording ? "border-signal/25 bg-signal/[0.08] text-white/66" : "border-white/10 bg-white/[0.035] text-white/55"}`}>
            <span className="flex items-start gap-2">
              <Headphones size={15} className="mt-0.5 shrink-0 text-signal" />
              <span>
                {ownRecording
                  ? "Запись именно этой модели. Для сравнения используйте одни и те же наушники и громкость."
                  : "Собственная запись модели готовится. Сейчас играет оригинальный референсный трек MOMO без имитации звучания динамика."}
              </span>
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            <Score label="Верха" value={selected.listening?.highs} />
            <Score label="Середина" value={selected.listening?.mids} />
            <Score label="Низы" value={selected.listening?.lows} />
            <Score label="Громкость" value={selected.listening?.volume} />
          </div>

          {selected.listening?.note && (
            <p className="mt-5 border-l-2 border-signal pl-3 text-[0.72rem] leading-relaxed text-white/58">
              {selected.listening.note}
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <Link
              href={`/product/${selected.slug}`}
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-white/15 px-3 text-[0.75rem] font-semibold transition hover:border-signal hover:text-signal"
            >
              Характеристики
            </Link>
            <AddToCartButton product={selected} />
          </div>
        </div>
      </aside>
    </div>
  );
}
