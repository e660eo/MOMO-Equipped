import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/data";

const cols = [
  {
    title: "Каталог",
    links: [
      { href: "/catalog?category=sabvufery", label: "Сабвуферы" },
      { href: "/catalog?category=usiliteli-monobloki", label: "Усилители" },
      { href: "/catalog?category=dinamiki-rupora", label: "Динамики" },
      { href: "/catalog?category=aksessuary", label: "Аксессуары" },
    ],
  },
  {
    title: "Покупателям",
    links: [
      { href: "/sale", label: "Уценка" },
      { href: "/#promo", label: "Акции и сплит" },
      { href: "/news", label: "Новости" },
      { href: "/contacts", label: "Контакты" },
    ],
  },
];

export function SiteFooter() {
  const { contacts, requisites } = siteConfig;
  return (
    <footer className="border-t border-border pt-16">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1.4fr]">
          <div>
            <Image
              src="/logo.png"
              alt="MOMO"
              width={78}
              height={34}
              className="mb-4 h-[34px] w-auto dark-logo"
            />
            <p className="max-w-[32ch] text-[0.85rem] text-muted-foreground">
              Автоакустика и аксессуары. {contacts.address}.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="mb-4 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
              Контакты
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`}
                  className="text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {contacts.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contacts.email}`}
                  className="text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {contacts.email}
                </a>
              </li>
              <li>
                <a
                  href={contacts.whatsapp}
                  className="text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  WhatsApp · Telegram
                </a>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/*
        Нижняя плашка — тёмная, в том же градиентном языке, что баннер
        «Сплит 0%» и карточка консультации. Логотип парит той же анимацией,
        что и на главном экране (класс hero-logo-float — чистый CSS,
        клиентский компонент здесь не нужен).
      */}
      <div className="mt-14 border-t border-border">
        <div className="relative overflow-hidden text-[#f5f3ef] [background:radial-gradient(120%_180%_at_88%_10%,rgba(255,85,0,0.22),transparent_55%),linear-gradient(115deg,#0d0d0f_0%,#1b1b1f_62%,#232327_100%)]">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-6 py-10 md:flex-row md:justify-between">
            <Image
              src="/logo-3d.png"
              alt="MOMO Equipped"
              width={1500}
              height={985}
              sizes="220px"
              className="hero-logo-float h-auto w-[190px] shrink-0 invert md:w-[210px]"
            />

            <div className="flex flex-col items-center gap-2 text-center md:items-end md:text-right">
              <p className="text-[0.72rem] tracking-wide text-white/55 tabular-nums">
                {requisites.shortName} · ИНН {requisites.inn} · ОГРНИП{" "}
                {requisites.ogrnip}
              </p>
              <Link
                href="/requisites"
                className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/75 underline-offset-4 transition-colors hover:text-signal hover:underline"
              >
                Реквизиты и информационная карта
              </Link>
              <p className="mt-1 text-[0.72rem] text-white/40">© 2026 MOMO</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
