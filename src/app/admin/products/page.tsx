import Link from "next/link";
import { getAllProducts, getCategories, formatPrice } from "@/lib/data";
import { productImageUrl } from "@/lib/format";
import { plural } from "@/lib/utils";
import { toggleHidden, deleteProduct } from "./actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdminPage } from "@/lib/admin-auth";

/*
  Список товаров.

  Поиск и фильтр держим в адресе (?q=&category=), чтобы ссылку на нужную
  выборку можно было сохранить, а страница осталась серверной.
*/
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; saved?: string }>;
}) {
  await requireAdminPage();

  const { q = "", category = "", saved } = await searchParams;
  const categories = await getCategories();
  const titleByCategory = new Map(categories.map((c) => [c.slug, c.title]));

  const products = getAllProducts().filter(
    (p) =>
      (!category || p.category === category) &&
      (!q || p.title.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase">Товары</h1>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            {products.length} {plural(products.length, "товар", "товара", "товаров")}
            {(q || category) && " по запросу"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Добавить товар
        </Link>
      </div>

      {saved && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже на сайте.
        </p>
      )}

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск по названию…"
          className="min-w-[220px] flex-1 rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-signal hover:text-signal"
        >
          Показать
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[0.85rem]">
          <thead>
            <tr className="border-b border-border text-left text-[0.72rem] uppercase tracking-wider text-muted-foreground">
              <th className="py-2.5 pr-3 font-medium">Товар</th>
              <th className="py-2.5 pr-3 font-medium">Категория</th>
              <th className="py-2.5 pr-3 font-medium">Цена</th>
              <th className="py-2.5 pr-3 font-medium">Наличие</th>
              <th className="py-2.5 pr-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.slug} className="border-b border-border align-middle">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImageUrl(p.image)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-sm border border-border bg-tile object-contain"
                    />
                    <span className="flex flex-col">
                      <Link
                        href={`/admin/products/${p.slug}`}
                        className="font-medium transition-colors hover:text-signal"
                      >
                        {p.title}
                      </Link>
                      <span className="flex gap-2 text-[0.72rem] text-muted-foreground">
                        {p.brand}
                        {p.isClearance && <span>· уценка</span>}
                        {p.hidden && (
                          <span className="text-[var(--signal-text)]">· скрыт</span>
                        )}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {titleByCategory.get(p.category) ?? p.category}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap">{formatPrice(p.price)}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {p.inStock === true
                    ? "есть"
                    : p.inStock === false
                      ? "под заказ"
                      : "—"}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex justify-end gap-3 whitespace-nowrap">
                    <form action={toggleHidden}>
                      <input type="hidden" name="slug" value={p.slug} />
                      <button
                        type="submit"
                        className="text-muted-foreground transition-colors hover:text-signal"
                      >
                        {p.hidden ? "Вернуть" : "Скрыть"}
                      </button>
                    </form>
                    <form action={deleteProduct}>
                      <input type="hidden" name="slug" value={p.slug} />
                      <ConfirmButton
                        label="Удалить"
                        question={`Удалить «${p.title}» насовсем? Чтобы просто убрать с витрины, нажмите «Скрыть».`}
                      />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            Ничего не нашлось. Измените запрос или{" "}
            <Link href="/admin/products" className="text-signal">
              сбросьте фильтры
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
