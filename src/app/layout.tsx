import type { Metadata } from "next";
import Script from "next/script";
import { SITE_URL } from "@/lib/site-url";
import { DEFAULT_SOCIAL_IMAGE } from "@/lib/seo-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MOMO — автоакустика и аксессуары",
    template: "%s · MOMO",
  },
  description:
    "Сабвуферы, усилители и эстрадная акустика MOMO. Гарантия 12 месяцев, 24 месяца при авторизованной установке. Доставка по России.",
  openGraph: {
    title: "MOMO — автоакустика и аксессуары",
    description:
      "Сабвуферы, усилители и эстрадная акустика MOMO. Гарантия 12 месяцев, 24 месяца при авторизованной установке.",
    type: "website",
    locale: "ru_RU",
    url: "/",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "MOMO — автоакустика и аксессуары",
    description: "Сабвуферы, усилители и эстрадная акустика MOMO и ZEUS.",
    images: [DEFAULT_SOCIAL_IMAGE.url],
  },
  // Невидимая метка версии: по ней снаружи видно, какая сборка развёрнута.
  // Правка данных и пустой коммит не меняют бандлы, и без метки выкат
  // неотличим от его отсутствия.
  other: {
    "build-revision": process.env.BUILD_REVISION ?? "unknown",
    "build-time": process.env.BUILD_TIME ?? "unknown",
  },
};

/*
  Корневой каркас: язык, тема, шрифты. Обвязка магазина (шапка, футер,
  корзина, счётчик Метрики) живёт в layout группы `(shop)` — панель
  управления на /admin рисуется на чистом листе, без витрины вокруг.
*/
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
