import type { Metadata } from "next";
import Link from "next/link";
import { hasSession } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAdmin } from "./actions";
import { countNewOrders } from "@/lib/orders";
import { countWaitingSupportConversations } from "@/lib/support-conversations";

export const metadata: Metadata = {
  title: "Панель управления",
  robots: { index: false, follow: false },
};

/*
  Оболочка панели.

  Витрины вокруг нет намеренно: шапка магазина, корзина и всплывающие
  подсказки в рабочем инструменте только мешают. Здесь же проверяется
  подпись сессии — middleware отсекает лишь запросы совсем без куки.
*/
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authorized = await hasSession();

  // Страница входа рисуется этим же layout, но до авторизации показывать
  // навигацию не нужно. Переключатель темы оставляем доступным и здесь,
  // чтобы войти в панель можно было сразу в комфортном оформлении.
  if (!authorized) {
    return (
      <div className="admin-scope relative min-h-screen bg-bg text-foreground">
        <ThemeToggle className="fixed right-5 top-5 z-50 bg-surface shadow-sm" />
        {children}
      </div>
    );
  }

  return (
    <div className="admin-scope min-h-screen overflow-x-hidden bg-bg text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:gap-x-8 sm:gap-y-3 sm:px-5 sm:py-3.5">
          <Link href="/admin" className="font-display text-sm font-extrabold uppercase tracking-tight">
            MOMO · панель
          </Link>
          <AdminNav
            newOrders={countNewOrders()}
            newMessages={countWaitingSupportConversations()}
          />
          <div className="flex w-full items-center justify-between gap-2 text-[0.8rem] sm:ml-auto sm:w-auto sm:justify-start sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="hidden text-muted-foreground sm:inline">Тема</span>
              <ThemeToggle />
            </div>
            <Link
              href="/"
              target="_blank"
              className="text-muted-foreground transition-colors hover:text-signal"
            >
              Открыть сайт ↗
            </Link>
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="text-muted-foreground transition-all hover:text-signal active:scale-95"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-5 sm:px-5 sm:py-8">{children}</main>
    </div>
  );
}
