"use client";

import { createElement, useEffect, useState } from "react";
import { useSiteConfig } from "@/components/site-config-provider";
import { cn } from "@/lib/utils";

type BadgeSize = "s" | "m" | "l";
type BadgeVariant = "simple" | "detailed";
type BadgeColor = "primary" | "green" | "grey" | "transparent";

/*
  Официальный бейдж Яндекс Сплита.

  Это web-component из Web SDK Яндекс Пэй, а не нарисованная нами плашка:
  Яндекс сам решает, доступен ли Сплит конкретному покупателю, и рассчитывает
  подходящий платёж. Если предложение недоступно, SDK не показывает бейдж —
  поэтому рядом нет нашего обещания «цена / 4», которое могло бы соврать.
*/
export function YandexSplitBadge({
  amount,
  size = "s",
  variant = "simple",
  color = "transparent",
  className,
}: {
  amount: number;
  size?: BadgeSize;
  variant?: BadgeVariant;
  color?: BadgeColor;
  className?: string;
}) {
  const { payEnabled, payMerchantId } = useSiteConfig();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const update = () =>
      setTheme(root.dataset.theme === "dark" ? "dark" : "light");

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  if (!payEnabled || !payMerchantId || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return (
    <div className={cn("max-w-full", className)}>
      {createElement("yandex-pay-badge", {
        key: `${theme}-${amount}-${size}-${variant}-${color}`,
        type: "bnpl",
        amount: amount.toFixed(2),
        size,
        variant,
        color,
        theme,
        "merchant-id": payMerchantId,
        "aria-label": "Условия оплаты через Яндекс Сплит",
      })}
    </div>
  );
}
