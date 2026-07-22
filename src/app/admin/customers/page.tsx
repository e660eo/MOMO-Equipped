import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCustomers } from "@/lib/customers";
import { getOrders } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { plural } from "@/lib/utils";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";

/*
  Клиенты с аккаунтом. Показываем не просто список, а то, ради чего его
  открывают: кто сколько заказал и когда приходил в последний раз.
*/
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage();

  const { q = "" } = await searchParams;
  const orders = getOrders();

  const rows = getCustomers()
    .map((c) => {
      const mine = orders.filter((o) => o.customerId === c.id);
      return {
        customer: c,
        count: mine.length,
        spent: mine
          .filter((o) => o.status !== "canceled")
          .reduce((sum, o) => sum + o.total, 0),
        last: mine[0]?.createdAt,
      };
    })
    .filter(({ customer }) => {
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        customer.name.toLowerCase().includes(needle) ||
        customer.email.toLowerCase().includes(needle) ||
        customer.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, ""))
      );
    })
    // Сначала те, кто покупает: по сумме, затем по дате регистрации
    .sort(
      (a, b) =>
        b.spent - a.spent ||
        b.customer.createdAt.localeCompare(a.customer.createdAt),
    );

  const date = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU") : "—";

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">Клиенты</h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Покупатели, создавшие аккаунт на сайте. {rows.length}{" "}
        {plural(rows.length, "человек", "человека", "человек")}
        {q && " по запросу"}.
      </p>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Имя, почта или телефон…"
          className="min-w-[240px] flex-1 rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium transition-all hover:border-signal hover:text-signal active:scale-95"
        >
          Найти
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="py-14 text-center text-muted-foreground">
          {q
            ? "Никого не нашлось."
            : "Пока никто не зарегистрировался. Аккаунт нужен покупателю, чтобы видеть свои заказы и не вводить данные доставки заново."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[0.85rem]">
            <thead>
              <tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 pr-3 font-medium">Покупатель</th>
                <th className="py-2.5 pr-3 font-medium">Контакты</th>
                <th className="py-2.5 pr-3 font-medium">Регистрация</th>
                <th className="py-2.5 pr-3 font-medium">Был</th>
                <th className="py-2.5 pr-3 text-right font-medium">Заказы</th>
                <th className="py-2.5 pr-3 text-right font-medium">Куплено на</th>
                <th className="py-2.5 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ customer, count, spent, last }) => (
                <tr key={customer.id} className="admin-row border-b border-border">
                  <td className="py-3 pr-3 font-medium">
                    {customer.name}
                    {customer.address && (
                      <span className="block text-[0.75rem] font-normal text-muted-foreground">
                        {customer.address}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    <a href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`} className="hover:text-signal">
                      {customer.phone}
                    </a>
                    <span className="block text-[0.75rem]">{customer.email}</span>
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                    {date(customer.createdAt)}
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                    {date(customer.lastLoginAt)}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    {count > 0 ? (
                      <Link
                        href={`/admin/orders?customer=${customer.id}`}
                        className="transition-colors hover:text-signal"
                      >
                        {count}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right font-medium">
                    {spent > 0 ? formatPrice(spent) : "—"}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <ResetPasswordButton
                      customerId={customer.id}
                      name={customer.name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 max-w-[680px] rounded-sm border border-border bg-surface px-4 py-3 text-[0.82rem] text-muted-foreground">
        Здесь персональные данные покупателей. Показывайте экран только тем,
        кому положено, а пароли не хранятся вовсе — только необратимые хеши,
        восстановить чужой пароль нельзя даже отсюда.
      </p>
    </div>
  );
}
