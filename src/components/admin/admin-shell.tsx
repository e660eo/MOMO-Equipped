"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { AdminNav, type AdminNavCounts } from "./admin-nav";
import { currentAdminNavigation } from "./admin-navigation";

function Brand() {
  return <Link href="/admin" aria-label="Главная панели MOMO" className="inline-flex flex-col gap-1">
    <span className="font-display text-xl font-black tracking-tight">MOMO<span className="text-signal">.</span></span>
    <span className="text-[11px] font-medium tracking-wide text-muted-foreground">Панель управления</span>
  </Link>;
}

export function AdminShell({ children, toolbar, counts }: { children: ReactNode; toolbar: ReactNode; counts: AdminNavCounts }) {
  const pathname = usePathname();
  const current = currentAdminNavigation(pathname);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const total = counts.newOrders + counts.newMessages + counts.newDealerOrders;

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    const opener = trigger.current;
    document.body.style.overflow = "hidden";
    const panel = drawer.current;
    panel?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    if (!panel?.contains(document.activeElement)) panel?.focus();
    const focusable = () => [...(panel?.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length > 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const closeOnWide = () => { if (wide.matches) setOpen(false); };
    document.addEventListener("keydown", handleKey);
    wide.addEventListener("change", closeOnWide);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleKey);
      wide.removeEventListener("change", closeOnWide);
      if (opener?.getClientRects().length) opener.focus();
    };
  }, [open]);

  const footer = <div className="shrink-0 border-t border-border px-6 py-4"><Link href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">Открыть сайт <ArrowUpRight size={16} aria-hidden /></Link></div>;

  return <div className="admin-scope min-h-screen bg-bg text-foreground">
    <a href="#admin-content" className="sr-only z-[400] rounded-lg bg-surface p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Перейти к содержимому</a>
    <aside aria-label="Боковая панель" className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
      <div className="shrink-0 px-6 py-6"><Brand /></div>
      <AdminNav key={pathname} pathname={pathname} counts={counts} />
      {footer}
    </aside>
    <div className="min-w-0 lg:pl-60">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? "admin-mobile-menu" : undefined} onClick={() => setOpen(true)} className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold lg:hidden"><Menu size={18} aria-hidden /><span className="hidden sm:inline">Меню</span><span className="sr-only sm:hidden">Меню</span>{total > 0 && <span aria-label={`новых: ${total}`} className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-signal px-1 text-center text-[10px] text-white">{total}</span>}</button>
          <div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground">{current.group?.label ?? "Панель управления"}</p><p className="mt-1 truncate text-sm font-semibold sm:text-base">{current.item.label}</p></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">{toolbar}</div>
        </div>
      </header>
      <main id="admin-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1440px] scroll-mt-24 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
    {open && createPortal(<div className="admin-scope fixed inset-0 z-[300] text-foreground lg:hidden">
      <button type="button" aria-label="Закрыть меню" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45" />
      <aside id="admin-mobile-menu" ref={drawer} role="dialog" aria-modal="true" aria-label="Меню админки" tabIndex={-1} className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col border-r border-border bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-5 py-5"><div onClick={() => setOpen(false)}><Brand /></div><button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-foreground/5"><X size={20} aria-hidden /></button></div>
        <AdminNav key={pathname} pathname={pathname} counts={counts} onNavigate={() => setOpen(false)} />
        {footer}
      </aside>
    </div>, document.body)}
  </div>;
}
