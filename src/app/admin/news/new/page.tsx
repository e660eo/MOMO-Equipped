import Link from "next/link";
import { NewsForm } from "@/components/admin/news-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function NewNewsPage() {
  await requireAdminPage();

  return (
    <div>
      <Link
        href="/admin/news"
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-signal"
      >
        ← К новостям
      </Link>
      <h1 className="mt-3 font-display text-xl font-extrabold uppercase">
        Новая заметка
      </h1>
      <div className="mt-7">
        <NewsForm />
      </div>
    </div>
  );
}
