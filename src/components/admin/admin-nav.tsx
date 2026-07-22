"use client";

import { AdminNavLink } from "./nav-link";

const LINKS = [
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/news", label: "Новости" },
  { href: "/admin/bundles", label: "Сборки" },
  { href: "/admin/settings", label: "Контакты" },
];

/**
 * Навигация панели. Заказы первыми: за ними сюда заходят чаще всего,
 * а счётчик показывает, сколько заявок ещё не разобрано.
 */
export function AdminNav({ newOrders = 0 }: { newOrders?: number }) {
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.85rem]">
      {LINKS.map((link) => (
        <AdminNavLink
          key={link.href}
          {...link}
          badge={link.href === "/admin/orders" ? newOrders : 0}
        />
      ))}
    </nav>
  );
}
