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
  activePaths = [],
}: {
  href: string;
  label: string;
  /** Сколько дел ждёт в разделе — например, неразобранных заказов. */
  badge?: number;
  /** Другие страницы, относящиеся к этому разделу. */
  activePaths?: readonly string[];
}) {
  const pathname = usePathname();
  const active = [href, ...activePaths].some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex min-h-11 items-center gap-1.5 rounded-sm py-0.5 transition-colors lg:min-h-0",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal",
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
