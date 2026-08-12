import seedProducts from "../../data/products.json";
import { readJson, updateJson } from "./store";
import type { Product } from "./types";

/*
  Синхронизация SKU Ozon с живым каталогом.

  Каталог в production хранится вне репозитория, поэтому одного изменения
  data/products.json недостаточно. На старте сервера переносим только два
  проверенных поля — SKU и артикул продавца — не затрагивая цены, остатки,
  названия, фото и правки из админки.

  Источник — каталог репозитория, в котором SKU сопоставлены с карточками
  Ozon Seller. Функция идемпотентна: если значения уже совпадают, файл не
  перезаписывается и резервная копия не создаётся.
*/

type OzonMapping = { ozonSku: number; ozonOfferId: string };

const seedMappings = (seedProducts as unknown as Product[])
    .filter(
      (product) =>
        product.slug &&
        Number.isSafeInteger(product.ozonSku) &&
        Boolean(product.ozonOfferId),
    )
    .map((product) => [
      product.slug,
      {
        ozonSku: product.ozonSku!,
        ozonOfferId: product.ozonOfferId!,
      },
    ] as [string, OzonMapping]);

const mappings = new Map<string, OzonMapping>([
  ...seedMappings,
  // Карточка создана через админку и поэтому отсутствует в seed-каталоге.
  [
    "rupornye-dinamiki-tz-95",
    { ozonSku: 1276705911, ozonOfferId: "TZ-95" },
  ],
]);

function needsChange(product: Product): boolean {
  const mapping = mappings.get(product.slug);
  return Boolean(
    mapping &&
      (product.ozonSku !== mapping.ozonSku ||
        product.ozonOfferId !== mapping.ozonOfferId),
  );
}

export function syncOzonProductMappings(): {
  changed: number;
  mappings: number;
} {
  const current = readJson<Product[]>("products.json");
  if (!current.some(needsChange)) {
    return { changed: 0, mappings: mappings.size };
  }

  let changed = 0;
  updateJson<Product[]>("products.json", (products) =>
    products.map((product) => {
      const mapping = mappings.get(product.slug);
      if (!mapping || !needsChange(product)) return product;
      changed += 1;
      return { ...product, ...mapping };
    }),
  );

  return { changed, mappings: mappings.size };
}
