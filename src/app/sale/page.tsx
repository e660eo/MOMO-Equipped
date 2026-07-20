import Link from "next/link";
import type { Metadata } from "next";
import { getClearanceProducts, siteConfig } from "@/lib/data";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Уценка и распродажа",
  description:
    "Уценённые товары MOMO по сниженной цене: витринные образцы, остатки и распродажа. Та же гарантия, ограниченное количество.",
};

export default function SalePage() {
  const products = getClearanceProducts();

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-14">
      {/* Хлебные крошки */}
      <nav className="mb-8 flex flex-wrap gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
        <Link href="/" className="hover:text-signal">
          Главная
        </Link>
        <span>/</span>
        <span className="text-foreground">Уценка</span>
      </nav>

      {/* Шапка распродажи — сигнальная плашка */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 p-8 text-white md:p-12 [background:radial-gradient(120%_180%_at_85%_15%,rgba(255,85,0,0.28),transparent_55%),linear-gradient(115deg,#101012_0%,#1b1b1f_60%,#232327_100%)]">
        {/* фирменная волна — призрачная текстура */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-8 bottom-4 w-[420px] text-white/[0.06]"
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

        <p className="relative z-[1] inline-flex items-center gap-2.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-white/60 before:h-px before:w-6 before:bg-signal before:content-['']">
          Выгода
        </p>
        <h1 className="relative z-[1] mt-3 font-display text-[clamp(2rem,5vw,3.4rem)] font-bold uppercase leading-[1.02]">
          Уценка&nbsp;<span className="text-signal">·</span> распродажа
        </h1>
        <p className="relative z-[1] mt-4 max-w-[54ch] text-[0.98rem] text-white/75">
          Витринные образцы, остатки склада и товары со сниженной ценой. Полностью
          рабочие, с той же гарантией {siteConfig.trust.warrantyMonths} месяцев —
          просто дешевле. Количество ограничено: разбирают быстро.
        </p>
        <p className="relative z-[1] mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[0.72rem] uppercase tracking-wider text-white/80">
          {products.length}{" "}
          {products.length === 1
            ? "позиция"
            : products.length < 5
              ? "позиции"
              : "позиций"}{" "}
          в наличии
        </p>
      </section>

      {/* Сетка товаров */}
      {products.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface p-14 text-center">
          <p className="font-display text-lg font-medium">
            Сейчас уценённых товаров нет
          </p>
          <p className="max-w-[46ch] text-sm text-muted-foreground">
            Загляните позже или напишите нам — подскажем, что можно взять выгоднее
            прямо сейчас.
          </p>
          <a
            href={siteConfig.contacts.whatsapp}
            className="mt-2 inline-flex rounded-sm bg-signal px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
          >
            Написать в WhatsApp
          </a>
        </div>
      )}
    </main>
  );
}
