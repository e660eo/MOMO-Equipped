import { requireAdminPage } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/audit-log";

const ENTITY_LABELS = { product: "Товар", order: "Заказ", promo: "Промокод", customer: "Клиент", settings: "Настройки", integration: "Интеграция", dealer: "Дилер", support: "Поддержка", banner: "Баннер", review: "Отзыв" } as const;

export default async function AuditPage() {
  await requireAdminPage();
  const entries = getAuditLog(300);
  return <div>
    <h1 className="font-display text-xl font-extrabold uppercase">Журнал действий</h1>
    <p className="mt-1 text-[0.85rem] text-muted-foreground">Последние 300 изменений каталога, заказов, клиентов и интеграций.</p>
    {entries.length === 0 ? <p className="py-14 text-center text-muted-foreground">Изменений пока нет. Новые действия появятся здесь автоматически.</p> : <>
      <div className="mt-5 grid gap-3 md:hidden">{entries.map((entry) => <article key={`mobile-${entry.id}`} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">{ENTITY_LABELS[entry.entity]}</span><time className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString("ru-RU")}</time></div><p className="mt-2 text-sm leading-relaxed">{entry.summary}</p><p className="mt-3 break-all font-mono text-[0.7rem] text-muted-foreground">{entry.entityId} · {entry.actor}</p></article>)}</div>
      <div className="mt-6 hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-[0.83rem]"><thead><tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-4">Когда</th><th className="py-2 pr-4">Раздел</th><th className="py-2 pr-4">Действие</th><th className="py-2">Кто</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-border align-top"><td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">{new Date(entry.at).toLocaleString("ru-RU")}</td><td className="py-3 pr-4"><span className="font-medium">{ENTITY_LABELS[entry.entity]}</span><span className="ml-2 font-mono text-[0.72rem] text-muted-foreground">{entry.entityId}</span></td><td className="py-3 pr-4">{entry.summary}</td><td className="py-3 text-muted-foreground">{entry.actor}</td></tr>)}</tbody></table></div>
    </>}
  </div>;
}
