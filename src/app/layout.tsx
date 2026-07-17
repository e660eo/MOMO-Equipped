import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Unbounded, Manrope, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import ClickSpark from "@/components/ui/ClickSpark";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
  variable: "--font-unbounded",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-manrope",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
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
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Тема пишется в cookie переключателем и рендерится сервером — без вспышки и без inline-скрипта.
  const theme = (await cookies()).get("momo-theme")?.value;

  return (
    <html
      lang="ru"
      data-theme={theme === "dark" ? "dark" : undefined}
      className={`${unbounded.variable} ${manrope.variable} ${jetbrains.variable} ${syne.variable}`}
    >
      <body>
        <ClickSpark sparkColor="#ff5500" sparkSize={11} sparkRadius={18} sparkCount={8} duration={450}>
          <AnnouncementBar />
          <SiteHeader />
          {children}
          <SiteFooter />
        </ClickSpark>
        <CartDrawer />
      </body>
    </html>
  );
}
