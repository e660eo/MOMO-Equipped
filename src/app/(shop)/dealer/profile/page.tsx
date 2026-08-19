import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { DealerCabinetShell } from "@/components/dealer-cabinet-shell";
import { DEALER_PRICE_TIER_LABELS } from "@/lib/b2b-prices";
import { currentDealer } from "@/lib/dealer-auth";
import { getSiteConfig } from "@/lib/data";

export const metadata: Metadata = { title: "Профиль дилера", robots: { index: false, follow: false } };

export default async function DealerProfilePage() {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");
  const { contacts } = getSiteConfig();

  const rows = [
    { label: "Компания", value: session.dealer.name, icon: Building2 },
    { label: "Адрес точки", value: `${session.dealer.city}, ${session.dealer.address}`, icon: MapPin },
    { label: "Публичный телефон", value: session.dealer.phone || "Не указан", icon: Phone },
    { label: "Email для входа", value: session.account.email, icon: Mail },
    { label: "Контактное лицо", value: session.account.contactName, icon: ShieldCheck },
  ];

  return (
    <DealerCabinetShell session={session} active="profile">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[#d94700]">Учётная запись</p>
        <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">Профиль дилера</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">Проверьте данные компании и назначенные условия. Для изменения реквизитов обратитесь к менеджеру.</p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
          <h3 className="font-display text-xl font-black uppercase">Данные компании</h3>
          <dl className="mt-5 divide-y divide-black/7">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center">
                  <dt className="flex items-center gap-2 text-sm text-black/45"><Icon size={16} aria-hidden />{row.label}</dt>
                  <dd className="text-sm font-bold sm:text-right">{row.value}</dd>
                </div>
              );
            })}
          </dl>
        </section>

        <aside className="grid content-start gap-4">
          <div className="rounded-[24px] bg-[#111214] p-5 text-white sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff6a1f]">Ваши условия</p>
            <p className="mt-3 font-display text-2xl font-black uppercase">{DEALER_PRICE_TIER_LABELS[session.account.priceTier ?? "dealer"]}</p>
            <p className="mt-2 text-sm leading-6 text-white/50">Резервная скидка применяется к товарам, которых нет в выбранном закрытом прайсе.</p>
            <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4"><span className="text-sm text-white/50">Резервная скидка</span><b className="text-2xl">{session.account.discountPercent}%</b></div>
          </div>

          <div className="rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
            <h3 className="font-display text-xl font-black uppercase">Изменить данные</h3>
            <p className="mt-2 text-sm leading-6 text-black/50">Менеджер проверит изменения компании, адреса или контактного лица.</p>
            <a href={`mailto:${contacts.email}?subject=${encodeURIComponent(`Данные дилера ${session.dealer.name}`)}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#ff5500] px-4 text-sm font-bold text-white">Написать менеджеру</a>
            <a href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 px-4 text-sm font-bold hover:border-[#ff5500] hover:text-[#d94700]">{contacts.phone}</a>
          </div>
        </aside>
      </div>
    </DealerCabinetShell>
  );
}
