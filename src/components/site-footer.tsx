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
      { href: "/#promo", label: "Акции и сплит" },
      { href: "/news", label: "Новости" },
      { href: "/contacts", label: "Контакты" },
      { href: "/requisites", label: "Реквизиты" },
    ],
  },
];

export function SiteFooter() {
  const { contacts, requisites } = siteConfig;
  return (
    <footer className="border-t border-border pb-10 pt-16">
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

        <div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-border pt-6 font-mono text-[0.68rem] tracking-wide text-muted-foreground">
          <span>
            {requisites.shortName} · ИНН {requisites.inn} · ОГРНИП{" "}
            {requisites.ogrnip}
          </span>
          <span>© 2026 MOMO</span>
        </div>
      </div>
    </footer>
  );
}
