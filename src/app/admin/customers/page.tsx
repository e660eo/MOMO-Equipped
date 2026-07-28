import { requireAdminPage } from "@/lib/admin-auth";
import { getCustomers, toPublic } from "@/lib/customers";
import { getOrders } from "@/lib/orders";
import { plural } from "@/lib/utils";
import { CustomerRow } from "@/components/admin/customer-row";

/*
  Клиенты с аккаунтом. Показываем не просто список, а то, ради чего его
  открывают: кто сколько заказал, когда приходил — и по клику полный состав
  каждого заказа с кнопками статуса (см. CustomerRow).
*/
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage();

  const { q = "" } = await searchParams;
  const orders = getOrders();

  /*
    toPublic снимает passwordHash. В строку уходят только публичные поля клиента
    и обрезанный состав его заказов (без лишних данных), поэтому хеш пароля не
    попадает в разметку RSC даже случайно.
  */
  const rows = getCustomers()
    .map((c) => {
      const mine = orders.filter((o) => o.customerId === c.id);
      return {
        customer: toPublic(c),
        spent: mine
          .filter((o) => o.status !== "canceled")
          .reduce((sum, o) => sum + o.total, 0),
        orders: mine.map((o) => ({
          id: o.id,
          createdAt: o.createdAt,
          total: o.total,
          status: o.status,
          items: o.items.map((it) => ({ title: it.title, qty: it.qty })),
        })),
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
              {rows.map(({ customer, spent, orders }) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  spent={spent}
                  orders={orders}
                />
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
