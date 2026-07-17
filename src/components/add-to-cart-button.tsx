"use client";

import { useCart } from "@/lib/cart-store";
import type { Product } from "@/lib/types";

export function AddToCartButton({
  product,
  size = "sm",
}: {
  product: Pick<Product, "slug" | "title" | "price" | "image">;
  size?: "sm" | "lg";
}) {
  const add = useCart((s) => s.add);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        add({
          slug: product.slug,
          title: product.title,
          price: product.price,
          image: product.image,
        });
      }}
      className={
        size === "lg"
          ? "w-full rounded-sm bg-signal px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)] sm:w-auto"
          : "rounded-sm border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-signal hover:text-signal"
      }
    >
      В корзину
    </button>
  );
}
