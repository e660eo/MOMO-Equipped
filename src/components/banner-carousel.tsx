"use client";

import Image from "next/image";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { safeHref } from "@/lib/sanitize";
import type { BannerMediaAlign, SiteBanner } from "@/lib/types";
import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const themes = {
  dark: {
    article: "bg-[#111214] text-white",
    eyebrow: "text-[#ff8247]",
    description: "text-white/70",
    button: "bg-[#f05a1a] text-white hover:bg-[#ff6b28] focus-visible:ring-white",
    grid: "opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)]",
    coverOverlay: "from-[#111214]/95 via-[#111214]/70 to-transparent",
  },
  light: {
    article: "bg-[#efede7] text-[#121315]",
    eyebrow: "text-[#c6440c]",
    description: "text-black/65",
    button: "bg-[#121315] text-white hover:bg-[#2c2d30] focus-visible:ring-[#f05a1a]",
    grid: "opacity-30 [background-image:linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)]",
    coverOverlay: "from-[#efede7]/95 via-[#efede7]/70 to-transparent",
  },
  signal: {
    article: "bg-[#f05a1a] text-[#111214]",
    eyebrow: "text-black/65",
    description: "text-black/70",
    button: "bg-[#111214] text-white hover:bg-[#2c2d30] focus-visible:ring-white",
    grid: "opacity-25 [background-image:linear-gradient(rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.08)_1px,transparent_1px)]",
    coverOverlay: "from-[#f05a1a]/95 via-[#f05a1a]/70 to-transparent",
  },
} as const;

function mediaWrapper(fit: SiteBanner["mediaFit"], align: BannerMediaAlign): string {
  if (fit === "cover") return "absolute inset-0";
  return cn(
    "absolute bottom-0 h-[54%] w-full sm:inset-y-0 sm:h-full sm:w-[58%]",
    align === "left" && "sm:left-0",
    align === "center" && "sm:left-1/2 sm:-translate-x-1/2",
    align === "right" && "sm:right-0",
  );
}

function objectPosition(align: BannerMediaAlign): string {
  return align === "left" ? "object-left" : align === "right" ? "object-right" : "object-center";
}

function VideoBannerMedia({
  src,
  label,
  active,
  fit,
  align,
}: {
  src: string;
  label: string;
  active: boolean;
  fit: SiteBanner["mediaFit"];
  align: BannerMediaAlign;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [choice, setChoice] = useState<"auto" | "play" | "pause">("auto");
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const shouldPlay = active && (choice === "play" || (choice === "auto" && !reduced));
    if (!shouldPlay) {
      video.pause();
      setPlaying(false);
      return;
    }
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [active, choice, reduced]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload={active ? "metadata" : "none"}
        aria-label={label}
        className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", objectPosition(align))}
      />
      <button
        type="button"
        onClick={() => setChoice(playing ? "pause" : "play")}
        tabIndex={active ? 0 : -1}
        aria-label={playing ? "Остановить видео" : "Воспроизвести видео"}
        className="absolute bottom-16 right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-5 sm:right-5"
      >
        {playing ? <Pause size={17} /> : <Play size={17} />}
      </button>
    </>
  );
}

function BannerSlide({
  banner,
  index,
  total,
  active,
}: {
  banner: SiteBanner;
  index: number;
  total: number;
  active: boolean;
}) {
  const theme = themes[banner.theme];
  const src = `/media/${banner.media}`;
  const hasCopy = Boolean(banner.eyebrow || banner.heading || banner.description);
  const href = banner.action.href ? safeHref(banner.action.href) : "#";
  const externalProps = banner.action.newTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
  const contentOnRight = banner.mediaFit === "contain" && banner.mediaAlign === "left";

  return (
    <article
      className={cn(
        "relative min-h-[560px] w-full shrink-0 snap-start overflow-hidden sm:min-h-[440px] lg:aspect-[7/2] lg:min-h-[360px]",
        theme.article,
      )}
      aria-label={`${index + 1} из ${total}: ${banner.name}`}
    >
      <div aria-hidden className={cn("absolute inset-0 [background-size:48px_48px]", theme.grid)} />

      <div className={mediaWrapper(banner.mediaFit, banner.mediaAlign)}>
        {banner.mediaType === "image" ? (
          <Image
            src={src}
            alt={banner.alt ?? ""}
            fill
            sizes={banner.mediaFit === "cover" ? "(max-width: 1200px) 100vw, 1200px" : "(max-width: 639px) 100vw, 58vw"}
            className={cn(banner.mediaFit === "cover" ? "object-cover" : "object-contain", objectPosition(banner.mediaAlign))}
          />
        ) : (
          <VideoBannerMedia
            src={src}
            label={banner.alt || banner.name}
            active={active}
            fit={banner.mediaFit}
            align={banner.mediaAlign}
          />
        )}
      </div>

      {banner.mediaFit === "cover" && hasCopy && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0",
            contentOnRight ? "bg-gradient-to-l" : "bg-gradient-to-r",
            theme.coverOverlay,
          )}
        />
      )}

      {hasCopy && (
        <div
          className={cn(
            "relative z-20 flex h-full max-w-[660px] flex-col items-start px-6 pb-[285px] pt-12 sm:justify-center sm:px-14 sm:py-12 lg:px-16",
            banner.mediaFit === "cover" && "pb-28 sm:pb-12",
            contentOnRight && "sm:ml-auto sm:items-end sm:text-right",
          )}
        >
          {banner.eyebrow && (
            <p className={cn("font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em]", theme.eyebrow)}>
              {banner.eyebrow}
            </p>
          )}
          {banner.heading && (
            <h2 className="mt-4 w-full max-w-[12ch] text-balance font-display text-[clamp(1.75rem,7.2vw,4.4rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.05em]">
              {banner.heading}
            </h2>
          )}
          {banner.description && (
            <p className={cn("mt-5 max-w-[42ch] text-sm leading-relaxed sm:text-[0.96rem]", theme.description)}>
              {banner.description}
            </p>
          )}
          {banner.action.kind === "button" && (
            <Link
              href={href}
              {...externalProps}
              tabIndex={active ? 0 : -1}
              className={cn(
                "relative z-40 mt-6 inline-flex min-h-11 items-center rounded-md px-6 text-sm font-semibold transition-[background-color,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2",
                theme.button,
              )}
            >
              {banner.action.label}
            </Link>
          )}
        </div>
      )}

      {!hasCopy && banner.action.kind === "button" && (
        <Link
          href={href}
          {...externalProps}
          tabIndex={active ? 0 : -1}
          className={cn(
            "absolute bottom-16 left-5 z-40 inline-flex min-h-11 items-center rounded-md px-6 text-sm font-semibold shadow-lg transition-[background-color,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 sm:bottom-6 sm:left-7",
            theme.button,
          )}
        >
          {banner.action.label}
        </Link>
      )}

      {banner.action.kind === "banner" && (
        <Link
          href={href}
          {...externalProps}
          tabIndex={active ? 0 : -1}
          aria-label={`Открыть: ${banner.name}`}
          className="absolute inset-0 z-30 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        />
      )}
    </article>
  );
}

export function BannerCarousel({ banners }: { banners: SiteBanner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const count = banners.length;
  const paused = interactionPaused || manualPaused;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      const next = (index + count) % count;
      setCurrent(next);
      track.scrollTo({
        left: track.clientWidth * next,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [count],
  );

  useEffect(() => {
    if (current >= count) setCurrent(0);
  }, [count, current]);

  useEffect(() => {
    if (paused || count <= 1 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setCurrent((active) => {
        const next = (active + 1) % count;
        const track = trackRef.current;
        track?.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
        return next;
      });
    }, 7000);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <div
      className="group/banner relative"
      onPointerEnter={() => setInteractionPaused(true)}
      onPointerLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
      }}
    >
      <div
        ref={trackRef}
        onScroll={() => {
          const track = trackRef.current;
          if (!track) return;
          const next = Math.round(track.scrollLeft / track.clientWidth);
          if (next !== current && next >= 0 && next < count) setCurrent(next);
        }}
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
        aria-label="Баннеры MOMO и ZEUS"
      >
        {banners.map((banner, index) => (
          <BannerSlide key={banner.id} banner={banner} index={index} total={count} active={index === current} />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            aria-label="Предыдущий баннер"
            className="absolute left-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl text-white shadow-lg backdrop-blur-sm transition-[background-color,transform] hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:inline-flex"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            aria-label="Следующий баннер"
            className="absolute right-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl text-white shadow-lg backdrop-blur-sm transition-[background-color,transform] hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:inline-flex"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setManualPaused((value) => !value)}
            aria-label={manualPaused ? "Запустить смену баннеров" : "Остановить смену баннеров"}
            aria-pressed={manualPaused}
            className="absolute right-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {manualPaused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 shadow-lg backdrop-blur-sm">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Показать баннер ${index + 1}: ${banner.name}`}
                aria-current={index === current ? "true" : undefined}
                className="tap-44 relative flex h-2.5 w-8 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className={cn("h-1 w-full rounded-full transition-colors", index === current ? "bg-[#f05a1a]" : "bg-white/35 hover:bg-white/65")} />
              </button>
            ))}
          </div>
        </>
      )}

      <p className="sr-only" aria-live="polite">
        Показан баннер {current + 1} из {count}
      </p>
    </div>
  );
}
