"use client";

import { Tag, Phone } from "lucide-react";
import { useSiteConfig } from "@/components/site-config-provider";

const message = "Промокод MOMO — скидка 10% на первый заказ";

function PromoMessage() {
  return (
    <span className="flex shrink-0 items-center gap-2 px-7">
      <Tag size={14} strokeWidth={2.5} className="text-signal" aria-hidden="true" />
      <span>{message}</span>
      <span className="rounded-sm border border-signal/60 px-1.5 py-0.5 font-mono text-[0.68rem] font-extrabold tracking-[0.12em] text-signal">
        MOMO
      </span>
    </span>
  );
}

export function AnnouncementBar() {
  const { contacts } = useSiteConfig();
  const phone = contacts.phone;

  return (
    <div className="relative overflow-hidden bg-black text-white">
      <div className="mx-auto flex h-10 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="sr-only">{message}</span>
          <div
            className="momo-promo-marquee flex w-max items-center text-[0.75rem] font-semibold sm:text-[0.8rem]"
            aria-hidden="true"
          >
            <div className="flex items-center" aria-hidden="true">
              <PromoMessage />
              <span className="text-signal/50" aria-hidden="true">✦</span>
            </div>
            <div className="flex items-center" aria-hidden="true">
              <PromoMessage />
              <span className="text-signal/50" aria-hidden="true">✦</span>
            </div>
          </div>
        </div>

        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          aria-label={`Позвонить: ${phone}`}
          className="tap-44 relative flex shrink-0 items-center gap-2 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <Phone size={14} strokeWidth={2.4} aria-hidden="true" />
          <span className="hidden sm:inline">{phone}</span>
        </a>
      </div>
    </div>
  );
}
