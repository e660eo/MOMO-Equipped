"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import {
  DEALER_ORDER_DRAFT_STORAGE_KEY,
  parseDealerOrderDraft,
  serializeDealerOrderDraft,
} from "@/lib/dealer-order-draft";

export function DealerRepeatOrderButton({
  items,
  className = "",
}: {
  items: Array<{ slug: string; qty: number }>;
  className?: string;
}) {
  const router = useRouter();

  function repeatOrder() {
    const current = parseDealerOrderDraft(localStorage.getItem(DEALER_ORDER_DRAFT_STORAGE_KEY));
    const quantities = { ...(current?.quantities ?? {}) };
    for (const item of items) {
      quantities[item.slug] = Math.min(999, (quantities[item.slug] ?? 0) + item.qty);
    }
    localStorage.setItem(
      DEALER_ORDER_DRAFT_STORAGE_KEY,
      serializeDealerOrderDraft(quantities, current?.comment ?? ""),
    );
    router.push("/dealer/order");
  }

  return (
    <button
      type="button"
      onClick={repeatOrder}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold transition-colors hover:border-[#ff5500] hover:text-[#ff5500] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] ${className}`}
    >
      <RotateCcw size={16} aria-hidden /> Повторить заказ
    </button>
  );
}
