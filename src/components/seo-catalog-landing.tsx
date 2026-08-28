import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/structured-data";
import { plural } from "@/lib/utils";
import { siteConfig } from "@/lib/data";
import type { Product } from "@/lib/types";

interface LandingLink {
  href: string;
  label: string;
}

interface Crumb {
  name: string;
  url: string;
}

export function SeoCatalogLanding({
  eyebrow,
  title,
  intro,
  productsTitle,
  bodyTitle,
  body,
  products,
  total,
  catalogHref,
  relatedLinks,
  crumbs,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  productsTitle: string;
  bodyTitle: string;
  body: string[];
  products: Product[];
  total: number;
  catalogHref: string;
  relatedLinks: LandingLink[];
  crumbs: Crumb[];
}) {
  const shown = products.slice(0, 24);
  const remainingProducts = products.slice(shown.length);
  const { trust } = siteConfig;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <nav className="mb-8 flex flex-wrap gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
        {crumbs.map((crumb, index) => (
          <span key={crumb.url} className="contents">
            {index > 0 && <span>/</span>}
            {index === crumbs.length - 1 ? (
              <span className="text-foreground">{crumb.name}</span>
            ) : (
              <Link href={crumb.url} className="hover:text-signal">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <section className="relative overflow-hidden rounded-2xl border border-white/10 p-8 text-white md:p-12 [background:radial-gradient(110%_170%_at_88%_10%,rgba(255,85,0,0.3),transparent_54%),linear-gradient(115deg,#101012_0%,#1b1b1f_58%,#242428_100%)]">
        <p className="relative z-[1] inline-flex items-center gap-2.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-white/60 before:h-px before:w-6 before:bg-signal before:content-['']">
          {eyebrow}
        </p>
        <h1 className="relative z-[1] mt-3 max-w-[24ch] font-display text-[clamp(1.9rem,5vw,3.35rem)] font-extrabold uppercase leading-[1.04]">
          {title}
        </h1>
        <p className="relative z-[1] mt-5 max-w-[70ch] text-[0.98rem] leading-relaxed text-white/75">
          {intro}
        </p>
        <div className="relative z-[1] mt-7 flex flex-wrap gap-2.5 font-mono text-[0.68rem] uppercase tracking-wider text-white/75">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
            {total} {plural(total, "позиция", "позиции", "позиций")}
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
            Гарантия {trust.warrantyMonths}/{trust.extendedWarrantyMonths} мес.
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
            Доставка по России
          </span>
        </div>
      </section>

      {relatedLinks.length > 0 && (
        <nav
          aria-label="Связанные разделы"
          className="mt-6 flex flex-wrap gap-2"
        >
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-border bg-surface px-4 py-2 text-[0.8rem] font-medium transition-colors hover:border-signal hover:text-signal"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              В наличии и под заказ
            </p>
            <h2 className="mt-2 font-display text-[clamp(1.45rem,3vw,2rem)] font-extrabold uppercase">
              {productsTitle}
            </h2>
          </div>
          <Link
            href={catalogHref}
            className="font-mono text-[0.72rem] uppercase tracking-wider text-[var(--signal-text)] hover:underline"
          >
            Все товары и фильтры →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((product, index) => (
            <ProductCard
              key={product.slug}
              product={product}
              priority={index === 0}
            />
          ))}
        </div>

        {total > shown.length && (
          <div className="mt-9 rounded-xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="font-display text-base font-semibold uppercase">
              Все модели раздела
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ещё {remainingProducts.length} {plural(remainingProducts.length, "модель", "модели", "моделей")} — откройте карточку или используйте фильтры.
            </p>
            <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {remainingProducts.map((product) => (
                <li key={product.slug} className="border-t border-border">
                  <Link
                    href={`/product/${product.slug}`}
                    className="inline-flex min-h-11 w-full items-center text-sm transition-colors hover:text-signal"
                  >
                    {product.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={catalogHref}
              className="mt-5 inline-flex min-h-11 items-center rounded-sm border border-border px-6 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Открыть фильтры для всех {total} товаров
            </Link>
          </div>
        )}
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-surface p-7 sm:p-9">
        <h2 className="font-display text-[clamp(1.3rem,2.8vw,1.8rem)] font-extrabold uppercase">
          {bodyTitle}
        </h2>
        <div className="mt-5 max-w-[82ch] space-y-4 text-[0.95rem] leading-relaxed text-muted-foreground">
          {body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={catalogHref}
            className="inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
          >
            Подобрать в каталоге
          </Link>
          <a
            href={siteConfig.contacts.whatsapp}
            className="inline-flex rounded-sm border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
          >
            Спросить специалиста
          </a>
        </div>
      </section>
    </main>
  );
}
