"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AdminNavLink } from "./nav-link";
import { ADMIN_NAV_GROUPS, ADMIN_OVERVIEW, currentAdminNavigation } from "./admin-navigation";

export type AdminNavCounts = { newOrders: number; newMessages: number; newDealerOrders: number };

export function AdminNav({ pathname, counts, onNavigate }: { pathname: string; counts: AdminNavCounts; onNavigate?: () => void }) {
  const selected = currentAdminNavigation(pathname);
  const [expanded, setExpanded] = useState<string | null>(selected.group?.id ?? "sales");
  const prefix = useId();
  const badge = (href: string) => href === "/admin/orders" ? counts.newOrders : href === "/admin/messages" ? counts.newMessages : href === "/admin/dealers/orders" ? counts.newDealerOrders : 0;

  return <nav aria-label="Разделы админки" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
    <AdminNavLink {...ADMIN_OVERVIEW} active={pathname === "/admin"} onNavigate={onNavigate} />
    <div className="my-4 border-t border-border" />
    <div className="space-y-2">
      {ADMIN_NAV_GROUPS.map((group) => {
        const open = expanded === group.id;
        const count = group.items.reduce((sum, item) => sum + badge(item.href), 0);
        return <section key={group.id}>
          <button type="button" aria-expanded={open} aria-controls={`${prefix}-${group.id}`} onClick={() => setExpanded(open ? null : group.id)}
            className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold uppercase tracking-[.08em] transition-colors hover:bg-foreground/5 ${selected.group?.id === group.id ? "text-[var(--signal-text)]" : "text-muted-foreground"}`}>
            <span className="flex-1">{group.label}</span>
            {!open && count > 0 && <span aria-label={`новых: ${count}`} className="rounded-md bg-signal/10 px-1.5 py-0.5 text-xs text-[var(--signal-text)]">{count}</span>}
            <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <div id={`${prefix}-${group.id}`} hidden={!open} className="space-y-1 pb-2">
            {group.items.map((item) => <AdminNavLink key={item.href} {...item} active={selected.item.href === item.href} badge={badge(item.href)} onNavigate={onNavigate} />)}
          </div>
        </section>;
      })}
    </div>
  </nav>;
}
