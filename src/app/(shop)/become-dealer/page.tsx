import type { Metadata } from "next";
import { BadgeCheck, Boxes, Headphones, MapPinned, Wrench } from "lucide-react";
import { DealerApplicationForm } from "@/components/dealer-application-form";
import { publicPageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = publicPageMetadata(
  "Стать дилером MOMO и ZEUS",
  "Партнёрская программа MOMO и ZEUS для магазинов и студий автозвука: ассортимент, поддержка, авторизованная установка и дилерский кабинет.",
  "/become-dealer",
);

const benefits = [
  { icon: Boxes, title: "Каталог и остатки", text: "В кабинете видны доступный ассортимент, ваши цены и актуальные остатки." },
  { icon: Headphones, title: "Поддержка по продукту", text: "Поможем подобрать стартовую матрицу и разобраться в совместимости компонентов." },
  { icon: Wrench, title: "Авторизованная установка", text: "Подключаем студии к программе установки и расширенной гарантии по утверждённым условиям." },
  { icon: MapPinned, title: "Клиенты из вашего города", text: "Опубликованные партнёры появляются в разделе «Купить рядом»." },
];

export default function BecomeDealerPage() {
  return <main>
    <section className="border-b border-border bg-[#111113] text-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.75fr] lg:items-end">
        <div><p className="font-mono text-xs uppercase tracking-[0.22em] text-[#ff7a33]">Партнёрская программа MOMO / ZEUS</p><h1 className="mt-5 max-w-[13ch] font-display text-[clamp(2.2rem,5vw,4.5rem)] font-black uppercase leading-[0.94]">Продавайте автозвук <span className="text-signal">с поддержкой бренда</span></h1><p className="mt-6 max-w-[58ch] text-base leading-relaxed text-white/65 sm:text-lg">Для магазинов, установочных студий и интернет-площадок. После одобрения вы получите закрытые условия, персональные цены, остатки и материалы в дилерском кабинете.</p></div>
        <div className="border-l border-white/15 pl-6"><BadgeCheck className="text-signal" size={28} /><p className="mt-4 font-display text-lg font-bold">Без публикации оптовых цен</p><p className="mt-2 text-sm leading-relaxed text-white/55">Коммерческие условия доступны только авторизованному партнёру. На открытой странице — программа и форма знакомства.</p></div>
      </div>
    </section>

    <section className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_.85fr]">
        <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Что получает партнёр</p><h2 className="mt-3 font-display text-2xl font-black uppercase sm:text-3xl">Инструменты для продаж, а не просто прайс</h2><div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">{benefits.map(({ icon: Icon, title, text }) => <div key={title} className="bg-surface p-6"><Icon size={22} className="text-signal" /><h3 className="mt-4 font-display text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></div>)}</div><div className="mt-8 border-l-2 border-signal pl-5"><p className="font-semibold">Как начинается работа</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Заявка → разговор с менеджером → согласование условий → приглашение в кабинет. Мы не обещаем одинаковые условия всем: формат зависит от города, точки и задач партнёра.</p></div></div>
        <div id="dealer-form"><p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Заявка на партнёрство</p><DealerApplicationForm /></div>
      </div>
    </section>
  </main>;
}
