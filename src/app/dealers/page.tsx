import type { Metadata } from "next";
import { siteConfig } from "@/lib/data";

export const metadata: Metadata = {
  title: "Стать дилером",
  description:
    "Дилерская программа MOMO: оптовые цены, поддержка и обучение. Продавайте автоакустику MOMO в своём городе.",
};

const perks = [
  { title: "Оптовые цены", text: "Прозрачная сетка скидок от объёма закупки — маржа, на которой можно расти." },
  { title: "Поддержка", text: "Персональный менеджер, помощь с подбором ассортимента и обучение по продукту." },
  { title: "Витрина и POS", text: "Фирменные материалы, каталоги и оформление точки под бренд MOMO." },
  { title: "Гарантия и возвраты", text: "Работаем по договору: гарантия 12 месяцев и понятные условия возврата." },
];

export default function DealersPage() {
  return (
    <main className="mx-auto max-w-[1000px] px-6 py-14">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Дилерская программа
      </p>
      <h1 className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-extrabold uppercase leading-tight">
        Стать дилером <span className="text-signal">MOMO</span>
      </h1>
      <p className="mt-5 max-w-[56ch] text-[1.05rem] text-muted-foreground">
        Продавайте автоакустику собственного бренда с понятной маржой и живой
        поддержкой. Оставьте заявку — расскажем условия под ваш формат: магазин,
        студия установки или интернет-площадка.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {perks.map((p) => (
          <div key={p.title} className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={siteConfig.contacts.whatsapp}
          className="inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Оставить заявку в WhatsApp
        </a>
        <a
          href={`tel:${siteConfig.contacts.phone.replace(/[^+\d]/g, "")}`}
          className="inline-flex rounded-sm border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          {siteConfig.contacts.phone}
        </a>
      </div>
    </main>
  );
}
