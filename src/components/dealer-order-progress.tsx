import { Check, X } from "lucide-react";
import {
  DEALER_ORDER_STATUS_LABELS,
  DEALER_ORDER_STEPS,
  dealerOrderProgressIndex,
} from "@/lib/dealer-order-ui";
import type { DealerOrderStatus } from "@/lib/types";

export function DealerOrderProgress({ status }: { status: DealerOrderStatus }) {
  if (status === "canceled") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-red-100"><X size={16} aria-hidden /></span>
        Заказ отменён. Если нужно восстановить его, свяжитесь с менеджером.
      </div>
    );
  }

  const current = dealerOrderProgressIndex(status);
  return (
    <ol aria-label={`Статус заказа: ${DEALER_ORDER_STATUS_LABELS[status]}`} className="grid grid-cols-4">
      {DEALER_ORDER_STEPS.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <li key={step.status} aria-current={active ? "step" : undefined} className="relative min-w-0 text-center">
            {index > 0 && (
              <span aria-hidden className={`absolute left-[-50%] right-[50%] top-4 h-0.5 ${index <= current ? "bg-[#ff5500]" : "bg-black/10"}`} />
            )}
            <span className={`relative mx-auto grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-black ${complete ? "border-[#ff5500] bg-[#ff5500] text-white" : active ? "border-[#ff5500] bg-white text-[#ff5500]" : "border-black/10 bg-white text-black/35"}`}>
              {complete ? <Check size={15} aria-hidden /> : index + 1}
            </span>
            <span className={`mt-2 block truncate px-1 text-[0.65rem] font-bold sm:text-xs ${active || complete ? "text-black" : "text-black/40"}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
