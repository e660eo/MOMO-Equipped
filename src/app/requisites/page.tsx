import type { Metadata } from "next";
import { siteConfig } from "@/lib/data";

export const metadata: Metadata = {
  title: "Реквизиты",
  description:
    "Информационная карта и официальные реквизиты ИП Махмудов З.Ф. (магазин MOMO): ИНН, ОГРНИП, ОКВЭД, банковские реквизиты.",
};

export default function RequisitesPage() {
  const r = siteConfig.requisites;

  const org: [string, string][] = [
    ["Полное наименование", r.fullName],
    ["Сокращённое наименование", r.shortName],
    ["Адрес регистрации", r.registrationAddress],
    ["Почтовый / фактический адрес", r.postalAddress],
    ["ИНН", r.inn],
    ["ОГРНИП", r.ogrnip],
    ["Свидетельство о регистрации", r.certificate],
    ["ОКПО", r.okpo],
    ["ОКАТО", r.okato],
    ["ОКТМО", r.oktmo],
    ["Регистрационный № в СФР", r.sfr],
    ["Идентификатор участника ЭДО (GUID)", r.edoGuid],
  ];

  const bank: [string, string][] = [
    ["Банк", r.bank],
    ["БИК", r.bik],
    ["Корреспондентский счёт", r.correspondentAccount],
    ["Расчётный счёт", r.settlementAccount],
  ];

  return (
    <main className="mx-auto max-w-[900px] px-6 py-14">
      <p className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Информационная карта
      </p>
      <h1 className="mt-3 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold uppercase leading-tight">
        Реквизиты
      </h1>
      <p className="mt-3 text-muted-foreground">
        Официальные данные {r.shortName} — для договоров, счетов и
        документооборота.
      </p>

      {/* Организация */}
      <h2 className="mt-12 font-display text-lg font-extrabold uppercase">
        Организация
      </h2>
      <dl className="mt-5 divide-y divide-border border-y border-border">
        {org.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
            <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
            <dd className="break-words text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Контакты */}
      <h2 className="mt-12 font-display text-lg font-extrabold uppercase">
        Контакты
      </h2>
      <dl className="mt-5 divide-y divide-border border-y border-border">
        <div className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
          <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Телефон
          </dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {r.phones.map((p) => (
              <a
                key={p}
                href={`tel:${p.replace(/[^+\d]/g, "")}`}
                className="transition-colors hover:text-signal"
              >
                {p}
              </a>
            ))}
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
          <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            E-mail
          </dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {r.emails.map((e) => (
              <a
                key={e}
                href={`mailto:${e}`}
                className="transition-colors hover:text-signal"
              >
                {e}
              </a>
            ))}
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
          <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Сайт
          </dt>
          <dd className="text-sm">
            <a
              href={r.website}
              className="transition-colors hover:text-signal"
              rel="noopener"
            >
              {r.website.replace(/^https?:\/\//, "")}
            </a>
          </dd>
        </div>
      </dl>

      {/* Виды деятельности */}
      <h2 className="mt-12 font-display text-lg font-extrabold uppercase">
        Виды деятельности
      </h2>
      <dl className="mt-5 divide-y divide-border border-y border-border">
        <div className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
          <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            ОКВЭД, основной
          </dt>
          <dd className="text-sm">{r.okvedMain}</dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
          <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            ОКВЭД, дополнительные
          </dt>
          <dd>
            <ul className="space-y-1.5 text-sm">
              {r.okvedExtra.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {/* Банк */}
      <h2 className="mt-12 font-display text-lg font-extrabold uppercase">
        Банковские реквизиты
      </h2>
      <dl className="mt-5 divide-y divide-border border-y border-border">
        {bank.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-4 sm:grid-cols-[300px_1fr]">
            <dt className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
