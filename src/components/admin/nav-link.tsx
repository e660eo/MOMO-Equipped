"use client";

import Link, { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";
import type { AdminNavigationItem } from "./admin-navigation";

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-progress" aria-hidden /> : null;
}

export function AdminNavLink({ href, label, icon: Icon, active, badge = 0, onNavigate }: AdminNavigationItem & { active: boolean; badge?: number; onNavigate?: () => void }) {
  return <Link href={href} aria-current={active ? "page" : undefined} onNavigate={onNavigate}
    className={cn("relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
      active ? "bg-signal font-semibold text-black shadow-sm" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground")}
  >
    <Icon size={18} strokeWidth={1.7} aria-hidden className="shrink-0" />
    <span className="min-w-0 flex-1">{label}</span>
    {badge > 0 && <span aria-label={`новых: ${badge}`} className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums", active ? "bg-black/10 text-black" : "bg-signal/10 text-[var(--signal-text)]")}>{badge}</span>}
    <Pending />
  </Link>;
}
