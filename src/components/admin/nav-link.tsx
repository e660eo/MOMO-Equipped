"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/*
  Ссылка навигации панели с индикатором перехода.

  Страницы рисуются на сервере, и на медленной связи между нажатием и новой
  страницей была тишина — казалось, что клик не сработал. Теперь ссылка
  подсвечивается, а сверху идёт полоса загрузки.
*/

function Pending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="nav-progress" aria-hidden />;
}

export function AdminNavLink({
  href,
  label,
  badge = 0,
}: {
  href: string;
  label: string;
  /** Сколько дел ждёт в разделе — например, неразобранных заказов. */
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center gap-1.5 py-0.5 transition-colors",
        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-signal after:transition-transform after:duration-200",
        "hover:text-signal hover:after:scale-x-100",
        active ? "font-semibold text-signal after:scale-x-100" : "text-muted-foreground",
      )}
    >
      {label}
      {badge > 0 && (
        <span
          aria-label={`новых: ${badge}`}
          className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-signal px-1.5 py-0.5 text-[0.66rem] font-semibold leading-none text-white"
        >
          {badge}
        </span>
      )}
      <Pending />
    </Link>
  );
}
