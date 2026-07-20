import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProduct,
  getProducts,
  getProductsByCategory,
  getCategory,
  formatPrice,
  splitPayment,
  productImageUrl,
  siteConfig,
} from "@/lib/data";
import { getRating, getReviews, pluralReviews } from "@/lib/reviews";
import { parseSpecs } from "@/lib/specs";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Stars } from "@/components/stars";

export function generateStaticParams() {
  return getProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Товар не найден" };
  return {
    title: product.title,
    description: `${product.title} — ${product.brand}. Цена ${formatPrice(product.price)}, сплит ${formatPrice(splitPayment(product.price))} × 4. Гарантия 12 месяцев, доставка по России.`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const category = getCategory(product.category);
  const related = getProductsByCategory(product.category)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  const split = splitPayment(product.price);
  const rating = getRating(product.slug);
  const reviews = getReviews(product.slug);
  const specs = parseSpecs(product.title);

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-12">
      {/* Хлебные крошки */}
      <nav className="mb-8 flex flex-wrap gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
        <Link href="/" className="hover:text-signal">
          Главная
        </Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-signal">
          Каталог
        </Link>
        {category && (
          <>
            <span>/</span>
            <Link
              href={`/catalog?category=${category.slug}`}
              className="hover:text-signal"
            >
              {category.title}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Фото */}
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded border border-border bg-tile">
          <ProductImage
            src={productImageUrl(product.image)}
            alt={product.title}
            className="h-[86%] w-[86%] object-contain mix-blend-multiply"
          />
        </div>

        {/* Инфо */}
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/catalog?brand=${product.brand}`}
              className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground hover:text-signal"
            >
              {product.brand}
            </Link>
            {product.isClearance && (
              <span className="rounded-sm bg-[var(--signal-text)] px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-wide text-white">
                Уценённый товар
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-[clamp(1.5rem,3vw,2.2rem)] font-semibold leading-tight">
            {product.title}
          </h1>

          {/* Рейтинг */}
          <a
            href="#reviews"
            className="mt-3 inline-flex items-center gap-2 transition-colors hover:text-signal"
          >
            <Stars value={rating.value} size={16} />
            <span className="font-mono text-[0.78rem] text-muted-foreground">
              {rating.value.toFixed(1)} · {rating.count}{" "}
              {pluralReviews(rating.count)}
            </span>
          </a>

          <div className="mt-7 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="font-display text-4xl font-extrabold">
              {formatPrice(product.price)}
            </span>
            {/* Статус наличия из прайса; если поля нет — не утверждаем ничего */}
            {product.inStock !== undefined && (
              <span className="inline-flex items-center gap-2 font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                <span
                  className={
                    product.inStock
                      ? "h-1.5 w-1.5 rounded-full bg-signal"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                  }
                />
                {product.inStock ? (
                  "В наличии"
                ) : (
                  <span className="text-muted-foreground">Под заказ</span>
                )}
              </span>
            )}
          </div>

          {/* Сплит */}
          <div className="mt-6 rounded border border-border bg-surface p-5">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              Сплит · оплата частями
            </p>
            <p className="mt-2 text-sm">
              4 платежа по{" "}
              <b className="font-display text-lg text-[var(--signal-text)]">
                {formatPrice(split)}
              </b>
            </p>
            <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">
              Без процентов и переплат · одобрение за минуту
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <AddToCartButton product={product} size="lg" />
            <a
              href={siteConfig.contacts.whatsapp}
              className="inline-flex items-center rounded-sm border border-border px-8 py-4 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Задать вопрос
            </a>
          </div>

          {/* Характеристики, распознанные из названия */}
          {specs.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                Характеристики
              </h2>
              <dl className="mt-3 divide-y divide-border">
                {specs.map((s) => (
                  <div
                    key={s.label + s.value}
                    className="flex items-baseline justify-between gap-6 py-2.5"
                  >
                    <dt className="text-[0.85rem] text-muted-foreground">
                      {s.label}
                    </dt>
                    <dd className="text-right font-mono text-[0.85rem] font-medium">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Описание из прайса поставщика */}
          {product.description && product.description.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                Описание
              </h2>
              <ul className="mt-3 space-y-2">
                {product.description.map((line, i) => (
                  <li
                    key={i}
                    className="border-l border-border pl-4 text-[0.88rem] leading-relaxed text-muted-foreground"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Гарантии */}
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border pt-6 text-center">
            <div>
              <p className="font-display text-sm font-semibold">Доставка</p>
              <p className="mt-1 text-xs text-muted-foreground">По России</p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold">Гарантия</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {siteConfig.trust.warrantyMonths} месяцев
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold">Возврат</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {siteConfig.trust.returnDays} дней
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Отзывы */}
      <section id="reviews" className="mt-20 scroll-mt-28">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold uppercase">Отзывы</h2>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
            <span className="font-display text-2xl font-extrabold leading-none">
              {rating.value.toFixed(1)}
            </span>
            <span>
              <Stars value={rating.value} size={14} />
              <span className="mt-1 block font-mono text-[0.68rem] text-muted-foreground">
                {rating.count} {pluralReviews(rating.count)}
              </span>
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r, i) => (
            <article
              key={i}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-display text-sm font-semibold">
                    {r.author.charAt(0)}
                  </span>
                  <span className="text-[0.9rem] font-medium">{r.author}</span>
                </div>
                <Stars value={r.rating} size={13} />
              </div>
              <p className="mt-4 text-[0.9rem] leading-relaxed text-muted-foreground">
                {r.text}
              </p>
              <time
                dateTime={r.date}
                className="mt-3 block font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground"
              >
                {new Date(r.date).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </article>
          ))}
        </div>
      </section>

      {/* Похожие */}
      {related.length > 0 && (
        <section className="mt-20">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold uppercase">
              Похожие товары
            </h2>
            {category && (
              <Link
                href={`/catalog?category=${category.slug}`}
                className="font-mono text-[0.78rem] uppercase tracking-wider text-muted-foreground hover:text-signal"
              >
                Все в категории →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
