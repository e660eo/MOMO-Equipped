"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, ShoppingCart, Menu } from "lucide-react";
import { useCart, cartCount } from "@/lib/cart-store";
import { useAccount } from "@/lib/account-store";
import { useCustomer } from "@/components/customer-provider";
import { ThemeToggle } from "./theme-toggle";
import { CatalogMenu } from "./catalog-menu";
import { HeaderExtras, CityPicker } from "./header-extras";
import { HeaderSearch } from "./header-search";
import { cn } from "@/lib/utils";

// Реквизиты намеренно не здесь — они живут в нижней плашке футера,
// это служебная информация, а не пункт основной навигации.
const nav = [
  { href: "/about", label: "О компании" },
  { href: "/news/novinki-momo-2026", label: "Новинки" },
  { href: "/listening-stand", label: "Онлайн-стенд", beta: true },
  { href: "/news", label: "Новости" },
  { href: "/support", label: "Поддержка" },
];

// «Уценка» уехала из верхней навигации в каталог: на десктопе — ссылкой в
// мега-меню «Каталог», на телефоне держим её сразу за «Каталогом».
const mobileNav: { href: string; label: string; accent?: boolean; beta?: boolean }[] = [
  { href: "/catalog", label: "Каталог", accent: true },
  { href: "/sale", label: "Уценка" },
  ...nav,
  { href: "/dealers", label: "Купить рядом" },
  { href: "/become-dealer", label: "Стать дилером" },
  { href: "/dealer/login", label: "Вход для дилеров" },
  { href: "/contacts", label: "Контакты" },
];

/*
  Строка мобильного меню. Проявляется с задержкой по своему месту в списке —
  получается волна сверху вниз вслед за раскрытием шторки. Закрывается всё
  разом, без задержек: закрытие должно ощущаться мгновенным.
*/
function MenuRow({
  index,
  open,
  children,
}: {
  index: number;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-300 ease-out",
        open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
      )}
      style={{ transitionDelay: open ? `${40 + index * 30}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

export function SiteHeader() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  /*
    Вошёл покупатель или нет — знает сервер по подписанной куке, и только он.
    Раньше шапка спрашивала об этом localStorage, оставшийся от старого
    браузерного аккаунта: вход и регистрация ходят на сервер и этот флаг не
    трогают, поэтому сразу после регистрации кнопка снова предлагала войти.
  */
  const customer = useCustomer();
  const authed = customer !== null;
  const openAuth = useAccount((s) => s.openModal);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = cartCount(items);

  // Вошедшего ведём в кабинет, остальным открываем вход
  function accountAction() {
    setMenuOpen(false);
    if (authed) router.push("/profile");
    else openAuth();
  }

  // Ссылка стабильна — иначе поиск перерисовывался бы вслед за шапкой
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  /*
    Размытие подложки — только на десктопе. Шапка липкая, поэтому на телефоне
    backdrop-filter пересчитывался на каждом кадре прокрутки по всей ширине
    экрана: это самый дорогой из здешних эффектов и самая заметная просадка
    при листании каталога. Там шапка просто непрозрачная — разницы на глаз
    нет, а прокрутка становится ровной.
  */
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg md:bg-bg/90 md:backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          aria-label="MOMO Equipped — на главную"
          className="inline-flex min-h-11 shrink-0 items-center font-wordmark text-base font-extrabold uppercase leading-none tracking-tight sm:text-lg md:text-xl"
        >
          MOMO <span className="font-bold text-signal">Equipped</span>
        </Link>

        {/* Кнопка «Каталог» с эффектом specular и мега-меню */}
        <div className="hidden md:block">
          <CatalogMenu />
        </div>

        {/* Поиск с живыми подсказками — со своим состоянием, см. header-search */}
        <HeaderSearch />

        {/*
          На узком экране логотип и четыре кнопки в строку не помещались —
          шапка расходилась на 483px при 375 и уносила за собой горизонтальный
          скролл всей страницы. В меню уехала тема, корзина ужалась до иконки
          со счётчиком-бейджем. Вход остался в шапке: кабинет нужен чаще, чем
          смена темы, и искать его в меню — лишнее нажатие.
        */}
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5 md:ml-0">
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          <button
            onClick={accountAction}
            className="tap-44 relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition duration-150 hover:border-signal hover:text-signal active:scale-90"
            aria-label="Личный кабинет"
          >
            <User size={16} />
            {authed && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-signal"
              />
            )}
          </button>
          <Link
            href="/cart"
            className={cn(
              "tap-44 relative inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition duration-150 hover:border-signal hover:text-signal active:scale-90 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2",
              count > 0 ? "border-signal/50 text-signal" : "border-border",
            )}
            aria-label={`Корзина, товаров: ${count}`}
          >
            <ShoppingCart size={15} />
            <span className="relative hidden h-[1.2em] min-w-[0.7em] justify-center overflow-hidden tabular-nums sm:inline-flex">
              <span key={count}>{count}</span>
            </span>
            {/* Счётчик на мобильном — бейджем поверх иконки */}
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-signal px-1 text-[0.62rem] font-bold leading-none text-white sm:hidden"
              >
                {count}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="tap-44 relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition duration-150 hover:border-signal hover:text-signal active:scale-90 md:hidden"
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
          <div className="flex items-center gap-5">
            <CityPicker />
            <span className="h-4 w-px bg-border" />
            <nav className="flex gap-5 xl:gap-7" aria-label="Основная навигация">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="relative inline-flex text-[0.82rem] font-medium tracking-wide text-muted-foreground transition-colors hover:text-signal"
                >
                  {n.label}
                  {n.beta && (
                    <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 rounded-full bg-signal px-1.5 py-px font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.12em] text-white">
                      Beta
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
          <HeaderExtras />
        </div>
      </div>

      {/*
        Мобильное меню.

        Раскрывается сеткой 0fr → 1fr, а не по max-height: высота считается по
        настоящему содержимому. Прежние max-h-96 обрезали последний пункт, а
        подсказкам поиска запаса не хватило бы и подавно. inert убирает
        свёрнутое меню из обхода клавиатурой — иначе Tab уходит в невидимое.
      */}
      <div
        inert={!menuOpen}
        className={cn(
          "grid border-t border-border transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden",
          menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr] border-t-0",
        )}
      >
        <div className="overflow-hidden">
          {/* С открытой клавиатурой видно немного — длинный список прокручивается */}
          <div className="mx-auto max-h-[70dvh] max-w-[1200px] overflow-y-auto px-4 py-3 sm:px-6">
            <MenuRow index={0} open={menuOpen}>
              <HeaderSearch variant="mobile" onNavigate={closeMenu} />
            </MenuRow>
            {/* Пункты меню — не меньше 44px в высоту, это область нажатия пальцем */}
            <nav className="flex flex-col">
              {mobileNav.map((n, i) => (
                <MenuRow key={n.href} index={i + 1} open={menuOpen}>
                  <Link
                    href={n.href}
                    onClick={closeMenu}
                    className={cn(
                      "flex min-h-11 items-center border-b border-border py-3.5 text-sm",
                      n.accent
                        ? "font-semibold text-signal"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    <span className="inline-flex flex-col items-start gap-1">
                      <span>{n.label}</span>
                      {n.beta && (
                        <span className="rounded-full bg-signal px-1.5 py-px font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.12em] text-white">
                          Beta
                        </span>
                      )}
                    </span>
                  </Link>
                </MenuRow>
              ))}
              <MenuRow index={mobileNav.length + 1} open={menuOpen}>
                <ThemeToggle variant="row" className="border-0 sm:hidden" />
              </MenuRow>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
