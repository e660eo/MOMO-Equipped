import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/data";
import { NewsForm } from "@/components/admin/news-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdminPage();

  const { slug } = await params;
  const item = getNews().find((n) => n.slug === slug);
  if (!item) notFound();

  return (
    <div>
      <Link
        href="/admin/news"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← К новостям
      </Link>
      <h1 className="mt-3 font-display text-xl font-extrabold uppercase">
        {item.title}
      </h1>
      <div className="mt-7">
        <NewsForm item={item} />
      </div>
    </div>
  );
}
