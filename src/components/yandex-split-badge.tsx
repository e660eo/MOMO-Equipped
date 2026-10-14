"use client";

import { createElement, useEffect, useState } from "react";
import Script from "next/script";
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
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);
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

  if (!requested) return (
    <div className={cn("max-w-full", className)}>
      <button type="button" onClick={() => setRequested(true)}
        title="При открытии предложения Яндекс получит технические данные браузера и может использовать свои cookie."
        className="min-h-11 text-left text-xs underline underline-offset-4">
        Посмотреть условия Яндекс Сплита
      </button>
      <p className="text-[0.65rem] text-muted-foreground">Загрузится сервис Яндекса</p>
    </div>
  );

  return (
    <div className={cn("max-w-full", className)}>
      <Script id="yandex-pay-web-sdk" src="https://pay.yandex.ru/sdk/v1/pay.js"
        strategy="afterInteractive" onError={() => setFailed(true)} />
      {failed && <p role="status" className="text-xs text-muted-foreground">Предложение пока недоступно. Условия можно проверить при переходе к оплате.</p>}
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
