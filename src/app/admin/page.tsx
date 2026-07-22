import Link from "next/link";
import { getAllProducts, getCategories, getNews, getRawBundles } from "@/lib/data";
import { isRepoData } from "@/lib/store";
import { plural } from "@/lib/utils";
import { requireAdminPage } from "@/lib/admin-auth";

/*
  Сводка панели: сколько чего в каталоге и куда идти дальше.
  Плюс предупреждение, если сайт запущен без отдельной папки данных —
  тогда правки уедут в файлы кода и не переживут ближайшего обновления.
*/
export default async function AdminHomePage() {
  await requireAdminPage();

  const products = getAllProducts();
  const hidden = products.filter((p) => p.hidden).length;
  const clearance = products.filter((p) => p.isClearance).length;
  const unknownStock = products.filter((p) => p.inStock === undefined).length;

  const cards = [
    {
      href: "/admin/products",
      title: "Товары",
      value: `${products.length}`,
      note: [
        hidden ? `${hidden} скрыто` : null,
        clearance ? `${clearance} в уценке` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      href: "/admin/news",
      title: "Новости",
      value: `${getNews().length}`,
      note: "журнал на главной",
    },
    {
      href: "/admin/bundles",
      title: "Сборки",
      value: `${getRawBundles().length}`,
      note: "готовые комплекты",
    },
    {
      href: "/admin/settings",
      title: "Контакты",
      value: `${getCategories().length}`,
      note: "категорий в каталоге",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">
        Панель управления
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Правки видны на сайте сразу — пересобирать ничего не нужно.
      </p>

      {process.env.NODE_ENV === "production" && isRepoData() && (
        <p className="mt-5 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          Не задана папка данных (MOMO_DATA_DIR). Сохранять правки некуда:
          файлы каталога перезаписываются при каждом обновлении сайта.
          Настройка — в DEPLOY.md, раздел «Папка данных».
        </p>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-signal"
          >
            <p className="font-display text-2xl font-extrabold">{c.value}</p>
            <p className="mt-1 text-[0.9rem] font-medium">{c.title}</p>
            {c.note && (
              <p className="mt-0.5 text-[0.75rem] text-muted-foreground">{c.note}</p>
            )}
          </Link>
        ))}
      </div>

      {unknownStock > 0 && (
        <p className="mt-6 text-[0.85rem] text-muted-foreground">
          У {unknownStock}{" "}
          {plural(unknownStock, "товара", "товаров", "товаров")} не указано
          наличие — покупатель не видит ни «в наличии», ни «под заказ».{" "}
          <Link href="/admin/products" className="text-signal">
            Проставить
          </Link>
          .
        </p>
      )}
    </div>
  );
}
