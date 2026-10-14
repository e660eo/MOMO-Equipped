import type { Metadata } from "next";
import { siteConfig } from "@/lib/data";
import { ContactForm } from "@/components/contact-form";
import { YandexMap } from "@/components/yandex-map";
import { publicPageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = publicPageMetadata(
  "Контакты",
  "Телефон, email, адрес и мессенджеры MOMO. Проконсультируем по подбору автоакустики.",
  "/contacts",
);

const rows = (c: typeof siteConfig.contacts) => [
  { label: "Телефон", value: c.phone },
  { label: "Email", value: c.email },
  { label: "Адрес", value: c.address },
  { label: "Режим работы", value: c.hours },
];

const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

export default function ContactsPage() {
  const c = siteConfig.contacts;
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold uppercase">
        Контакты
      </h1>
      <p className="mt-3 max-w-[52ch] text-muted-foreground">
        Готовы проконсультировать по подбору акустики и ответить на любые
        вопросы.
      </p>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <div className="space-y-6">
          {rows(c).map((r) => (
            <div key={r.label}>
              <p className={labelCls}>{r.label}</p>
              <p className="whitespace-pre-line text-lg">{r.value}</p>
            </div>
          ))}
          <div>
            <p className={labelCls}>Мессенджеры</p>
            <div className="mt-2 flex gap-3">
              <a
                href={c.whatsapp}
                className="inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
              >
                WhatsApp
              </a>
              <a
                href={c.telegram}
                className="inline-flex rounded-sm border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>

        <div className="rounded border border-border bg-surface p-8">
          <h2 className="font-display text-lg font-semibold uppercase">
            Написать сообщение
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ответим в течение рабочего дня.
          </p>
          <ContactForm />
        </div>
      </div>

      {/* Как нас найти */}
      <div className="mt-14">
        <h2 className="font-display text-lg font-semibold uppercase">
          Как нас найти
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{c.address}</p>
        <YandexMap
          query={`Махачкала, проспект Гамидова, 16`}
          className="mt-5"
          title="Modern Original Music Organization на карте"
        />
      </div>
    </main>
  );
}
