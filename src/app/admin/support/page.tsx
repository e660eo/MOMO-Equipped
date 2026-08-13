import { requireAdminPage } from "@/lib/admin-auth";
import { getSupportDocuments } from "@/lib/support-documents";
import { deleteSupportDocument, uploadSupportDocument } from "./actions";

const labels = { instruction: "Инструкция", scheme: "Схема", certificate: "Сертификат", warranty: "Гарантия", catalog: "Каталог", marketing: "Рекламный материал" } as const;

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdminPage();
  const params = await searchParams;
  const documents = getSupportDocuments();
  const field = "rounded-sm border border-input bg-bg px-3 py-2.5 text-sm outline-none focus:border-signal";
  return <div>
    <h1 className="font-display text-xl font-extrabold uppercase">Центр поддержки</h1>
    <p className="mt-1 text-[0.85rem] text-muted-foreground">Публичные файлы видят все, дилерские — только авторизованные партнёры.</p>
    {params.saved && <p className="mt-4 rounded-sm border border-green-600/30 bg-green-600/5 px-4 py-3 text-sm text-green-700">Материал опубликован.</p>}
    {params.error && <p className="mt-4 rounded-sm border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-signal">{params.error}</p>}

    <form action={uploadSupportDocument} className="mt-6 grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2" encType="multipart/form-data">
      <label className="text-[0.75rem] font-medium md:col-span-2">Название<input name="title" required maxLength={180} className={`${field} mt-1.5 w-full`} /></label>
      <label className="text-[0.75rem] font-medium">Раздел<select name="category" className={`${field} mt-1.5 w-full`}><option value="instruction">Инструкция</option><option value="scheme">Схема</option><option value="certificate">Сертификат</option><option value="warranty">Гарантия</option><option value="catalog">Каталог / прайс</option><option value="marketing">Рекламный материал</option></select></label>
      <label className="text-[0.75rem] font-medium">Доступ<select name="audience" className={`${field} mt-1.5 w-full`}><option value="public">Всем посетителям</option><option value="dealer">Только дилерам</option></select></label>
      <label className="text-[0.75rem] font-medium md:col-span-2">Описание<textarea name="description" rows={3} maxLength={500} className={`${field} mt-1.5 w-full`} /></label>
      <label className="text-[0.75rem] font-medium md:col-span-2">Файл до 18 МБ<input name="file" type="file" required accept=".pdf,.zip,.docx,.xlsx,.jpg,.jpeg,.png,.webp" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-signal file:px-4 file:py-2 file:font-semibold file:text-white" /></label>
      <button className="rounded-sm bg-signal px-5 py-2.5 text-sm font-semibold text-white md:w-fit">Загрузить и опубликовать</button>
    </form>

    <div className="mt-8">
      <h2 className="font-display text-base font-bold uppercase">Опубликовано · {documents.length}</h2>
      {documents.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-3">Название</th><th className="py-2 pr-3">Раздел</th><th className="py-2 pr-3">Доступ</th><th className="py-2 pr-3">Файл</th><th /></tr></thead><tbody>
        {documents.map((document) => <tr key={document.id} className="border-b border-border"><td className="py-3 pr-3 font-medium">{document.title}</td><td className="py-3 pr-3 text-muted-foreground">{labels[document.category]}</td><td className="py-3 pr-3"><span className="rounded-full border border-border px-2 py-1 text-xs">{document.audience === "public" ? "публичный" : "дилерам"}</span></td><td className="py-3 pr-3"><a href={document.audience === "dealer" ? `/admin/support/files/${document.id}` : `/media/${document.file}`} target="_blank" className="text-signal hover:underline">{document.originalName}</a></td><td className="py-3 text-right"><form action={deleteSupportDocument}><input type="hidden" name="id" value={document.id} /><button className="text-xs text-muted-foreground hover:text-signal">Удалить</button></form></td></tr>)}
      </tbody></table></div> : <p className="mt-4 text-sm text-muted-foreground">Файлов пока нет.</p>}
    </div>
  </div>;
}
