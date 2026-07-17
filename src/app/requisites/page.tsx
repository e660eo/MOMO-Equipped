import type { Metadata } from "next";
import { siteConfig } from "@/lib/data";

export const metadata: Metadata = {
  title: "Реквизиты",
  description: "Официальные реквизиты ИП Махмудов З.Ф. (магазин MOMO).",
};

export default function RequisitesPage() {
  const r = siteConfig.requisites;
  const rows = [
    ["Полное наименование", r.fullName],
    ["Сокращённое наименование", r.shortName],
    ["Адрес регистрации", r.registrationAddress],
    ["Почтовый / фактический адрес", r.postalAddress],
    ["ИНН", r.inn],
    ["ОГРНИП", r.ogrnip],
  ];
  const bank = [
    ["Банк", r.bank],
    ["БИК", r.bik],
    ["Корреспондентский счёт", r.correspondentAccount],
    ["Расчётный счёт", r.settlementAccount],
  ];

  return (
    <main className="mx-auto max-w-[860px] px-6 py-14">
      <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold uppercase">
        Реквизиты
      </h1>
      <p className="mt-3 text-muted-foreground">
        Официальные реквизиты {r.shortName}
      </p>

      <dl className="mt-10 divide-y divide-border border-y border-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-4 sm:grid-cols-[280px_1fr]">
            <dt className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-12 font-display text-lg font-medium uppercase">
        Банковские реквизиты
      </h2>
      <dl className="mt-5 divide-y divide-border border-y border-border">
        {bank.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-4 sm:grid-cols-[280px_1fr]">
            <dt className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
            <dd className="font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
