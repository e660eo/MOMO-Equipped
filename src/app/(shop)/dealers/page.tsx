import type { Metadata } from "next";
import Link from "next/link";
import { DealerLocator } from "@/components/dealer-locator";
import { getDealerLocations } from "@/lib/dealers";

export const metadata: Metadata = {
  title: "Купить рядом — официальные дилеры MOMO и ZEUS",
  description: "Официальные дилеры MOMO и ZEUS по городам России: адреса, телефоны и авторизованные установочные центры.",
};

export default function DealersPage() {
  const dealers = getDealerLocations(true);
  return <main className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-16">
    <div className="grid gap-7 border-b border-border pb-10 md:grid-cols-[1fr_auto] md:items-end"><div><p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Официальная сеть</p><h1 className="mt-4 font-display text-[clamp(2rem,4vw,3.6rem)] font-black uppercase leading-none">Купить <span className="text-signal">рядом</span></h1><p className="mt-5 max-w-[62ch] text-base leading-relaxed text-muted-foreground">Выберите город и свяжитесь с официальным дилером, чтобы уточнить наличие, посмотреть оборудование или договориться об установке.</p></div><Link href="/become-dealer" className="inline-flex min-h-12 items-center justify-center rounded-sm border border-border px-5 text-sm font-semibold hover:border-signal hover:text-signal">Стать дилером →</Link></div>
    <section className="mt-8"><DealerLocator dealers={dealers} /></section>
    <aside className="mt-12 grid gap-4 rounded-xl bg-[#111113] p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="font-display text-lg font-bold">Нет официального дилера в вашем городе?</p><p className="mt-1 text-sm text-white/55">Доставим заказ или поможем найти подходящую установочную студию.</p></div><Link href="/contacts" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-signal px-5 text-sm font-semibold">Связаться с MOMO</Link></aside>
  </main>;
}
