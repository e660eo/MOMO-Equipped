"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useToast } from "@/lib/toast-store";
import { productImageUrl } from "@/lib/data";
import { ProductImage } from "./product-image";

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2.5 p-4 sm:inset-x-auto sm:right-5 sm:items-end">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="pointer-events-auto flex w-[min(360px,92vw)] items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.35)]"
          >
            {t.image ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-tile">
                <ProductImage
                  src={productImageUrl(t.image)}
                  alt=""
                  className="h-[84%] w-[84%] object-contain mix-blend-multiply"
                />
              </span>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-signal text-white">
                <Check size={18} strokeWidth={2.6} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[0.86rem] font-semibold leading-tight">
                {t.title}
              </p>
              {t.description && (
                <p className="mt-0.5 truncate text-[0.78rem] text-muted-foreground">
                  {t.description}
                </p>
              )}
            </div>

            {t.actionLabel && (
              <button
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-sm px-2.5 py-1.5 font-mono text-[0.68rem] uppercase tracking-wider text-signal transition-colors hover:bg-signal/10"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Закрыть"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
