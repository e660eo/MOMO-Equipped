import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { siteConfig, getBrands } from "@/lib/data";

export const metadata: Metadata = {
  title: "О компании",
  description:
    "MOMO Equipped — автозвук из Махачкалы с 2015 года: сабвуферы, усилители, эстрадная акустика. Собственные бренды, гарантия 12 месяцев, доставка по всей России.",
};

/*
  Страница собрана ТОЛЬКО из проверяемых фактов: год из тикера «автозвук
  с 2015», данные ИП из реквизитов, бренды и цифры из каталога. Историю
  бренда, фото производства и сертификаты не выдумываем — появятся реальные
  материалы от владельца, страница дополнится.
*/
export default function AboutPage() {
  const { contacts, requisites, trust } = siteConfig;
  const brands = getBrands();

  const facts = [
    { value: "2015", label: "год, с которого мы в автозвуке" },
    { value: trust.skuCount, label: "позиций в каталоге" },
    { value: `${trust.warrantyMonths} мес`, label: "гарантия на оборудование" },
    { value: "РФ", label: "доставка по всей России" },
  ];

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        О компании
      </p>
      <h1 className="mt-3 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-extrabold uppercase leading-tight">
        Звук, который <span className="text-signal">чувствуешь</span>
      </h1>

      <div className="mt-8 grid items-start gap-10 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5 text-[1.02rem] leading-relaxed text-muted-foreground">
          <p>
            MOMO Equipped — магазин и бренд автомобильной акустики из
            Махачкалы. Мы занимаемся автозвуком с 2015 года: собираем комплекты
            под конкретные машины и бюджеты, отбираем оборудование, которое
            держит заявленную мощность, и отвечаем за него гарантией.
          </p>
          <p>
            В каталоге — сабвуферы, моноблоки и усилители, эстрадные динамики,
            мультимедиа и всё для инсталляции: провода, дистрибьюторы,
            аксессуары. Работаем и в розницу, и с дилерами по всей России.
          </p>
          <p>
            Официально: {requisites.fullName} (ИНН {requisites.inn}), работаем
            с 2019 года. Полные реквизиты открыты — на странице{" "}
            <Link
              href="/requisites"
              className="text-[var(--signal-text)] underline underline-offset-4 hover:no-underline"
            >
              «Реквизиты»
            </Link>
            .
          </p>
        </div>

        <Image
          src="/logo-3d.png"
          alt="MOMO Equipped"
          width={1500}
          height={985}
          sizes="(max-width: 768px) 80vw, 380px"
          className="hero-logo-float mx-auto h-auto w-[260px] max-w-full md:w-full"
        />
      </div>

      {/* Цифры */}
      <div className="mt-12 grid grid-cols-2 gap-4 border-y border-border py-8 sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="text-center">
            <p className="font-display text-2xl font-extrabold text-signal sm:text-3xl">
              {f.value}
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              {f.label}
            </p>
          </div>
        ))}
      </div>

      {/* Бренды */}
      <section className="mt-12">
        <h2 className="font-display text-lg font-extrabold uppercase">
          Наши бренды
        </h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {brands.map((b) => (
            <Link
              key={b.slug}
              href={`/catalog?brand=${encodeURIComponent(b.title)}`}
              className="rounded-sm border border-border px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wide transition-colors hover:border-signal hover:text-signal"
            >
              {b.title}
            </Link>
          ))}
        </div>
      </section>

      {/* Почему нам доверяют */}
      <section className="mt-12">
        <h2 className="font-display text-lg font-extrabold uppercase">
          Почему нам доверяют
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Подбор под задачу",
              text: "Не продаём «что подороже» — собираем систему под машину, жанр и бюджет.",
            },
            {
              title: "Гарантия и возврат",
              text: `Гарантия ${trust.warrantyMonths} месяцев, возврат ${trust.returnDays} дней — условия открыты на странице «Доставка и оплата».`,
            },
            {
              title: "На связи",
              text: "Вопрос по подключению или настройке — пишите в WhatsApp, поможем и после покупки.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <h3 className="font-display text-base font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/catalog"
          className="inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Смотреть каталог
        </Link>
        <a
          href={contacts.whatsapp}
          className="inline-flex rounded-sm border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          Написать нам
        </a>
      </div>
    </main>
  );
}
