import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getNews } from "@/lib/data";
import { ArticleBody } from "@/components/article-body";
import { JsonLd } from "@/components/json-ld";
import { articleSchema } from "@/lib/structured-data";
import { hasArticle, readingMinutes, articlePlainText } from "@/lib/article";

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

  /*
    Описание для поиска и мессенджеров. Анонс написан для карточки в списке
    и бывает совсем коротким, поэтому у полной статьи берём начало текста —
    но уже без решёток и дефисов разметки.
  */
  const description = item.body
    ? articlePlainText(item.body, 160)
    : item.excerpt;

  return {
    title: item.title,
    description,
    openGraph: {
      title: item.title,
      description,
      type: "article",
      publishedTime: item.date,
    },
  };
}

export default async function NewsItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const news = getNews();
  const item = news.find((n) => n.slug === slug);
  if (!item) notFound();

  const full = hasArticle(item.body);
  // Соседние заметки — чтобы со статьи было куда пойти, кроме как назад.
  const others = news.filter((n) => n.slug !== item.slug).slice(0, 2);

  return (
    <main className="mx-auto max-w-[760px] px-6 py-14">
      {full && <JsonLd data={articleSchema(item)} />}

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
        {full && ` · ${readingMinutes(item.body!)} мин чтения`}
      </span>

      <h1 className="mt-3 font-display text-[clamp(1.6rem,3.2vw,2.4rem)] font-semibold leading-tight">
        {item.title}
      </h1>

      {/* Анонс работает лидом статьи — крупнее основного текста */}
      <p className="mt-6 text-[1.05rem] leading-relaxed text-muted-foreground">
        {item.excerpt}
      </p>

      {full ? (
        <ArticleBody body={item.body!} />
      ) : (
        /*
          Заметка без полного текста. Так живут три первые новости сайта:
          обещать «продолжение следует» нельзя, поэтому честно говорим, что
          это анонс, и зовём спросить живого человека.
        */
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Пока это короткий анонс. Нужны подробности или совет по подбору
          оборудования — напишите нам, разберёмся вместе.
        </p>
      )}

      <div className="mt-12 rounded-xl border border-border bg-surface p-6">
        <p className="text-[0.95rem] font-semibold">Остались вопросы?</p>
        <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
          Подскажем, что подойдёт под вашу машину и задачу.
        </p>
        <Link
          href="/contacts"
          className="mt-4 inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Связаться с нами
        </Link>
      </div>

      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
            Читать дальше
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {others.map((n) => (
              <Link
                key={n.slug}
                href={`/news/${n.slug}`}
                className="group rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-signal/55"
              >
                <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                  {new Date(n.date).toLocaleDateString("ru-RU")}
                </span>
                <span className="mt-2 block font-display text-[0.98rem] font-semibold leading-snug transition-colors group-hover:text-signal">
                  {n.title}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
