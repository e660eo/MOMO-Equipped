"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const slideCount = 3;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BannerCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;

    const next = (index + slideCount) % slideCount;
    setCurrent(next);
    track.scrollTo({
      left: track.clientWidth * next,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;

    const timer = window.setInterval(() => {
      setCurrent((active) => {
        const next = (active + 1) % slideCount;
        const track = trackRef.current;
        track?.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
        return next;
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [paused]);

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;

    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== current && next >= 0 && next < slideCount) setCurrent(next);
  }

  return (
    <div
      className="group/banner relative"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(current - 1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            goTo(current + 1);
          }
        }}
        tabIndex={0}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[22px] border border-black/10 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.75)] outline-none ring-signal/60 transition-shadow focus-visible:ring-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="карусель"
        aria-label="Продукция MOMO и ZEUS"
      >
        <article
          className="relative min-h-[560px] w-full shrink-0 snap-start overflow-hidden bg-[#111214] text-white sm:min-h-[440px] lg:aspect-[7/2] lg:min-h-[360px]"
          aria-label="1 из 3: новые моноблоки MOMO"
        >
          <div aria-hidden className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div aria-hidden className="absolute -right-[18%] bottom-[-22%] h-[74%] w-[118%] rounded-[50%] bg-[#f05a1a] sm:-right-[12%] sm:bottom-[-50%] sm:h-[145%] sm:w-[67%]" />
          <div aria-hidden className="absolute right-5 top-5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-white/45 sm:right-9 sm:top-7">
            MOMO / POWER LAB 01
          </div>

          <div className="relative z-20 flex h-full max-w-[610px] flex-col items-start px-6 pb-[270px] pt-12 sm:justify-center sm:px-14 sm:py-10 lg:px-16">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#ff8247]">
              Новинки · уже на складе
            </p>
            <h2 className="mt-4 w-full max-w-[12ch] font-display text-[clamp(2.2rem,5.2vw,4.3rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.045em]">
              Новый уровень усиления
            </h2>
            <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-white/68 sm:text-[0.96rem]">
              Компактный FR-500 и мощный BD-1500.1 — два моноблока MOMO для систем с разным запасом мощности.
            </p>
            <Link
              href="/catalog/usiliteli-monobloki"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#f05a1a] px-6 text-sm font-semibold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#ff6b28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Смотреть моноблоки
            </Link>
          </div>

          <div aria-hidden className="absolute bottom-2 left-[5%] h-[250px] w-[90%] sm:-bottom-[8%] sm:left-auto sm:right-[2%] sm:h-[112%] sm:w-[57%]">
            <div className="absolute bottom-0 right-[-4%] h-[92%] w-[68%] -rotate-6">
              <Image
                src="/uploads/momo-bd-1500-1-cutout.png"
                alt=""
                fill
                sizes="(max-width: 639px) 60vw, 34vw"
                className="object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.35)]"
              />
            </div>
            <div className="absolute -bottom-[4%] left-[2%] h-[67%] w-[45%] rotate-6">
              <Image
                src="/uploads/momo-fr-500-cutout.png"
                alt=""
                fill
                sizes="(max-width: 639px) 42vw, 24vw"
                className="object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.3)]"
              />
            </div>
          </div>
        </article>

        <article
          className="relative min-h-[560px] w-full shrink-0 snap-start overflow-hidden bg-[#efede7] text-[#121315] sm:min-h-[440px] lg:aspect-[7/2] lg:min-h-[360px]"
          aria-label="2 из 3: сабвуфер MOMO ACHILLES 12"
        >
          <div aria-hidden className="absolute -bottom-[24%] -right-[10%] aspect-square w-[84%] rounded-full border-[44px] border-[#f05a1a] opacity-95 sm:-bottom-[82%] sm:-right-[4%] sm:w-[64%] sm:border-[72px]" />
          <div aria-hidden className="absolute right-5 top-5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-black/40 sm:right-9 sm:top-7">
            MOMO / SUB LAB 02
          </div>

          <div className="relative z-20 flex h-full max-w-[610px] flex-col items-start px-6 pb-[280px] pt-12 sm:justify-center sm:px-14 sm:py-10 lg:px-16">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c6440c]">
              Флагманский сабвуфер
            </p>
            <h2 className="mt-4 w-full max-w-[11ch] font-display text-[clamp(2rem,5.4vw,4.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.055em]">
              Бас без компромиссов
            </h2>
            <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-black/62 sm:text-[0.96rem]">
              MOMO ACHILLES 12 — сабвуфер для системы, в которой низкие частоты должны ощущаться физически.
            </p>
            <Link
              href="/product/sabvufer-avtomobilnyy-achilles-12-dyuymov-902295"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#121315] px-6 text-sm font-semibold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#2c2d30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a1a]"
            >
              Открыть ACHILLES 12
            </Link>
          </div>

          <div aria-hidden className="absolute bottom-0 left-[12%] h-[260px] w-[76%] sm:-bottom-[14%] sm:left-auto sm:right-[2%] sm:h-[118%] sm:w-[55%]">
            <div className="absolute inset-0">
              <Image
                src="/uploads/momo-achilles-12-cutout.png"
                alt=""
                fill
                sizes="(max-width: 639px) 76vw, 42vw"
                className="object-contain drop-shadow-[0_28px_32px_rgba(0,0,0,0.23)]"
              />
            </div>
            <span className="absolute bottom-[4%] right-0 font-display text-[5rem] font-extrabold leading-none tracking-[-0.08em] text-[#f05a1a] sm:bottom-[20%] sm:text-[7.5rem]">
              12
            </span>
          </div>
        </article>

        <article
          className="relative min-h-[560px] w-full shrink-0 snap-start overflow-hidden bg-[#f05a1a] text-[#111214] sm:min-h-[440px] lg:aspect-[7/2] lg:min-h-[360px]"
          aria-label="3 из 3: усилитель ZEUS FR-2.1100"
        >
          <div aria-hidden className="absolute inset-y-0 right-0 w-[55%] bg-[#111214] [clip-path:polygon(25%_0,100%_0,100%_100%,0_100%)] max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-[47%] max-sm:w-full max-sm:[clip-path:polygon(0_18%,100%_0,100%_100%,0_100%)]" />
          <div aria-hidden className="absolute left-5 top-5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-black/45 sm:left-auto sm:right-9 sm:top-7 sm:text-white/42">
            ZEUS / POWER LAB 03
          </div>

          <div className="relative z-20 flex h-full max-w-[610px] flex-col items-start px-6 pb-[270px] pt-12 sm:justify-center sm:px-14 sm:py-10 lg:px-16">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-black/62">
              Усилители ZEUS
            </p>
            <h2 className="mt-4 w-full max-w-[10ch] font-display text-[clamp(2.25rem,5.4vw,4.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.055em]">
              Мощность под контролем
            </h2>
            <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-black/68 sm:text-[0.96rem]">
              ZEUS FR-2.1100 — усилитель для уверенной и стабильной работы автомобильной аудиосистемы.
            </p>
            <Link
              href="/product/usilitel-avtomobilnyy-zeus-fr-2-1100-421465"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#111214] px-6 text-sm font-semibold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#2c2d30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Открыть FR-2.1100
            </Link>
          </div>

          <div aria-hidden className="absolute bottom-[12px] left-[6%] h-[220px] w-[88%] sm:bottom-[2%] sm:left-auto sm:right-[2%] sm:h-[90%] sm:w-[53%]">
            <span className="absolute -right-[2%] top-[10%] font-display text-[5.5rem] font-extrabold leading-none tracking-[-0.08em] text-white/[0.08] sm:text-[8.5rem]">
              ZEUS
            </span>
            <div className="absolute inset-[8%_2%_0_6%]">
              <Image
                src="/uploads/zeus-fr-2-1100-cutout.png"
                alt=""
                fill
                sizes="(max-width: 639px) 82vw, 44vw"
                className="object-contain drop-shadow-[0_28px_36px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
        </article>
      </div>

      <button
        type="button"
        onClick={() => goTo(current - 1)}
        aria-label="Предыдущий баннер"
        className="absolute left-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl text-white shadow-lg backdrop-blur-sm transition-[background-color,transform] hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:inline-flex"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => goTo(current + 1)}
        aria-label="Следующий баннер"
        className="absolute right-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl text-white shadow-lg backdrop-blur-sm transition-[background-color,transform] hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:inline-flex"
      >
        →
      </button>

      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 shadow-lg backdrop-blur-sm">
        {Array.from({ length: slideCount }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Показать баннер ${index + 1}`}
            aria-current={index === current ? "true" : undefined}
            className="tap-44 relative flex h-2.5 w-8 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span
              className={cn(
                "h-1 w-full rounded-full transition-colors",
                index === current ? "bg-[#f05a1a]" : "bg-white/35 hover:bg-white/65",
              )}
            />
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        Показан баннер {current + 1} из {slideCount}
      </p>
    </div>
  );
}
