import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Unbounded, Manrope, Syne } from "next/font/google";
import "./globals.css";

// Заголовки — фирменный Unbounded. Вес 800 добавлен к исходным 500/700
// для акцентных заголовков вроде «Реквизиты».
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-display-src",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

// Вордмарк «MOMO Equipped» в шапке
const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://momo-eq.ru"),
  title: {
    default: "MOMO — автоакустика и аксессуары",
    template: "%s · MOMO",
  },
  description:
    "Сабвуферы, усилители и эстрадная акустика MOMO. Гарантия 12 месяцев, доставка по всей России, оплата частями без процентов.",
  openGraph: {
    title: "MOMO — автоакустика и аксессуары",
    description:
      "Сабвуферы, усилители и эстрадная акустика MOMO. Гарантия 12 месяцев, доставка по всей России.",
    type: "website",
    locale: "ru_RU",
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
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Тема пишется в cookie переключателем и рендерится сервером — без вспышки и без inline-скрипта.
  const theme = (await cookies()).get("momo-theme")?.value;

  return (
    <html
      lang="ru"
      data-theme={theme === "dark" ? "dark" : undefined}
      className={`${unbounded.variable} ${manrope.variable} ${syne.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
