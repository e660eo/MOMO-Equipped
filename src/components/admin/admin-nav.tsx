"use client";

import { AdminNavLink } from "./nav-link";

const LINKS = [
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/news", label: "Новости" },
  { href: "/admin/bundles", label: "Сборки" },
  { href: "/admin/settings", label: "Контакты" },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.85rem]">
      {LINKS.map((link) => (
        <AdminNavLink key={link.href} {...link} />
      ))}
    </nav>
  );
}
