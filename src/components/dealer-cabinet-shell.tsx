import type { ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  Download,
  FolderDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  ReceiptText,
  ShoppingCart,
} from "lucide-react";
import { logoutDealer } from "@/app/(shop)/dealer/actions";
import { DEALER_PRICE_TIER_LABELS } from "@/lib/b2b-prices";
import { getDealerOrders } from "@/lib/dealers";
import { isDealerOrderOpen } from "@/lib/dealer-order-ui";
import type { DealerAccount, DealerLocation } from "@/lib/types";

export type DealerCabinetSection = "overview" | "order" | "orders" | "materials" | "profile";

type DealerCabinetSession = {
  dealer: DealerLocation;
  account: DealerAccount;
};

const NAVIGATION: Array<{
  section: DealerCabinetSection;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { section: "overview", href: "/dealer", label: "Главная", icon: LayoutDashboard },
  { section: "order", href: "/dealer/order", label: "Новый заказ", icon: ShoppingCart },
  { section: "orders", href: "/dealer/orders", label: "Мои заказы", icon: ReceiptText },
  { section: "materials", href: "/dealer/materials", label: "Материалы", icon: FolderDown },
  { section: "profile", href: "/dealer/profile", label: "Профиль", icon: Building2 },
];

export function DealerCabinetShell({
  session,
  active,
  children,
}: {
  session: DealerCabinetSession;
  active: DealerCabinetSection;
  children: ReactNode;
}) {
  const orders = getDealerOrders(session.account.id);
  const openOrders = orders.filter((order) => isDealerOrderOpen(order.status)).length;

  return (
    <main className="min-h-screen bg-[#f4f4f2] pb-20 text-[#111214]">
      <header className="relative overflow-hidden bg-[#111214] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(115deg,transparent_58%,rgba(255,85,0,.18)_58.2%,transparent_58.5%),linear-gradient(118deg,transparent_66%,rgba(255,255,255,.07)_66.2%,transparent_66.5%)]"
        />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-9">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[.2em] text-[#ff6a1f]">
                MOMO / ZEUS · партнёрская сеть
              </p>
              <h1 className="mt-2 truncate font-display text-3xl font-black uppercase tracking-[-.04em] sm:text-5xl">
                {session.dealer.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/60">
                <span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden />{session.dealer.city}</span>
                <span>{session.account.contactName}</span>
                <span className="rounded-full border border-white/12 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[.1em] text-white/70">
                  {DEALER_PRICE_TIER_LABELS[session.account.priceTier ?? "dealer"]}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/dealer/price.csv"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ff5500] px-4 text-sm font-bold transition-colors hover:bg-[#ff6a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Download size={17} aria-hidden /> Скачать прайс
              </Link>
              <form action={logoutDealer}>
                <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/65 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <LogOut size={17} aria-hidden /> Выйти
                </button>
              </form>
            </div>
          </div>
        </div>

        <nav aria-label="Разделы кабинета" className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const selected = active === item.section;
              return (
                <Link
                  key={item.section}
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={`relative inline-flex min-h-12 shrink-0 items-center gap-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff6a1f] ${selected ? "text-white" : "text-white/50 hover:text-white"}`}
                >
                  <Icon size={17} aria-hidden />
                  {item.label}
                  {item.section === "orders" && openOrders > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-[#ff5500] px-1.5 py-0.5 text-[0.62rem] font-black leading-none text-white">
                      {openOrders}
                    </span>
                  )}
                  {selected && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-[#ff5500]" />}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 sm:py-9">
        {children}
      </div>
    </main>
  );
}
