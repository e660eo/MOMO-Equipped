"use client";

import Link from "next/link";
import { ArrowRight, FileClock } from "lucide-react";
import { dealerDraftCounts } from "@/lib/dealer-order-draft";
import { useDealerDraft } from "@/lib/dealer-draft-client";
import { plural } from "@/lib/utils";

export function DealerDraftSummary({ accountId }: { accountId: string }) {
  const { draft } = useDealerDraft(accountId);
  const counts = dealerDraftCounts(draft);

  if (!counts.positions) return null;
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#ff5500]/25 bg-[#fff4ed] p-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ff5500] text-white"><FileClock size={19} aria-hidden /></span>
        <div>
          <p className="font-bold">У вас сохранён черновик заказа</p>
          <p className="mt-1 text-sm text-black/55">{counts.positions} {plural(counts.positions, "позиция", "позиции", "позиций")} · {counts.units} шт. Черновик привязан к вашему аккаунту.</p>
        </div>
      </div>
      <Link href="/dealer/order" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#111214] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">
        Продолжить <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}
