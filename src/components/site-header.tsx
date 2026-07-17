"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, ShoppingCart, Menu, Search } from "lucide-react";
import { useCart, cartCount } from "@/lib/cart-store";
import { ThemeToggle } from "./theme-toggle";
import { AuthModal } from "./auth-modal";
import { CatalogMenu } from "./catalog-menu";
import { HeaderExtras } from "./header-extras";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/#promo", label: "Акции" },
  { href: "/news", label: "Новости" },
  { href: "/contacts", label: "Контакты" },
  { href: "/requisites", label: "Реквизиты" },
];

export function SiteHeader() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.openCart);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const count = cartCount(items);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/catalog?search=${encodeURIComponent(q)}` : "/catalog");
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-4 px-6">
        <Link
          href="/"
          aria-label="MOMO Equipped — на главную"
          className="shrink-0 font-wordmark text-lg font-extrabold uppercase leading-none tracking-tight sm:text-xl"
        >
          MOMO <span className="font-bold text-signal">Equipped</span>
        </Link>

        {/* Кнопка «Каталог» с эффектом specular и мега-меню */}
        <div className="hidden md:block">
          <CatalogMenu />
        </div>

        {/* Поиск */}
        <form
          onSubmit={submitSearch}
          className="relative hidden flex-1 md:block"
          role="search"
        >
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти товары…"
            aria-label="Поиск товаров"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground transition-colors focus:border-signal focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <ThemeToggle />
          <button
            onClick={() => setAuthOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
            aria-label="Войти"
          >
            <User size={16} />
          </button>
          <button
            onClick={openCart}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            aria-label={`Корзина, товаров: ${count}`}
          >
            <ShoppingCart size={15} />
            <span className="tabular-nums">{count}</span>
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border md:hidden"
            aria-label="Меню"
            aria-expanded={menuOpen}
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* Нав-ряд (десктоп): слева ссылки, справа город и плашки */}
      <div className="hidden border-t border-border md:block">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-2.5">
          <nav className="flex gap-7" aria-label="Основная навигация">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-[0.82rem] font-medium tracking-wide text-muted-foreground transition-colors hover:text-signal"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <HeaderExtras />
        </div>
      </div>

      {/* Мобильное меню */}
      <div
        className={cn(
          "overflow-hidden border-t border-border md:hidden",
          menuOpen ? "max-h-96" : "max-h-0 border-t-0",
        )}
        style={{ transition: "max-height .25s ease" }}
      >
        <div className="mx-auto max-w-[1200px] px-6 py-3">
          <form onSubmit={submitSearch} role="search" className="relative mb-2">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти товары…"
              aria-label="Поиск товаров"
              className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground focus:border-signal focus:outline-none"
            />
          </form>
          <nav className="flex flex-col">
            <Link
              href="/catalog"
              onClick={() => setMenuOpen(false)}
              className="border-b border-border py-3.5 text-sm font-semibold text-signal"
            >
              Каталог
            </Link>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-border py-3.5 text-sm font-medium text-muted-foreground last:border-0"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}
