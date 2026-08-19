import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Cable, FileBadge, FileDown, Headphones, LifeBuoy, ShieldCheck, Wrench } from "lucide-react";
import { getSupportDocuments } from "@/lib/support-documents";
import { siteConfig } from "@/lib/data";
import type { SupportDocumentCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Центр поддержки MOMO и ZEUS",
  description: "Инструкции, схемы подключения, сертификаты, гарантийные условия и техническая поддержка по автоакустике MOMO и ZEUS.",
};

const category: Record<SupportDocumentCategory, { label: string; icon: typeof BookOpen }> = {
  instruction: { label: "Инструкции", icon: BookOpen },
  scheme: { label: "Схемы", icon: Cable },
  certificate: { label: "Сертификаты", icon: FileBadge },
  warranty: { label: "Гарантия", icon: ShieldCheck },
  catalog: { label: "Каталоги", icon: FileDown },
  marketing: { label: "Материалы", icon: Headphones },
};

const faq = [
  ["Какая гарантия действует на оборудование?", `Стандартная гарантия — ${siteConfig.trust.warrantyMonths} месяцев. При установке в авторизованном центре действует ${siteConfig.trust.extendedWarrantyMonths} месяца, если это предусмотрено действующими условиями для товара и установки.`],
  ["Как подобрать усилитель и акустику?", "Отправьте модели компонентов, автомобиль и задачу по звуку. Техническая поддержка проверит мощность, сопротивление и совместимость."],
  ["Где найти ближайшего официального партнёра?", "Откройте раздел «Купить рядом», выберите город или разрешите определить ближайшую опубликованную точку."],
  ["Что подготовить перед обращением по гарантии?", "Название модели, серийный номер, документ о покупке, дату и место установки, а также краткое описание неисправности."],
];

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".0", "")} МБ`;
}
export default function SupportPage() {
  const documents = getSupportDocuments("public").filter((document) => document.audience === "public");
  return <main>
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-12 sm:px-6 sm:py-18 md:grid-cols-[1fr_.7fr] md:items-end"><div><p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Техническая поддержка</p><h1 className="mt-4 font-display text-[clamp(2.1rem,4.8vw,4.2rem)] font-black uppercase leading-[0.95]">Всё для <span className="text-signal">правильного звука</span></h1><p className="mt-6 max-w-[62ch] text-base leading-relaxed text-muted-foreground">Инструкции, схемы, сертификаты, гарантия и помощь с подбором — в одном месте.</p></div><div className="rounded-xl border border-signal/25 bg-signal/5 p-5"><LifeBuoy size={24} className="text-signal" /><p className="mt-3 font-display font-bold">Нужен ответ по конкретной системе?</p><p className="mt-1 text-sm text-muted-foreground">Пришлите модели компонентов и автомобиль — проверим совместимость.</p><a href={siteConfig.contacts.whatsapp} className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-signal px-4 text-sm font-semibold text-white">Написать в поддержку</a></div></div>
    </section>

    <section className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="#documents" className="rounded-xl border border-border bg-surface p-5 hover:border-signal"><BookOpen size={20} className="text-signal" /><h2 className="mt-3 font-display font-bold">Документы</h2><p className="mt-1 text-sm text-muted-foreground">Инструкции, схемы и сертификаты</p></Link>
        <Link href="/install" className="rounded-xl border border-border bg-surface p-5 hover:border-signal"><Wrench size={20} className="text-signal" /><h2 className="mt-3 font-display font-bold">Установка</h2><p className="mt-1 text-sm text-muted-foreground">Монтаж, настройка и центры</p></Link>
        <Link href="/delivery" className="rounded-xl border border-border bg-surface p-5 hover:border-signal"><ShieldCheck size={20} className="text-signal" /><h2 className="mt-3 font-display font-bold">Гарантия и доставка</h2><p className="mt-1 text-sm text-muted-foreground">Условия покупки и получения</p></Link>
        <Link href="/contacts" className="rounded-xl border border-border bg-surface p-5 hover:border-signal"><Headphones size={20} className="text-signal" /><h2 className="mt-3 font-display font-bold">Подбор оборудования</h2><p className="mt-1 text-sm text-muted-foreground">Помощь специалиста MOMO</p></Link>
      </div>

      <section id="documents" className="mt-16 scroll-mt-32"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">База файлов</p><h2 className="mt-2 font-display text-2xl font-black uppercase">Документы и материалы</h2></div><span className="text-sm text-muted-foreground">{documents.length} файлов</span></div>
        {documents.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{documents.map((document) => { const meta = category[document.category]; const Icon = meta.icon; return <a key={document.id} href={`/media/${document.file}`} download={document.originalName} className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 hover:border-signal"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-signal/10 text-signal"><Icon size={20} /></span><span className="min-w-0"><span className="block text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">{meta.label} · {fileSize(document.size)}</span><span className="mt-1 block font-display font-bold group-hover:text-signal">{document.title}</span>{document.description && <span className="mt-1 block text-sm text-muted-foreground">{document.description}</span>}<span className="mt-2 block text-xs text-signal">Скачать {document.originalName} ↓</span></span></a>; })}</div> : <div className="mt-6 rounded-xl border border-dashed border-border p-7"><p className="font-medium">Загружаемые файлы пока не опубликованы</p><p className="mt-1 text-sm text-muted-foreground">Гарантийные условия, контакты и помощь уже доступны выше. Инструкции и сертификаты появятся здесь после проверки и загрузки администратором.</p></div>}
      </section>

      <section className="mt-16"><p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Короткие ответы</p><h2 className="mt-2 font-display text-2xl font-black uppercase">Частые вопросы</h2><div className="mt-6 border-t border-border">{faq.map(([question, answer]) => <details key={question} className="group border-b border-border"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">{question}<span className="text-xl text-signal transition-transform group-open:rotate-45">+</span></summary><p className="max-w-[72ch] pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p></details>)}</div></section>
    </section>
  </main>;
}
