import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DealerCabinetShell } from "@/components/dealer-cabinet-shell";
import { DealerOrderCatalog, type DealerCatalogItem } from "@/components/dealer-order-catalog";
import { currentDealer } from "@/lib/dealer-auth";
import { dealerPriceFor } from "@/lib/dealers";
import { getCategories, getProducts } from "@/lib/data";
import { isInStock, productImageUrl } from "@/lib/format";

export const metadata: Metadata = { title: "Новый дилерский заказ", robots: { index: false, follow: false } };

export default async function DealerOrderPage() {
  const session = await currentDealer();
  if (!session) redirect("/dealer/login");

  const categoryLabels = new Map(getCategories().map((category) => [category.slug, category.title]));
  const catalog: DealerCatalogItem[] = getProducts()
    .filter((product) => !product.isClearance && !product.hidden)
    .map((product) => ({
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      category: categoryLabels.get(product.category) ?? product.category,
      image: productImageUrl(product.image),
      price: dealerPriceFor(product, session.account),
      retailPrice: product.price,
      stock: typeof product.stock === "number" ? product.stock : null,
      available: isInStock(product) !== false,
      isNew: Boolean(product.isNew),
      ...(product.ozonOfferId ? { article: product.ozonOfferId } : {}),
    }));

  return (
    <DealerCabinetShell session={session} active="order">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[#d94700]">Персональные условия</p>
        <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">Новый заказ</h2>
        <p className="mt-2 text-sm leading-6 text-black/55">Выберите товары и количество. Черновик сохраняется на этом устройстве автоматически, поэтому к заказу можно вернуться позже.</p>
      </div>
      <DealerOrderCatalog products={catalog} />
    </DealerCabinetShell>
  );
}
