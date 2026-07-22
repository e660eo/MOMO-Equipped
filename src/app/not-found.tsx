import Link from "next/link";
import { Disc3, Zap, Volume2, Tag } from "lucide-react";
import { siteConfig, getProducts } from "@/lib/data";
import { plural } from "@/lib/utils";
import { ShopChrome } from "@/components/shop-chrome";

/*
  Страница 404.

  Особенно важна при переезде домена: со старого сайта останутся
  проиндексированные ссылки, и человек не должен упираться в пустоту —
  отсюда быстрые переходы в популярные разделы и прямой контакт.
*/

export const metadata = {
  title: "Страница не найдена",
  description: "Такой страницы нет — но каталог MOMO на месте.",
};

const shortcuts = [
  { href: "/catalog", label: "Весь каталог", icon: Disc3 },
  { href: "/catalog?category=sabvufery", label: "Сабвуферы", icon: Volume2 },
  { href: "/catalog?category=usiliteli-monobloki", label: "Усилители", icon: Zap },
  { href: "/sale", label: "Уценка", icon: Tag },
];

/*
  404 лежит в корне приложения — она ловит любые адреса, в том числе вне
  группы `(shop)`, и группового layout не получает. Шапку и футер поэтому
  подключаем здесь явно, тем же компонентом, что и витрина.
*/
export default function NotFound() {
  return (
    <ShopChrome>
    <main className="mx-auto flex min-h-[68vh] max-w-[1200px] flex-col items-center justify-center px-6 py-20 text-center">
      {/* Осциллограмма с обрывом — «сигнал потерян» */}
      <svg
        aria-hidden
        viewBox="0 0 640 120"
        className="mb-8 w-full max-w-[520px] text-border"
        fill="none"
      >
        <path
          d="M0 60 H150 L165 28 L180 92 L195 60 H250"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M390 60 H445 L460 28 L475 92 L490 60 H640"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* разрыв сигнала */}
        <path
          d="M270 60 h14 M300 60 h14 M330 60 h14 M360 60 h14"
          stroke="var(--color-signal)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
        Ошибка 404
      </p>
      <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3.6rem)] font-extrabold uppercase leading-[1.02]">
        Сигнал <span className="text-signal">потерян</span>
      </h1>
      <p className="mx-auto mt-5 max-w-[46ch] text-muted-foreground">
        Такой страницы нет — возможно, товар снят с продажи или ссылка устарела.
        Но каталог на месте: {getProducts().length}{" "}
        {plural(getProducts().length, "позиция", "позиции", "позиций")} ждут.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link
          href="/catalog"
          className="inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,0.35)]"
        >
          Смотреть каталог
        </Link>
        <Link
          href="/"
          className="inline-flex rounded-sm border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          На главную
        </Link>
      </div>

      {/* Быстрые переходы в популярные разделы */}
      <div className="mt-12 grid w-full max-w-[760px] grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-surface p-5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-signal/60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-bg text-signal transition-colors duration-300 group-hover:border-signal group-hover:bg-signal group-hover:text-white">
              <Icon size={19} strokeWidth={2} />
            </span>
            <span className="text-[0.85rem] font-medium">{label}</span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Не нашли нужное?{" "}
        <a
          href={siteConfig.contacts.whatsapp}
          className="font-semibold text-[var(--signal-text)] underline-offset-4 hover:underline"
        >
          Напишите в WhatsApp
        </a>{" "}
        — подберём под задачу и бюджет.
      </p>
    </main>
    </ShopChrome>
  );
}
