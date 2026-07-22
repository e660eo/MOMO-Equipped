import type { Metadata } from "next";
import { MapPin, Phone, Clock } from "lucide-react";
import { siteConfig } from "@/lib/data";
import { YandexMap } from "@/components/yandex-map";

export const metadata: Metadata = {
  title: "Где установить",
  description:
    "Установка автоакустики MOMO: фирменная точка в Махачкале, помощь с подбором и настройкой. Партнёрским студиям — дилерская программа.",
};

const steps = [
  { n: "01", title: "Подберём комплект", text: "Скажите авто и задачу — соберём акустику, усилитель и сабвуфер под вашу машину и бюджет." },
  { n: "02", title: "Направим к установщику", text: "Подскажем проверенную студию в вашем городе или поможем с самостоятельным монтажом." },
  { n: "03", title: "Настроим звук", text: "Расскажем про согласование, шумоизоляцию и настройку усилителя под нужное давление." },
];

/*
  Точки установки. Сейчас одна — фирменная (адрес из реквизитов, он настоящий).
  Партнёрские студии НЕ выдумываем: появятся реальные партнёры — добавим сюда
  же, структура готова.
*/
const points = [
  {
    name: "MOMO Equipped — фирменная точка",
    address: siteConfig.contacts.address,
    hours: siteConfig.contacts.hours,
    phone: siteConfig.contacts.phone,
    note: "Магазин и склад. Поможем с подбором, подключением и настройкой купленного комплекта.",
  },
];

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Установка
      </p>
      <h1 className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-extrabold uppercase leading-tight">
        Где установить <span className="text-signal">акустику</span>
      </h1>
      <p className="mt-5 max-w-[56ch] text-[1.05rem] text-muted-foreground">
        Правильный монтаж важен не меньше, чем сама акустика. Поможем подобрать
        оборудование и направим к установщику, который соберёт систему без
        компромиссов по звуку.
      </p>

      <div className="mt-12 border-t border-border">
        {steps.map((s) => (
          <div
            key={s.n}
            className="grid grid-cols-[auto_1fr] gap-6 border-b border-border py-7"
          >
            <span className="font-display text-2xl font-extrabold text-signal">{s.n}</span>
            <div>
              <h2 className="font-display text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 max-w-[52ch] text-sm text-muted-foreground">
                {s.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Точки установки */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-extrabold uppercase">
          Точки установки
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-4">
            {points.map((p) => (
              <div
                key={p.name}
                className="rounded-xl border border-border bg-surface p-6"
              >
                <h3 className="font-display text-base font-semibold">
                  {p.name}
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  <li className="flex items-start gap-2.5">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-signal" />
                    {p.address}
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Clock size={15} className="mt-0.5 shrink-0 text-signal" />
                    {p.hours}
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Phone size={15} className="mt-0.5 shrink-0 text-signal" />
                    <a
                      href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}
                      className="transition-colors hover:text-signal"
                    >
                      {p.phone}
                    </a>
                  </li>
                </ul>
                <p className="mt-4 text-[0.85rem] leading-relaxed text-muted-foreground">
                  {p.note}
                </p>
              </div>
            ))}

            {/* Честно: партнёрских студий в списке пока нет — зовём подключаться */}
            <div className="rounded-xl border border-dashed border-border p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Устанавливаете автозвук в своём городе? Подключим вашу студию
                как партнёрскую точку — клиенты MOMO будут приходить к вам.
              </p>
              <a
                href="/dealers"
                className="mt-4 inline-flex rounded-sm border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
              >
                Стать партнёром
              </a>
            </div>
          </div>

          <YandexMap
            query="Махачкала, проспект Гамидова, 16"
            title="Фирменная точка MOMO на карте"
          />
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={siteConfig.contacts.whatsapp}
          className="inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Спросить про установку
        </a>
        <a
          href="/catalog"
          className="inline-flex rounded-sm border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          Открыть каталог
        </a>
      </div>
    </main>
  );
}
