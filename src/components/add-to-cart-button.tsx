"use client";

import { useCart } from "@/lib/cart-store";
import { isInStock, stockLimit } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

/*
  Кнопка покупки.

  Распроданный товар в корзину не кладём: заказ уходит менеджеру в WhatsApp,
  и обещание «положили — значит есть» должно быть честным. Вместо этого
  предлагаем оформить под заказ.

  Больше остатка тоже не даём набрать — иначе покупатель узнает о нехватке
  уже от менеджера.
*/
export function AddToCartButton({
  product,
  size = "sm",
}: {
  product: Pick<Product, "slug" | "title" | "price" | "image" | "inStock" | "stock">;
  size?: "sm" | "lg";
}) {
  const add = useCart((s) => s.add);
  const items = useCart((s) => s.items);

  const soldOut = isInStock(product as Product) === false;
  const limit = stockLimit(product as Product);
  const inCart = items.find((i) => i.slug === product.slug)?.qty ?? 0;
  const reachedLimit = limit !== null && inCart >= limit;

  const base =
    size === "lg"
      ? "w-full rounded-sm px-8 py-4 text-sm font-semibold transition-all active:scale-[0.98] sm:w-auto"
      : "rounded-sm px-3 py-2 text-xs font-semibold transition-all active:scale-[0.97]";

  if (soldOut) {
    return (
      <span
        className={cn(
          base,
          "inline-flex items-center justify-center border border-border text-muted-foreground",
        )}
        title="Сейчас нет на складе — напишите нам, привезём под заказ"
      >
        Под заказ
      </span>
    );
  }

  return (
    <button
      disabled={reachedLimit}
      onClick={(e) => {
        e.preventDefault();
        add({
          slug: product.slug,
          title: product.title,
          price: product.price,
          image: product.image,
          ...(limit !== null ? { stock: limit } : {}),
        });
      }}
      title={
        reachedLimit
          ? "Это всё, что есть на складе"
          : undefined
      }
      className={cn(
        base,
        size === "lg"
          ? "bg-signal text-white hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
          : "border border-border hover:border-signal hover:text-signal",
        reachedLimit && "cursor-not-allowed opacity-55 hover:border-border hover:text-muted-foreground hover:shadow-none",
      )}
    >
      {reachedLimit ? "Всё, что есть" : "В корзину"}
    </button>
  );
}
