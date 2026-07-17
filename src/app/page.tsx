import Link from "next/link";
import Image from "next/image";
import {
  Disc3,
  Zap,
  Volume2,
  MonitorPlay,
  Lightbulb,
  Cable,
  type LucideIcon,
} from "lucide-react";
import { getProducts, getCategories, getNews, siteConfig } from "@/lib/data";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { BannerCarousel } from "@/components/banner-carousel";
import { ProductCard } from "@/components/product-card";
import { WaveDivider } from "@/components/wave-divider";
import { SectionHead } from "@/components/section-head";

const categoryIcons: Record<string, LucideIcon> = {
  sabvufery: Disc3,
  "usiliteli-monobloki": Zap,
  "dinamiki-rupora": Volume2,
  multimedia: MonitorPlay,
  avtosvet: Lightbulb,
  aksessuary: Cable,
};

export default function Home() {
  const products = getProducts();
  const categories = getCategories();
  const news = getNews();
  const flagship = products
    .filter((p) => p.brand === "MOMO")
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);
  const { trust } = siteConfig;

  return (
    <main>
      {/* HERO — «Не громкость. Давление.» на белой плашке, за которой переливается звуковая линия */}
      <section className="border-b border-border">
        <div className="relative overflow-hidden bg-white text-zinc-900">
          {/* фон: переливающаяся звуковая линия (WebGL) */}
          <div className="pointer-events-none absolute inset-0">
            <WebGLShader className="opacity-70" />
          </div>
          {/* мягкое высветление за текстом для читаемости */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_54%_at_50%_44%,rgba(255,255,255,0.92),rgba(255,255,255,0.45)_58%,transparent_82%)]" />

          <div className="relative z-10 mx-auto max-w-[1000px] px-6 pb-16 pt-16 text-center">
            <Image
              src="/logo.png"
              alt="MOMO Equipped"
              width={220}
              height={143}
              priority
              style={{ height: "auto" }}
              className="mx-auto w-[clamp(150px,22vw,220px)]"
            />
            <p className="mt-8 inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.22em] text-neutral-500 before:h-px before:w-7 before:bg-signal before:content-[''] after:h-px after:w-7 after:bg-signal after:content-['']">
              Автозвук с 2015
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.4rem,6vw,4.8rem)] font-bold uppercase leading-[1.02] tracking-tight">
              Звук, который
              <br />
              <span className="text-signal">чувствуешь.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[48ch] text-[1.05rem] text-neutral-500">
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
              <b className="font-medium text-foreground">{trust.skuCount}</b> позиций
            </span>
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

      {/* CATALOG — с иконками */}
      <section className="py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <SectionHead
            title="Каталог"
            linkHref="/catalog"
            linkLabel={`Все ${products.length} товаров →`}
          />
          <div className="border-t border-border">
            {categories.map((c) => {
              const Icon = categoryIcons[c.slug] ?? Disc3;
              return (
                <Link
                  key={c.slug}
                  href={`/catalog?category=${c.slug}`}
                  className="group relative grid grid-cols-[1fr_auto_auto] items-center gap-6 border-b border-border px-2 py-6 transition-[padding] hover:pl-5"
                >
                  <span className="absolute bottom-[-1px] left-0 h-px w-0 bg-signal transition-[width] duration-300 group-hover:w-full" />
                  <span className="flex items-center gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-signal transition-colors group-hover:border-signal">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <span className="font-display text-[1.1rem] font-medium uppercase">
                      {c.title}
                    </span>
                  </span>
                  <span className="font-mono text-[0.75rem] tracking-wider text-muted-foreground">
                    {c.count} поз.
                  </span>
                  <span className="text-muted-foreground transition-all group-hover:translate-x-1.5 group-hover:text-signal">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
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
        <div className="mx-auto max-w-[1200px] px-6">
          <SectionHead
            title="Флагманы MOMO"
            linkHref="/catalog?brand=MOMO"
            linkLabel="Вся линейка →"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {flagship.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* MANIFEST + CONTACT */}
      <section className="border-y border-border bg-surface py-20">
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 md:grid-cols-[1.1fr_0.9fr]">
          <div>
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
          <div className="rounded border border-border bg-bg p-9">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
              Консультация · {siteConfig.contacts.hours}
            </span>
            <a
              href={`tel:${siteConfig.contacts.phone.replace(/[^+\d]/g, "")}`}
              className="my-3 block font-display text-2xl font-medium transition-colors hover:text-signal"
            >
              {siteConfig.contacts.phone}
            </a>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={siteConfig.contacts.whatsapp}
                className="inline-flex rounded-sm bg-signal px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
              >
                Написать в WhatsApp
              </a>
              <a
                href={siteConfig.contacts.telegram}
                className="inline-flex rounded-sm border border-border px-6 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* NEWS */}
      <section className="py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <SectionHead title="Новости" linkHref="/news" linkLabel="Все новости →" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {news.map((n) => (
              <Link
                key={n.slug}
                href={`/news/${n.slug}`}
                className="group flex flex-col rounded border border-border bg-surface p-7 transition-all hover:-translate-y-0.5 hover:border-signal/55"
              >
                <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {new Date(n.date).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <h3 className="mt-3 font-display text-[1.05rem] font-medium leading-snug transition-colors group-hover:text-signal">
                  {n.title}
                </h3>
                <p className="mt-3 text-[0.9rem] text-muted-foreground">
                  {n.excerpt}
                </p>
                <span className="mt-4 font-mono text-[0.72rem] uppercase tracking-wider text-signal">
                  Читать →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
