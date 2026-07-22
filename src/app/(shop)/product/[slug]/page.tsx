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
import { MessageSquare } from "lucide-react";
import { isInStock } from "@/lib/format";
import { fullSpecs } from "@/lib/specs";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { JsonLd } from "@/components/json-ld";
import { productSchema, breadcrumbSchema } from "@/lib/structured-data";

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
  const available = isInStock(product);
  const { stats, rows, notes } = fullSpecs(product.title, product.description);
  // Обложка + дополнительные снимки из поля images (владелец пополняет сам)
  const gallery = [product.image, ...(product.images ?? [])].map(productImageUrl);

  // Крошки для разметки повторяют навигацию выше: Главная → Каталог → категория → товар
  const crumbs = [
    { name: "Главная", url: "/" },
    { name: "Каталог", url: "/catalog" },
    ...(category
      ? [{ name: category.title, url: `/catalog?category=${category.slug}` }]
      : []),
    { name: product.title, url: `/product/${product.slug}` },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-12">
      <JsonLd data={productSchema(product, category)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />
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
        {/* Фото: галерея с крупным просмотром */}
        <div className="md:sticky md:top-24 md:h-fit">
          <ProductGallery images={gallery} alt={product.title} />
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

          <div className="mt-7 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="font-display text-4xl font-extrabold">
              {formatPrice(product.price)}
            </span>
            {/* Наличие: посчитанный остаток главнее флага из прайса.
                Само число покупателю не показываем — это внутренний учёт. */}
            {available !== undefined && (
              <span className="inline-flex items-center gap-2 font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                <span
                  className={
                    available
                      ? "h-1.5 w-1.5 rounded-full bg-signal"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                  }
                />
                {available ? (
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

          {/* Ключевые цифры — крупные плашки; мощность всегда первая */}
          {stats.length > 0 && (
            <div
              className={`mt-8 grid gap-3 border-t border-border pt-6 ${
                stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border bg-surface p-4 text-center"
                >
                  <p className="font-display text-lg font-extrabold leading-tight text-signal sm:text-xl">
                    {s.value}
                  </p>
                  <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Полные характеристики: описание прайса + распознанное из названия */}
          {rows.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                Характеристики
              </h2>
              <dl className="mt-3 divide-y divide-border">
                {rows.map((s) =>
                  s.value === "" ? (
                    // Подзаголовок группы («Номинальная выходная мощность (RMS):»)
                    <div key={s.label} className="pb-1 pt-3.5">
                      <dt className="text-[0.85rem] font-semibold">{s.label}</dt>
                    </div>
                  ) : (
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
                  ),
                )}
              </dl>
            </div>
          )}

          {/* Особенности без ключей — остаток описания поставщика */}
          {notes.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                Особенности
              </h2>
              <ul className="mt-3 space-y-2">
                {notes.map((line, i) => (
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

      {/*
        Отзывы. Раньше здесь показывались сгенерированные из хеша slug тексты
        с именами и датами — это недостоверные сведения о товаре, на боевом
        домене прямой риск. Настоящих отзывов пока нет, поэтому честно говорим
        об этом и зовём оставить первый. Когда отзывы появятся — секция
        наполнится ими, а не заглушкой.
      */}
      <section id="reviews" className="mt-20 scroll-mt-28">
        <h2 className="font-display text-xl font-semibold uppercase">Отзывы</h2>
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <MessageSquare size={20} className="text-muted-foreground" />
          </span>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            Отзывов на этот товар пока нет. Уже брали его? Напишите пару слов о
            том, как он себя показал, — это поможет другим выбрать.
          </p>
          <a
            href={`${siteConfig.contacts.whatsapp}?text=${encodeURIComponent(
              `Отзыв о товаре: ${product.title}`,
            )}`}
            className="mt-1 inline-flex rounded-sm border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
          >
            Оставить отзыв
          </a>
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
