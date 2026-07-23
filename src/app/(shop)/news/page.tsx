import Link from "next/link";
import type { Metadata } from "next";
import { getNews } from "@/lib/data";
import { hasArticle, readingMinutes } from "@/lib/article";

export const metadata: Metadata = {
  title: "Новости",
  description:
    "Полезные статьи, обновления ассортимента и советы по автозвуку от MOMO.",
};

export default function NewsPage() {
  const news = getNews();
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-14">
      <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold uppercase">
        Новости
      </h1>
      <p className="mt-3 max-w-[52ch] text-muted-foreground">
        Полезные статьи, обновления ассортимента и советы по обслуживанию
        автомобиля.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {news.map((n) => (
          <Link
            key={n.slug}
            href={`/news/${n.slug}`}
            className="group flex flex-col rounded border border-border bg-surface p-7 transition-all hover:-translate-y-0.5 hover:border-signal/55"
          >
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {new Date(n.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {/* Время чтения — только у настоящих статей: у анонса из двух
                  предложений «1 мин чтения» выглядит издевательством */}
              {hasArticle(n.body) && ` · ${readingMinutes(n.body!)} мин`}
            </span>
            <h2 className="mt-3 font-display text-[1.05rem] font-semibold leading-snug transition-colors group-hover:text-signal">
              {n.title}
            </h2>
            <p className="mt-3 text-[0.9rem] text-muted-foreground">
              {n.excerpt}
            </p>
            <span className="mt-4 font-mono text-[0.72rem] uppercase tracking-wider text-signal">
              {hasArticle(n.body) ? "Читать →" : "Подробнее →"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
