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
      { href: "/delivery", label: "Доставка и оплата" },
      { href: "/sale", label: "Уценка" },
      { href: "/#promo", label: "Акции и сплит" },
      { href: "/install", label: "Где установить" },
      { href: "/about", label: "О компании" },
      { href: "/contacts", label: "Контакты" },
    ],
  },
];

/*
  Соцсети: только реально существующие каналы (из site.json). VK/YouTube
  и прочие НЕ добавляем, пока владелец не даст настоящие ссылки — битая
  или чужая соцсеть хуже её отсутствия.
*/

// Нижняя строка футера: обязательные по 152-ФЗ и обычаю оборота документы.
const legal = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/requisites", label: "Реквизиты" },
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
            {/* Соцсети и мессенджеры */}
            <div className="mt-5 flex gap-2.5">
              <a
                href={contacts.whatsapp}
                aria-label="WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-signal hover:text-signal"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.16-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.16l-.3-.18-3.06.77.8-2.98-.2-.31A8.2 8.2 0 1 1 12 20.2Zm4.5-6.13c-.25-.12-1.46-.72-1.68-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.35-2.93c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.66.3-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
                </svg>
              </a>
              <a
                href={contacts.telegram}
                aria-label="Telegram"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-signal hover:text-signal"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M21.9 4.6 18.9 19c-.23 1-.83 1.26-1.68.78l-4.65-3.43-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.1 12.97l-4.58-1.43c-1-.31-1.02-1 .2-1.47L20.6 3.2c.83-.31 1.55.19 1.3 1.4Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Нижняя строка: реквизиты */}
        <div className="mt-14 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-[0.74rem] tabular-nums text-white/45">
            {requisites.shortName} · ИНН {requisites.inn} · ОГРНИП{" "}
            {requisites.ogrnip}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legal.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/70 underline-offset-4 transition-colors hover:text-signal hover:underline"
              >
                {l.label}
              </Link>
            ))}
            <span className="text-[0.74rem] text-white/35">© 2026 MOMO</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
