import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Unbounded, Manrope, Syne } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

/*
  Шрифты.

  Все три гарнитуры — переменные (variable): один файл покрывает весь диапазон
  насыщенности. Раньше веса перечислялись руками, и каждый превращался в
  отдельный файл на каждый набор символов: три начертания Unbounded на латиницу
  и кириллицу — это шесть загрузок, четыре Manrope — восемь, и так далее.
  Убрав weight, получаем по одному файлу на набор символов и заодно снимаем
  риск, что где-то понадобится вес, которого нет в списке, и браузер нарисует
  его сам, разъехавшись с макетом.

  display: "swap" — текст виден сразу подставным шрифтом, а не прячется на
  время загрузки. Метрики подставного Next подгоняет под настоящий, поэтому
  подмена не сдвигает верстку.
*/
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display-src",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

/*
  Вордмарк «MOMO Equipped» в шапке — два слова латиницей в единственном месте.
  Предзагрузку не просим: канал в первые секунды нужнее снимку первого экрана,
  а вордмарк доедет через подставной шрифт без заметного скачка.
*/
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
