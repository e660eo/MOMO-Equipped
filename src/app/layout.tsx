import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
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
      <body>
        {/* Top.Mail.Ru: run at the start of the document, load the counter asynchronously. */}
        <script
          id="top-mail-ru-counter"
          dangerouslySetInnerHTML={{ __html: `var _tmr = window._tmr || (window._tmr = []);
_tmr.push({id: "3811856", type: "pageView", start: (new Date()).getTime()});
(function (d, w, id) {
  if (d.getElementById(id)) return;
  var ts = d.createElement("script"); ts.type = "text/javascript"; ts.async = true; ts.id = id;
  ts.src = "https://top-fwz1.mail.ru/js/code.js";
  var f = function () {var s = d.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ts, s);};
  if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); }
})(document, window, "tmr-code");` }}
        />
        <noscript>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Tracking pixel must bypass image optimization. */}
            <img src="https://top-fwz1.mail.ru/counter?id=3811856;js=na" style={{ position: "absolute", left: "-9999px" }} alt="Top.Mail.Ru" />
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
