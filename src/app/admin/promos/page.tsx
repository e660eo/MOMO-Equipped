import { requireAdminPage } from "@/lib/admin-auth";
import { getPromos } from "@/lib/promos";
import { plural } from "@/lib/utils";
import { savePromoAction, deletePromoAction } from "./actions";
import { ConfirmButton } from "@/components/admin/confirm-button";

const inputCls =
  "rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none";

export default async function AdminPromosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdminPage();

  const { saved, error } = await searchParams;
  const promos = getPromos();

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">Промокоды</h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Скидка в процентах на сумму заказа. Покупатель вводит код на оформлении.{" "}
        {promos.length} {plural(promos.length, "код", "кода", "кодов")}.
      </p>

      {error && (
        <p className="mt-4 rounded-sm border border-signal/40 bg-signal/10 px-4 py-2.5 text-[0.85rem] text-[var(--signal-text)]">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже действуют.
        </p>
      )}

      {/* Создать новый */}
      <form
        action={savePromoAction}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.66rem] uppercase tracking-wider text-muted-foreground">
            Код
          </span>
          <input
            name="code"
            required
            placeholder="ЛЕТО25"
            className={`${inputCls} w-[160px] uppercase`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.66rem] uppercase tracking-wider text-muted-foreground">
            Скидка, %
          </span>
          <input
            name="percent"
            type="number"
            min={1}
            max={100}
            required
            placeholder="10"
            className={`${inputCls} w-[110px]`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.66rem] uppercase tracking-wider text-muted-foreground">
            Лимит активаций
          </span>
          <input
            name="limit"
            type="number"
            min={0}
            defaultValue={0}
            className={`${inputCls} w-[150px]`}
          />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-signal px-5 py-2 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95"
        >
          Создать
        </button>
        <p className="w-full text-[0.75rem] text-muted-foreground">
          Лимит 0 — без ограничения. Если код с таким названием уже есть — он
          обновится (число активаций сохранится).
        </p>
      </form>

      {promos.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Промокодов пока нет. Создайте первый — он сразу заработает на
          оформлении заказа.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[0.85rem]">
            <thead>
              <tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 pr-3 font-medium">Код</th>
                <th className="py-2.5 pr-3 font-medium">Скидка и лимит</th>
                <th className="py-2.5 pr-3 font-medium">Активаций</th>
                <th className="py-2.5 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.code} className="admin-row border-b border-border align-middle">
                  <td className="py-2.5 pr-3 font-mono font-semibold uppercase">
                    {p.code}
                  </td>
                  <td className="py-2.5 pr-3">
                    {/* Правка процента и лимита — тот же action (upsert по коду) */}
                    <form
                      action={savePromoAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="code" value={p.code} />
                      <input
                        name="percent"
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={p.percent}
                        className={`${inputCls} w-[80px]`}
                        aria-label={`Скидка для ${p.code}`}
                      />
                      <span className="text-muted-foreground">%</span>
                      <input
                        name="limit"
                        type="number"
                        min={0}
                        defaultValue={p.limit}
                        className={`${inputCls} w-[100px]`}
                        aria-label={`Лимит для ${p.code}`}
                      />
                      <button
                        type="submit"
                        className="rounded-sm border border-border px-3 py-1.5 text-[0.8rem] font-medium transition-all hover:border-signal hover:text-signal active:scale-95"
                      >
                        Сохранить
                      </button>
                    </form>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                    {p.used}
                    {p.limit > 0 ? ` / ${p.limit}` : " · без лимита"}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <form action={deletePromoAction}>
                      <input type="hidden" name="code" value={p.code} />
                      <ConfirmButton
                        label="Удалить"
                        question={`Удалить промокод «${p.code}»? Он перестанет действовать на оформлении.`}
                      />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
