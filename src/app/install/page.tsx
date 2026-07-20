import type { Metadata } from "next";
import { siteConfig } from "@/lib/data";

export const metadata: Metadata = {
  title: "Где установить",
  description:
    "Установка автоакустики MOMO: партнёрские студии и рекомендации по монтажу сабвуферов, усилителей и акустики.",
};

const steps = [
  { n: "01", title: "Подберём комплект", text: "Скажите авто и задачу — соберём акустику, усилитель и сабвуфер под вашу машину и бюджет." },
  { n: "02", title: "Направим к установщику", text: "Подскажем проверенную студию в вашем городе или поможем с самостоятельным монтажом." },
  { n: "03", title: "Настроим звук", text: "Расскажем про согласование, шумоизоляцию и настройку усилителя под нужное давление." },
];

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-[1000px] px-6 py-14">
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
