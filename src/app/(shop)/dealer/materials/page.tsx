import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileArchive, Headphones } from "lucide-react";
import { DealerCabinetShell } from "@/components/dealer-cabinet-shell";
import { currentDealer } from "@/lib/dealer-auth";
import { productImageUrl } from "@/lib/format";
import { getSupportDocuments } from "@/lib/support-documents";
import type { SupportDocumentCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Материалы для дилеров", robots: { index: false, follow: false } };

const CATEGORY_LABELS: Record<SupportDocumentCategory, string> = {
  instruction: "Инструкции",
  scheme: "Схемы подключения",
  certificate: "Сертификаты",
  warranty: "Гарантия",
  catalog: "Каталоги и прайсы",
  marketing: "Рекламные материалы",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as SupportDocumentCategory[];

export default async function DealerMaterialsPage() {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");
  const documents = getSupportDocuments("dealer");

  return (
    <DealerCabinetShell session={session} active="materials">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[#d94700]">База партнёра</p>
        <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">Материалы</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">Сертификаты, инструкции, схемы и готовые материалы для размещения товаров.</p>
      </div>

      {documents.length ? (
        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {CATEGORY_ORDER.map((category) => {
            const items = documents.filter((document) => document.category === category);
            if (!items.length) return null;
            return (
              <section key={category} className="rounded-[24px] border border-black/8 bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4"><h3 className="font-display text-xl font-black uppercase">{CATEGORY_LABELS[category]}</h3><span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-bold">{items.length}</span></div>
                <div className="mt-4 divide-y divide-black/7">
                  {items.map((document) => {
                    const href = document.audience === "dealer" ? `/dealer/files/${document.id}` : productImageUrl(document.file);
                    return (
                      <a key={document.id} href={href} download={document.originalName} className="group flex min-h-20 items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]">
                        <div className="min-w-0">
                          <b className="block text-sm group-hover:text-[#d94700]">{document.title}</b>
                          {document.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/45">{document.description}</p>}
                          <p className="mt-1 truncate text-[0.68rem] text-black/35">{document.originalName} · {(document.size / 1024 / 1024).toFixed(1)} МБ</p>
                        </div>
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f5f5f4] text-black/35 transition-colors group-hover:bg-[#ff5500] group-hover:text-white"><Download size={18} aria-hidden /></span>
                      </a>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="mt-7 rounded-[24px] border border-black/8 bg-white px-5 py-14 text-center">
          <FileArchive className="mx-auto text-black/20" size={34} aria-hidden />
          <h3 className="mt-4 font-display text-2xl font-black uppercase">Материалы готовятся</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-black/50">Закрытые прайсы, сертификаты и рекламные материалы появятся здесь после загрузки менеджером.</p>
        </section>
      )}

      <section className="mt-6 flex flex-col justify-between gap-4 rounded-[24px] bg-[#111214] p-5 text-white sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-3"><Headphones className="mt-0.5 shrink-0 text-[#ff6a1f]" size={21} aria-hidden /><div><h3 className="font-bold">Не нашли нужный файл?</h3><p className="mt-1 text-sm text-white/50">Напишите в поддержку — добавим инструкцию или сертификат.</p></div></div>
        <Link href="/support" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-[#111214]">Центр поддержки</Link>
      </section>
    </DealerCabinetShell>
  );
}
