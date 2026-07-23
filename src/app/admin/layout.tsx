import type { Metadata } from "next";
import Link from "next/link";
import { hasSession } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAdmin } from "./actions";
import { countNewOrders } from "@/lib/orders";

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
  // навигацию не нужно — отдаём голый лист.
  if (!authorized) {
    return <div className="min-h-screen bg-bg text-foreground">{children}</div>;
  }

  return (
    <div className="admin-scope min-h-screen bg-bg text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5">
          <Link href="/admin" className="font-display text-sm font-extrabold uppercase tracking-tight">
            MOMO · панель
          </Link>
          <AdminNav newOrders={countNewOrders()} />
          <div className="ml-auto flex items-center gap-4 text-[0.8rem]">
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
      <main className="mx-auto max-w-[1200px] px-5 py-8">{children}</main>
    </div>
  );
}
