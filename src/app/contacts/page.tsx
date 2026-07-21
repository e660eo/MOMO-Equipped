import type { Metadata } from "next";
import { siteConfig } from "@/lib/data";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import { YandexMap } from "@/components/yandex-map";

export const metadata: Metadata = {
  title: "Контакты",
  description:
    "Телефон, email, адрес и мессенджеры MOMO. Проконсультируем по подбору автоакустики.",
};

const rows = (c: typeof siteConfig.contacts) => [
  { label: "Телефон", value: `${c.phone}\n${c.phoneSecondary}` },
  { label: "Email", value: c.email },
  { label: "Адрес", value: c.address },
  { label: "Режим работы", value: c.hours },
];

const inputCls =
  "w-full rounded-sm border border-input bg-bg px-3.5 py-3 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

export default function ContactsPage() {
  const c = siteConfig.contacts;
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-14">
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
          <form className="mt-6 space-y-3.5" action={c.whatsapp} method="get">
            <div>
              <label className={labelCls} htmlFor="ct-name">
                Имя
              </label>
              <input id="ct-name" name="name" className={inputCls} autoComplete="name" />
            </div>
            <div>
              <label className={labelCls} htmlFor="ct-contact">
                Телефон или email
              </label>
              <input id="ct-contact" name="contact" className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ct-msg">
                Сообщение
              </label>
              <textarea id="ct-msg" name="text" rows={4} className={inputCls} />
            </div>
            <ConsentCheckbox id="ct-consent" className="pt-1" />
            <button
              type="submit"
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Отправить
            </button>
          </form>
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
          title="MOMO Equipped на карте"
        />
      </div>
    </main>
  );
}
