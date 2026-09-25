"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useDealerDraft } from "@/lib/dealer-draft-client";

export function DealerRepeatOrderButton({
  items,
  accountId,
  className = "",
}: {
  items: Array<{ slug: string; qty: number }>;
  accountId: string;
  className?: string;
}) {
  const router = useRouter();
  const draft = useDealerDraft(accountId);

  function repeatOrder() {
    draft.addItems(items);
    router.push("/dealer/order");
  }

  return (
    <button
      type="button"
      onClick={repeatOrder}
      disabled={!draft.loaded || draft.status === "auth"}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold transition-colors hover:border-[#ff5500] hover:text-[#ff5500] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] disabled:opacity-40 ${className}`}
    >
      <RotateCcw size={16} aria-hidden /> Повторить заказ
    </button>
  );
}
