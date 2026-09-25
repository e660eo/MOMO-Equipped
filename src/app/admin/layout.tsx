import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { hasSession } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAdmin } from "./actions";
import { countNewOrders } from "@/lib/orders";
import { getDealerOrders } from "@/lib/dealers";
import { countWaitingSupportConversations } from "@/lib/support-conversations";

export const metadata: Metadata = { title: "Панель управления", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await hasSession()) return <div className="admin-scope relative min-h-screen bg-bg text-foreground"><ThemeToggle className="fixed right-5 top-5 z-50 bg-surface shadow-sm" />{children}</div>;

  return <AdminShell counts={{ newOrders: countNewOrders(), newMessages: countWaitingSupportConversations(), newDealerOrders: getDealerOrders().filter((order) => order.status === "new").length }} toolbar={<>
    <ThemeToggle />
    <form action={logoutAdmin}><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"><LogOut size={16} aria-hidden /><span className="hidden sm:inline">Выйти</span><span className="sr-only sm:hidden">Выйти</span></button></form>
  </>}>{children}</AdminShell>;
}
