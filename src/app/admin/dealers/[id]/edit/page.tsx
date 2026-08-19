import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { DealerEditForm } from "@/components/admin/dealer-edit-form";
import { requireSession } from "@/lib/admin-auth";
import { getSiteConfig } from "@/lib/data";
import { getDealerAccounts, getDealerLocation } from "@/lib/dealers";

export default async function AdminDealerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const dealer = getDealerLocation(id);
  if (!dealer) notFound();

  const account = getDealerAccounts().find((item) => item.dealerId === dealer.id) ?? null;
  const { yandexMapsApiKey = "" } = getSiteConfig();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/dealers"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <ArrowLeft size={17} aria-hidden />
        Назад к дилерам
      </Link>

      <div className="mb-6 mt-3 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal">
          <Building2 size={22} aria-hidden />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-signal">
            Партнёрская точка
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold uppercase sm:text-3xl">
            Изменить данные
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {dealer.name} · {dealer.city}
          </p>
        </div>
      </div>

      <DealerEditForm
        dealer={dealer}
        account={account}
        yandexMapsApiKey={yandexMapsApiKey}
      />
    </div>
  );
}
