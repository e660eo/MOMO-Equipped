import { getAllProducts, getCategories, getRawBundles } from "@/lib/data";
import { requireAdminPage } from "@/lib/admin-auth";
import { ProductsList } from "@/components/admin/products-list";

/*
  Список товаров. Поиск и фильтр теперь живут в браузере (ProductsList):
  список сужается по мере ввода, без перезагрузки и кнопки «Показать». Страница
  отдаёт все товары разом — их немного, и так же грузится витрина.
*/
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();

  const { saved } = await searchParams;
  const categories = await getCategories();
  const products = getAllProducts();

  /*
    В какие сборки входит товар. Скрытие и удаление молча вырезают его из
    комплектов — цена пересчитывается, а описание продолжает обещать прежний
    состав. Список нужен, чтобы предупредить об этом при скрытии/удалении.
  */
  const bundleNames: Record<string, string[]> = {};
  for (const b of getRawBundles()) {
    for (const slug of b.items) {
      (bundleNames[slug] ??= []).push(b.title);
    }
  }

  return (
    <ProductsList
      products={products}
      categories={categories}
      bundleNames={bundleNames}
      saved={Boolean(saved)}
    />
  );
}
