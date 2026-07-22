import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getNews } from "@/lib/data";

export function generateStaticParams() {
  return getNews().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getNews().find((n) => n.slug === slug);
  if (!item) return { title: "Новость не найдена" };
  return { title: item.title, description: item.excerpt };
}

export default async function NewsItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getNews().find((n) => n.slug === slug);
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-[760px] px-6 py-14">
      <nav className="mb-8 flex gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
        <Link href="/news" className="hover:text-signal">
          ← Все новости
        </Link>
      </nav>
      <span className="font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
        {new Date(item.date).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </span>
      <h1 className="mt-3 font-display text-[clamp(1.6rem,3.2vw,2.4rem)] font-semibold leading-tight">
        {item.title}
      </h1>
      <p className="mt-6 text-[1.05rem] leading-relaxed text-muted-foreground">
        {item.excerpt}
      </p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Пока это короткий анонс. Нужны подробности или совет по подбору
        оборудования — напишите нам, разберёмся вместе.
      </p>
      <a
        href="/contacts"
        className="mt-8 inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
      >
        Связаться с нами
      </a>
    </main>
  );
}
