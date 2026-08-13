"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const slides = 3;

/*
  Высота слайда — min-h, а не h: на узком экране заголовок с описанием
  в 200px не помещался и обрезался краем overflow-hidden. Слайды лежат
  во flex-треке и тянутся до общей высоты, поэтому карусель не прыгает.
*/

export function BannerCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const next = (i + slides) % slides;
    setCurrent(next);
    track.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
  }

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const track = trackRef.current;
    if (!track) return;
    let timer = setInterval(() => {
      setCurrent((c) => {
        const next = (c + 1) % slides;
        track.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
        return next;
      });
    }, 6000);
    const stop = () => clearInterval(timer);
    const start = () => {
      timer = setInterval(() => {
        setCurrent((c) => {
          const next = (c + 1) % slides;
          track.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
          return next;
        });
      }, 6000);
    };
    track.addEventListener("pointerenter", stop);
    track.addEventListener("pointerleave", start);
    return () => {
      clearInterval(timer);
      track.removeEventListener("pointerenter", stop);
      track.removeEventListener("pointerleave", start);
    };
  }, []);

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== current) setCurrent(i);
  }

  return (
    <div className="banner-carousel">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="карусель"
        aria-label="Акции и подборки"
      >
        {/* Слайд 1: родной баннер бренда */}
        <div className="relative flex min-h-[clamp(200px,26vw,340px)] w-full shrink-0 snap-start items-center overflow-hidden rounded-md border border-border">
          <Image
            src="/banner1.jpg"
            alt="Сабвуферы MOMO"
            fill
            priority
            className="object-cover"
          />
          <Link
            href="/catalog/sabvufery"
            className="absolute bottom-8 left-10 z-[2] inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
          >
            К сабвуферам
          </Link>
        </div>

        {/* Слайд 2: сплит */}
        <div className="relative flex min-h-[clamp(200px,26vw,340px)] w-full shrink-0 snap-start items-center overflow-hidden rounded-md border border-border text-[#f5f3ef] [background:radial-gradient(120%_180%_at_85%_20%,rgba(255,85,0,0.22),transparent_55%),linear-gradient(115deg,#101012_0%,#1b1b1f_60%,#232327_100%)]">
          <div className="relative z-[2] max-w-[640px] px-6 py-8 sm:px-12 sm:py-0">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] opacity-75">
              Оплата частями
            </p>
            <p className="mt-3 font-display text-[clamp(1.3rem,3.4vw,2.4rem)] font-extrabold uppercase leading-tight">
              Сплит 0% — 4 платежа
            </p>
            <p className="mt-3 max-w-[42ch] text-[0.95rem] opacity-85">
              Забирайте комплект сейчас, платите по четверти суммы раз в две
              недели. Без процентов и переплат.
            </p>
            <Link
              href="/#promo"
              className="mt-5 inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Как это работает
            </Link>
          </div>
        </div>

        {/* Слайд 3: новинки */}
        <div className="relative flex min-h-[clamp(200px,26vw,340px)] w-full shrink-0 snap-start items-center overflow-hidden rounded-md border border-border text-white [background:radial-gradient(140%_200%_at_15%_110%,rgba(0,0,0,0.28),transparent_60%),var(--color-signal)]">
          <div className="relative z-[2] max-w-[640px] px-6 py-8 sm:px-12 sm:py-0">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] opacity-75">
              Новинки 2026
            </p>
            <p className="mt-3 font-display text-[clamp(1.3rem,3.4vw,2.4rem)] font-extrabold uppercase leading-tight">
              FR-500 и BD-1500.1
            </p>
            <p className="mt-3 max-w-[42ch] text-[0.95rem] opacity-90">
              Два новых моноблока MOMO уже приехали и доступны для заказа.
            </p>
            <Link
              href="/news/novinki-momo-2026"
              className="mt-5 inline-flex rounded-sm bg-[#141416] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Смотреть новинки
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2.5">
        <button
          onClick={() => goTo(current - 1)}
          aria-label="Предыдущий баннер"
          className="tap-44 relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
        >
          ←
        </button>
        {/*
          Чёрточки рисуются в три пикселя высотой — попасть по такой пальцем
          нельзя вовсе. Вид оставляем, а область нажатия растягиваем до 44px
          невидимым псевдоэлементом (.tap-44 в globals.css). Промежуток между
          ними при этом ровно 44px: вплотную, но без наложения — иначе соседняя
          чёрточка перехватывала бы касание.
        */}
        <span className="flex items-center gap-4">
          {Array.from({ length: slides }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Баннер ${i + 1}`}
              className={cn(
                "tap-44 relative h-[3px] w-7 rounded-sm transition-colors",
                i === current ? "bg-signal" : "bg-border",
              )}
            />
          ))}
        </span>
        <button
          onClick={() => goTo(current + 1)}
          aria-label="Следующий баннер"
          className="tap-44 relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
        >
          →
        </button>
      </div>
    </div>
  );
}
