"use client";

import Link from "next/link";
import { Package, Plus } from "lucide-react";
import type { ResolvedBundle } from "@/lib/types";
import { formatPrice, splitPayment, productImageUrl } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { ProductImage } from "./product-image";

export function BundleCard({ bundle }: { bundle: ResolvedBundle }) {
  const addMany = useCart((s) => s.addMany);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-6 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-signal/60 hover:shadow-[0_18px_50px_-24px_rgba(255,85,0,0.45)]">
      {/* мягкое оранжевое свечение по ховеру */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(460px_240px_at_50%_-10%,rgba(255,85,0,0.13),transparent_70%)]"
      />

      <div className="relative z-[1] flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
          <Package size={13} className="text-signal" />
          {bundle.tagline}
        </span>
        <span className="rounded-full bg-signal px-2.5 py-1 font-mono text-[0.62rem] font-medium uppercase tracking-wide text-white">
          −{bundle.discountPercent}%
        </span>
      </div>

      <h3 className="relative z-[1] mt-3 font-display text-[1.35rem] font-semibold uppercase leading-tight">
        {bundle.title}
      </h3>
      <p className="relative z-[1] mt-2.5 text-[0.88rem] leading-relaxed text-muted-foreground">
        {bundle.description}
      </p>

      {/* Состав сборки */}
      <ul className="relative z-[1] mt-5 space-y-2 border-t border-border pt-4">
        {bundle.products.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/product/${p.slug}`}
              className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-tile">
                <ProductImage
                  src={productImageUrl(p.image)}
                  alt=""
                  className="h-[84%] w-[84%] object-contain mix-blend-multiply"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.8rem]">
                {p.title}
              </span>
              <span className="shrink-0 font-mono text-[0.72rem] text-muted-foreground">
                {formatPrice(p.price)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Цена и добавление */}
      <div className="relative z-[1] mt-auto pt-5">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-extrabold">
            {formatPrice(bundle.price)}
          </span>
          <span className="font-mono text-[0.8rem] text-muted-foreground line-through">
            {formatPrice(bundle.fullPrice)}
          </span>
        </div>
        <p className="mt-1 font-mono text-[0.72rem] text-[var(--signal-text)]">
          Выгода {formatPrice(bundle.saving)} · сплит{" "}
          {formatPrice(splitPayment(bundle.price))} × 4
        </p>

        <button
          onClick={() =>
            addMany(
              bundle.products.map((p) => ({
                slug: p.slug,
                title: p.title,
                price: p.price,
                image: p.image,
              })),
              {
                title: "Сборка добавлена",
                description: `${bundle.title} — ${bundle.products.length} товара`,
              },
            )
          }
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-signal px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
        >
          <Plus size={15} strokeWidth={2.6} />
          Добавить сборку
        </button>
      </div>
    </div>
  );
}
