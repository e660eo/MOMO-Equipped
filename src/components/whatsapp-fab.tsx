"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Плавающая кнопка WhatsApp — основной канал продаж магазина.
 *
 * Появляется не сразу, а после небольшой прокрутки: на первом экране она
 * спорила бы с кнопками hero. Подсказка рядом показывается один раз за сессию,
 * чтобы не мозолить глаза при каждом скролле.
 */
export function WhatsAppFab() {
  const [visible, setVisible] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > 600;
      setVisible(past);
      if (past && !sessionStorage.getItem("momo-wa-hint")) {
        sessionStorage.setItem("momo-wa-hint", "1");
        setHintOpen(true);
        setTimeout(() => setHintOpen(false), 6000);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        // z ниже корзины (100) и её затемнения (90): при открытой панели
        // кнопка должна уходить под неё, а не висеть поверх
        "fixed bottom-5 right-5 z-[80] flex items-center gap-3 transition-all duration-300",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      {hintOpen && (
        <span className="hidden rounded-xl border border-border bg-surface px-4 py-2.5 text-[0.82rem] shadow-[0_14px_40px_-16px_rgba(0,0,0,0.35)] sm:block">
          Поможем с выбором — напишите нам
        </span>
      )}

      <a
        href={siteConfig.contacts.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в WhatsApp"
        className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-6px_rgba(37,211,102,0.6)] transition-transform hover:scale-105"
      >
        {/* мягкая пульсация — привлекает внимание, но не мигает навязчиво */}
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-25" />
        <svg
          viewBox="0 0 24 24"
          width="27"
          height="27"
          fill="currentColor"
          aria-hidden
          className="relative"
        >
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.36.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
        </svg>
      </a>
    </div>
  );
}
