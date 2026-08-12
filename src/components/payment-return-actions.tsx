"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";

/** После подтверждённой оплаты локальная корзина больше не нужна. */
export function ClearCartAfterPayment() {
  const clear = useCart((s) => s.clear);
  useEffect(() => clear(), [clear]);
  return null;
}

/**
 * Старую ссылку Яндекс Pay повторно не открываем: её 3DS-сессия могла истечь.
 * Корзина сохранена, поэтому новый клик создаст новый orderId и новую ссылку.
 */
export function ReturnToCartForNewPayment() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/cart")}
      className="mt-6 inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
    >
      Вернуться в корзину
    </button>
  );
}
