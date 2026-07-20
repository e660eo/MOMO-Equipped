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

/*
  Футер целиком на тёмном градиенте — в том же языке, что баннер «Сплит 0%»,
  карточка консультации и hero страницы уценки. Он всегда тёмный, независимо
  от темы сайта: это осознанный якорь в конце страницы.

  Логотип парит той же анимацией, что на главном экране (класс
  hero-logo-float — чистый CSS, поэтому футер остаётся серверным компонентом).
*/
export function SiteFooter() {
  const { contacts, requisites } = siteConfig;

  const linkCls =
    "text-[0.88rem] text-white/65 transition-colors hover:text-signal";
  const headCls =
    "mb-4 font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40";

  return (
    <footer className="relative overflow-hidden text-[#f5f3ef] [background:radial-gradient(110%_150%_at_88%_8%,rgba(255,85,0,0.2),transparent_58%),linear-gradient(115deg,#0d0d0f_0%,#1b1b1f_62%,#232327_100%)]">
      <div className="mx-auto max-w-[1200px] px-6 pb-10 pt-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          {/* Логотип и адрес */}
          <div>
            <Image
              src="/logo-3d.png"
              alt="MOMO Equipped"
              width={1500}
              height={985}
              sizes="260px"
              className="hero-logo-float h-auto w-[230px] max-w-full invert"
            />
            <p className="mt-6 max-w-[34ch] text-[0.85rem] leading-relaxed text-white/55">
              Автоакустика и аксессуары. {contacts.address}.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className={headCls}>{col.title}</h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkCls}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className={headCls}>Контакты</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`}
                  className={linkCls}
                >
                  {contacts.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${contacts.email}`} className={linkCls}>
                  {contacts.email}
                </a>
              </li>
              <li>
                <a href={contacts.whatsapp} className={linkCls}>
                  WhatsApp · Telegram
                </a>
              </li>
              <li className="pt-1 text-[0.82rem] text-white/40">
                {contacts.hours}
              </li>
            </ul>
          </div>
        </div>

        {/* Нижняя строка: реквизиты */}
        <div className="mt-14 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-[0.74rem] tabular-nums text-white/45">
            {requisites.shortName} · ИНН {requisites.inn} · ОГРНИП{" "}
            {requisites.ogrnip}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link
              href="/requisites"
              className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/70 underline-offset-4 transition-colors hover:text-signal hover:underline"
            >
              Реквизиты и информационная карта
            </Link>
            <span className="text-[0.74rem] text-white/35">© 2026 MOMO</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
