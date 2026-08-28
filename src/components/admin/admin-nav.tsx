"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminNavLink } from "./nav-link";

const LINKS = [
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/sales", label: "Отчёты" },
  { href: "/admin/customers", label: "Клиенты" },
  { href: "/admin/dealers", label: "B2B" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/reviews", label: "Отзывы" },
  { href: "/admin/listening-stand", label: "Стенд" },
  { href: "/admin/messages", label: "Чаты" },
  { href: "/admin/support", label: "Материалы" },
  { href: "/admin/banners", label: "Баннеры" },
  { href: "/admin/news", label: "Новости" },
  { href: "/admin/bundles", label: "Сборки" },
  { href: "/admin/promos", label: "Промокоды" },
  { href: "/admin/settings", label: "Настройки" },
  { href: "/admin/audit", label: "Журнал" },
];

export function AdminNav({
  newOrders = 0,
  newMessages = 0,
}: {
  newOrders?: number;
  newMessages?: number;
}) {
  const [open, setOpen] = useState(false);
  const badge = (href: string) =>
    href === "/admin/orders" ? newOrders : href === "/admin/messages" ? newMessages : 0;
  return <>
    <nav className="hidden flex-1 flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.82rem] lg:flex">
      {LINKS.map((link) => <AdminNavLink key={link.href} {...link} badge={badge(link.href)} />)}
    </nav>
    <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 py-2 text-[0.82rem] lg:hidden" aria-expanded={open}><Menu size={17} /> Разделы {newOrders + newMessages > 0 && <span className="rounded-full bg-signal px-1.5 text-white">{newOrders + newMessages}</span>}</button>
    {open && <div className="fixed inset-0 z-[300] lg:hidden"><button type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45" /><aside className="absolute right-0 top-0 h-full w-[min(90vw,360px)] overflow-y-auto border-l border-border bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] pt-[calc(env(safe-area-inset-top)_+_1rem)] shadow-2xl sm:p-5"><div className="flex items-center justify-between"><p className="font-display text-sm font-extrabold uppercase">Разделы панели</p><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="inline-flex h-11 w-11 items-center justify-center"><X size={20} /></button></div><nav onClick={() => setOpen(false)} className="mt-4 grid gap-1 text-[0.92rem] sm:mt-6">{LINKS.map((link) => <AdminNavLink key={link.href} {...link} badge={badge(link.href)} />)}</nav></aside></div>}
  </>;
}
