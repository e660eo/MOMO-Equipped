"use client";

import { useEffect, useState } from "react";
import { Truck, ShieldCheck, Clock, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/data";

const items = [
  { icon: Truck, text: "Бесплатная доставка от 5000 ₽" },
  { icon: ShieldCheck, text: "Гарантия 12 месяцев" },
  { icon: Clock, text: "Обработка заказа за 1 день" },
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setIndex((v) => (v + 1) % items.length);
    }, 3600);
    return () => clearInterval(t);
  }, []);

  const phone = siteConfig.contacts.phone;

  return (
    <div className="relative overflow-hidden bg-black text-white">
      <div className="relative z-10 mx-auto flex h-10 max-w-[1200px] items-center justify-between gap-4 px-6 text-[0.8rem] font-semibold">
        {/* Ротация сообщений */}
        <div className="relative h-5 flex-1 overflow-hidden">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <span
                key={i}
                aria-hidden={i !== index}
                className={cn(
                  "absolute inset-0 flex items-center gap-2 whitespace-nowrap transition-all duration-500 ease-out",
                  i === index
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-full opacity-0",
                )}
              >
                <Icon size={15} strokeWidth={2.4} className="text-signal" />
                {it.text}
              </span>
            );
          })}
        </div>

        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-70"
        >
          <Phone size={14} strokeWidth={2.4} />
          <span className="hidden sm:inline">{phone}</span>
        </a>
      </div>
    </div>
  );
}
