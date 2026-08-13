import { requireAdminPage } from "@/lib/admin-auth";
import { getPromos } from "@/lib/promos";
import { getCategories } from "@/lib/data";
import { plural } from "@/lib/utils";
import { savePromoAction, deletePromoAction } from "./actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { Category, Promo } from "@/lib/types";

const input = "w-full rounded-sm border border-input bg-bg px-3 py-2 text-sm focus:border-signal focus:outline-none";
const label = "text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground";

function PromoFields({ promo, categories }: { promo?: Promo; categories: Category[] }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <label className="grid gap-1"><span className={label}>Код</span><input name="code" required readOnly={Boolean(promo)} defaultValue={promo?.code} placeholder="ЛЕТО25" className={`${input} uppercase read-only:opacity-65`} /></label>
    <label className="grid gap-1"><span className={label}>Скидка, %</span><input name="percent" type="number" min={1} max={100} required defaultValue={promo?.percent ?? 10} className={input} /></label>
    <label className="grid gap-1"><span className={label}>Общий лимит</span><input name="limit" type="number" min={0} defaultValue={promo?.limit ?? 0} className={input} /></label>
    <label className="grid gap-1"><span className={label}>На одного клиента</span><input name="perCustomerLimit" type="number" min={0} defaultValue={promo?.perCustomerLimit ?? 0} className={input} /></label>
    <label className="grid gap-1"><span className={label}>Начало</span><input name="startsAt" type="date" defaultValue={promo?.startsAt?.slice(0, 10)} className={input} /></label>
    <label className="grid gap-1"><span className={label}>Окончание</span><input name="endsAt" type="date" defaultValue={promo?.endsAt?.slice(0, 10)} className={input} /></label>
    <label className="grid gap-1"><span className={label}>Минимальная корзина, ₽</span><input name="minSubtotal" type="number" min={0} defaultValue={promo?.minSubtotal ?? 0} className={input} /></label>
    <label className="grid gap-1"><span className={label}>Максимальная скидка, ₽</span><input name="maxDiscount" type="number" min={0} defaultValue={promo?.maxDiscount ?? 0} className={input} /></label>
    <label className="grid gap-1 md:col-span-2"><span className={label}>Товары (слаги через запятую)</span><input name="productSlugs" defaultValue={promo?.productSlugs?.join(", ")} placeholder="bd-1500-1, fr-500" className={input} /></label>
    <fieldset className="md:col-span-2"><legend className={label}>Категории (пусто — весь каталог)</legend><div className="mt-2 flex flex-wrap gap-3">{categories.map((category) => <label key={category.slug} className="flex items-center gap-1.5 text-[0.78rem]"><input type="checkbox" name="categories" value={category.slug} defaultChecked={promo?.categories?.includes(category.slug)} />{category.title}</label>)}</div></fieldset>
    <label className="flex items-center gap-2 text-[0.82rem] md:col-span-2 xl:col-span-4"><input type="checkbox" name="active" defaultChecked={promo?.active !== false} />Промокод активен</label>
  </div>;
}
export default async function AdminPromosPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdminPage();
  const { saved, error } = await searchParams;
  const promos = getPromos();
  const categories = await getCategories();
  return <div>
    <h1 className="font-display text-xl font-extrabold uppercase">Промокоды</h1><p className="mt-1 text-[0.85rem] text-muted-foreground">{promos.length} {plural(promos.length, "код", "кода", "кодов")} · сроки, ограничения и статистика сохраняются отдельно.</p>
    {error && <p className="mt-4 rounded-sm border border-signal/40 bg-signal/10 px-4 py-2.5 text-[0.85rem] text-[var(--signal-text)]">{error}</p>}{saved && !error && <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">Сохранено. Условия уже действуют.</p>}
    <details className="mt-6 rounded-xl border border-signal/50 bg-surface p-5" open={promos.length === 0}><summary className="cursor-pointer font-display text-base font-extrabold uppercase">Создать промокод</summary><form action={savePromoAction} className="mt-5"><PromoFields categories={categories} /><button type="submit" className="mt-5 rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white">Создать</button></form></details>
    <div className="mt-6 grid gap-3">{promos.map((promo) => <details key={promo.code} className="rounded-xl border border-border bg-surface p-5"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="font-mono font-semibold">{promo.code}</span><span className={`ml-3 rounded-full border px-2 py-0.5 text-[0.68rem] ${promo.active === false ? "border-border text-muted-foreground" : "border-green-600/40 text-green-700"}`}>{promo.active === false ? "остановлен" : "активен"}</span></div><p className="text-[0.78rem] text-muted-foreground">Скидка {promo.percent}% · использован {promo.used}{promo.limit ? ` из ${promo.limit}` : " раз"} · нажмите для настроек</p></div></summary><form action={savePromoAction} className="mt-5 border-t border-border pt-5"><PromoFields promo={promo} categories={categories} /><div className="mt-5 flex items-center gap-4"><button type="submit" className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white">Сохранить</button></div></form><form action={deletePromoAction} className="mt-3"><input type="hidden" name="code" value={promo.code} /><ConfirmButton label="Удалить промокод" question={`Удалить промокод «${promo.code}» и его статистику?`} /></form></details>)}</div>
  </div>;
}
