import Link from "next/link";
import { getNews } from "@/lib/data";
import { deleteNews } from "./actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();

  const { saved } = await searchParams;
  const news = getNews();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase">Новости</h1>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            Журнал на главной и в разделе «Новости».
          </p>
        </div>
        <Link
          href="/admin/news/new"
          className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_20px_-6px_rgba(255,85,0,0.6)] active:scale-95"
        >
          Написать новость
        </Link>
      </div>

      {saved && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже на сайте.
        </p>
      )}

      <div className="mt-6 divide-y divide-border border-y border-border">
        {news.map((n) => (
          <div key={n.slug} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
            <span className="w-[92px] shrink-0 font-mono text-[0.75rem] text-muted-foreground">
              {new Date(n.date).toLocaleDateString("ru-RU")}
            </span>
            <Link
              href={`/admin/news/${n.slug}`}
              className="flex-1 text-[0.9rem] font-medium transition-colors hover:text-signal"
            >
              {n.title}
            </Link>
            <form action={deleteNews}>
              <input type="hidden" name="slug" value={n.slug} />
              <ConfirmButton
                label="Удалить"
                question={`Удалить новость «${n.title}»?`}
              />
            </form>
          </div>
        ))}
      </div>

      {news.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          Новостей пока нет.
        </p>
      )}
    </div>
  );
}
