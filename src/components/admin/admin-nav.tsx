"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/news", label: "Новости" },
  { href: "/admin/bundles", label: "Сборки" },
  { href: "/admin/settings", label: "Контакты" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.85rem]">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "transition-colors hover:text-signal",
              active ? "font-semibold text-signal" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
