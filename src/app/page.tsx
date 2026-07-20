import Link from "next/link";
import { HeroLogo } from "@/components/hero-logo";
import {
  Disc3,
  Zap,
  Volume2,
  MonitorPlay,
  Lightbulb,
  Cable,
  MapPin,
  Mail,
  Phone,
  type LucideIcon,
} from "lucide-react";
import {
  getProducts,
  getCategories,
  getNews,
  getBundles,
  siteConfig,
} from "@/lib/data";
import { BundleCard } from "@/components/bundle-card";
import { cn } from "@/lib/utils";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { BannerCarousel } from "@/components/banner-carousel";
import { ProductCard } from "@/components/product-card";
import { WaveDivider } from "@/components/wave-divider";
import { SectionHead } from "@/components/section-head";
import { Reveal } from "@/components/reveal";

const categoryIcons: Record<string, LucideIcon> = {
  sabvufery: Disc3,
  "usiliteli-monobloki": Zap,
  "dinamiki-rupora": Volume2,
  multimedia: MonitorPlay,
  avtosvet: Lightbulb,
  aksessuary: Cable,
};

// Порядок и размеры плиток каталога — редакторская bento-сетка (6 колонок на lg):
// «Сабвуферы» — крупный флагманский тайл (3×2), справа две широкие плитки,
// снизу — три равных. Порядок задаёт раскладку через grid auto-placement.
const catalogLayout: { slug: string; span: string; feature?: boolean }[] = [
  { slug: "sabvufery", span: "sm:col-span-2 lg:col-span-3 lg:row-span-2", feature: true },
  { slug: "usiliteli-monobloki", span: "lg:col-span-3" },
  { slug: "aksessuary", span: "lg:col-span-3" },
  { slug: "dinamiki-rupora", span: "lg:col-span-2" },
  { slug: "multimedia", span: "lg:col-span-2" },
  { slug: "avtosvet", span: "lg:col-span-2" },
];

export default function Home() {
  const products = getProducts();
  const categories = getCategories();
  const news = getNews();
  const flagship = products
    .filter((p) => p.brand === "MOMO")
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);
  const { trust } = siteConfig;
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const bundles = getBundles();

  return (
    <main className="overflow-x-hidden">
      {/* HERO — «Не громкость. Давление.» на белой плашке, за которой переливается звуковая линия */}
      <section className="border-b border-border">
        <div className="relative overflow-hidden bg-white text-zinc-900">
          {/* фон: переливающаяся звуковая линия (WebGL) */}
          <div className="pointer-events-none absolute inset-0">
            <WebGLShader className="opacity-70" />
          </div>
          {/* мягкое высветление за текстом для читаемости */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_54%_at_50%_44%,rgba(255,255,255,0.92),rgba(255,255,255,0.45)_58%,transparent_82%)]" />

          <div className="relative z-10 mx-auto max-w-[1100px] px-6 pb-14 pt-10 text-center">
            <p className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.22em] text-neutral-500 before:h-px before:w-7 before:bg-signal before:content-[''] after:h-px after:w-7 after:bg-signal after:content-['']">
              Автозвук с 2015
            </p>

            {/*
              Логотип — главный герой экрана; заголовок уходит на второй план
              и работает фоновой типографикой позади него.
            */}
            <div className="relative mt-4 flex items-center justify-center">
              <h1 className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center font-display text-[clamp(1.9rem,7.6vw,5.6rem)] font-bold uppercase leading-[0.94] tracking-tight text-zinc-900/[0.13]">
                <span>Звук, который</span>
                <span className="text-signal/25">чувствуешь.</span>
              </h1>
              <HeroLogo className="relative z-10 w-[clamp(320px,68vw,860px)]" />
            </div>

            <p className="mx-auto -mt-2 max-w-[48ch] text-[1.05rem] text-neutral-500">
              Сабвуферы, усилители и эстрадная акустика MOMO — для тех, кто меряет
              звук не ваттами на бумаге, а ощущением в груди.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Link
                href="/catalog"
                className="inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
              >
                Смотреть каталог
              </Link>
              <Link
                href="/contacts"
                className="inline-flex rounded-sm border border-neutral-300 bg-white/70 px-7 py-3.5 text-sm font-semibold text-zinc-900 backdrop-blur-sm transition-colors hover:border-signal hover:text-signal"
              >
                Подобрать комплект
              </Link>
            </div>
          </div>
        </div>

        {/* ticker */}
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-x-8 gap-y-3 px-6 py-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>
              гарантия{" "}
              <b className="font-medium text-foreground">
                {trust.warrantyMonths} месяцев
              </b>
            </span>
            <span>
              обработка заказа{" "}
              <b className="font-medium text-foreground">
                {trust.processingDays} день
              </b>
            </span>
            <span>
              сплит <b className="font-medium text-foreground">0%</b> · 4 платежа
            </span>
          </div>
        </div>
      </section>

      {/* CATALOG — редакторская bento-сетка категорий */}
      <section className="py-20">
        <Reveal className="mx-auto max-w-[1200px] px-6">
          <SectionHead
            eyebrow={`${categories.length} категорий · ${products.length} позиций`}
            title="Каталог"
            linkHref="/catalog"
            linkLabel={`Все ${products.length} товаров →`}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {catalogLayout.map(({ slug, span, feature }) => {
              const c = categoryBySlug[slug];
              if (!c) return null;
              const Icon = categoryIcons[slug] ?? Disc3;
              return (
                <Link
                  key={slug}
                  href={`/catalog?category=${slug}`}
                  className={cn(
                    "group relative flex min-h-[172px] flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-6 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-signal/60 hover:shadow-[0_18px_50px_-24px_rgba(255,85,0,0.45)]",
                    feature && "lg:p-8",
                    span,
                  )}
                >
                  {/* мягкое оранжевое свечение по ховеру */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(460px_240px_at_50%_-10%,rgba(255,85,0,0.13),transparent_70%)]"
                  />
                  {/* гигантская «призрачная» цифра — типографическая текстура */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -bottom-7 -right-2 z-0 select-none font-display font-bold leading-none tabular-nums text-foreground/[0.045] transition-colors duration-300 group-hover:text-signal/10",
                      feature ? "text-[11rem]" : "text-[7rem]",
                    )}
                  >
                    {c.count}
                  </span>

                  {/* верх: иконка-бейдж + счётчик */}
                  <div className="relative z-[1] flex items-start justify-between">
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-xl border border-border bg-bg text-signal transition-colors duration-300 group-hover:border-signal group-hover:bg-signal group-hover:text-white",
                        feature ? "h-14 w-14" : "h-11 w-11",
                      )}
                    >
                      <Icon size={feature ? 26 : 20} strokeWidth={2} />
                    </span>
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {c.count} поз.
                    </span>
                  </div>

                  {/* низ: название + переход */}
                  <div className="relative z-[1]">
                    <h3
                      className={cn(
                        "font-display font-medium uppercase leading-[1.05] transition-colors duration-300 group-hover:text-signal",
                        feature
                          ? "text-[clamp(1.5rem,2.6vw,2.1rem)]"
                          : "text-[1.05rem]",
                      )}
                    >
                      {c.title}
                    </h3>
                    <span className="mt-3 inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground transition-colors duration-300 group-hover:text-signal">
                      Смотреть
                      <span className="transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* BANNERS */}
      <section id="promo" className="pb-4">
        <div className="mx-auto max-w-[1200px] px-6">
          <BannerCarousel />
        </div>
      </section>

      <WaveDivider />

      {/* FLAGSHIP */}
      <section className="py-20">
        <Reveal className="mx-auto max-w-[1200px] px-6">
          <SectionHead
            eyebrow="Топ по мощности · линейка MOMO"
            title="Флагманы MOMO"
            linkHref="/catalog?brand=MOMO"
            linkLabel="Вся линейка →"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {flagship.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* BUNDLES — готовые сборки */}
      <section className="border-t border-border bg-surface py-20">
        <Reveal className="mx-auto max-w-[1200px] px-6">
          <SectionHead
            eyebrow="Собрано и проверено"
            title="Готовые сборки"
            linkHref="/catalog"
            linkLabel="Собрать своё →"
          />
          <p className="-mt-6 mb-10 max-w-[62ch] text-muted-foreground">
            Не нужно гадать, что к чему подойдёт: саб, усилитель и провода уже
            подобраны друг под друга. Берёте комплект — экономите и ничего не
            забываете докупить.
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => (
              <BundleCard key={b.slug} bundle={b} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* MANIFEST + CONTACT */}
      <section className="border-y border-border bg-surface py-20">
        <Reveal className="mx-auto grid max-w-[1200px] items-center gap-14 px-6 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-2.5 inline-flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground before:h-px before:w-6 before:bg-signal before:content-['']">
              Манифест
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3.2vw,2.4rem)] font-medium leading-[1.15]">
              Свой звук.
              <br />
              <span className="text-signal">Свой бренд.</span>
            </h2>
            <p className="mt-5 max-w-[52ch] text-muted-foreground">
              MOMO — не перепродажа чужих коробок. Мы разрабатываем и тестируем
              акустику там, где автозвук давно стал спортом. Каждая модель проходит
              проверку давлением, прежде чем попасть в каталог.
            </p>
            <p className="mt-4 max-w-[52ch] text-muted-foreground">
              Скажите, какой у вас автомобиль и какого звука хотите — соберём
              комплект под задачу и бюджет, расскажем про установку.
            </p>
          </div>

          {/* Сигнальная карточка консультации — тёмная в обеих темах,
              в градиентном языке баннера «Сплит 0%» */}
          <div className="relative overflow-hidden rounded-xl border border-white/10 p-8 text-[#f5f3ef] [background:radial-gradient(120%_180%_at_85%_15%,rgba(255,85,0,0.22),transparent_55%),linear-gradient(115deg,#101012_0%,#1b1b1f_60%,#232327_100%)]">
            {/* фирменная волна — призрачная текстура */}
            <svg
              aria-hidden
              className="pointer-events-none absolute -right-6 bottom-6 w-[340px] text-white/[0.07]"
              viewBox="540 0 110 64"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
            >
              <path
                d="M540 32 L560 32 570 14 580 50 590 8 600 56 610 20 620 44 630 28 640 32 650 32"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>

            <span className="relative z-[1] inline-flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/60">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
              </span>
              Консультация · {siteConfig.contacts.hours}
            </span>

            <a
              href={`tel:${siteConfig.contacts.phone.replace(/[^+\d]/g, "")}`}
              className="relative z-[1] mt-4 block font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-none tracking-tight transition-colors hover:text-signal"
            >
              {siteConfig.contacts.phone}
            </a>

            <ul className="relative z-[1] mt-6 space-y-2.5 border-t border-white/10 pt-6 font-mono text-[0.78rem] tracking-wide text-white/70">
              <li className="flex items-center gap-3">
                <Phone size={14} className="shrink-0 text-signal" />
                <a
                  href={`tel:${siteConfig.contacts.phoneSecondary.replace(/[^+\d]/g, "")}`}
                  className="transition-colors hover:text-white"
                >
                  {siteConfig.contacts.phoneSecondary}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={14} className="shrink-0 text-signal" />
                <a
                  href={`mailto:${siteConfig.contacts.email}`}
                  className="transition-colors hover:text-white"
                >
                  {siteConfig.contacts.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={14} className="shrink-0 text-signal" />
                <span>{siteConfig.contacts.address}</span>
              </li>
            </ul>

            <div className="relative z-[1] mt-7 flex flex-wrap gap-3">
              <a
                href={siteConfig.contacts.whatsapp}
                className="inline-flex rounded-sm bg-signal px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
              >
                Написать в WhatsApp
              </a>
              <a
                href={siteConfig.contacts.telegram}
                className="inline-flex rounded-sm border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-signal hover:text-signal"
              >
                Telegram
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* NEWS */}
      <section className="py-20">
        <Reveal className="mx-auto max-w-[1200px] px-6">
          <SectionHead
            eyebrow="Журнал MOMO"
            title="Новости"
            linkHref="/news"
            linkLabel="Все новости →"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {news.map((n, i) => (
              <Link
                key={n.slug}
                href={`/news/${n.slug}`}
                className="group relative flex min-h-[236px] flex-col overflow-hidden rounded-xl border border-border bg-surface p-7 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-signal/60 hover:shadow-[0_18px_50px_-24px_rgba(255,85,0,0.45)]"
              >
                {/* мягкое оранжевое свечение по ховеру */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(460px_240px_at_50%_-10%,rgba(255,85,0,0.13),transparent_70%)]"
                />
                {/* призрачный индекс — типографическая текстура */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-8 -right-1 z-0 select-none font-display text-[7rem] font-bold leading-none tabular-nums text-foreground/[0.045] transition-colors duration-300 group-hover:text-signal/10"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className="relative z-[1] font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {new Date(n.date).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <h3 className="relative z-[1] mt-3 font-display text-[1.05rem] font-medium leading-snug transition-colors duration-300 group-hover:text-signal">
                  {n.title}
                </h3>
                <p className="relative z-[1] mt-3 text-[0.9rem] text-muted-foreground">
                  {n.excerpt}
                </p>
                <span className="relative z-[1] mt-auto inline-flex items-center gap-2 pt-5 font-mono text-[0.72rem] uppercase tracking-wider text-signal">
                  Читать
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
