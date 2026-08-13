import { deleteProductImage } from "./image-pipeline";
import { readJson, updateJson } from "./store";
import type { DeletedProduct, Product } from "./types";

const FILE = "product-trash.json";
const PRODUCTS_FILE = "products.json";
const RETENTION_DAYS = 30;

export function getDeletedProducts(): DeletedProduct[] {
  try {
    return readJson<DeletedProduct[]>(FILE).sort((a, b) =>
      b.deletedAt.localeCompare(a.deletedAt),
    );
  } catch {
    return [];
  }
}

export function moveProductToTrash(product: Product): DeletedProduct {
  const deletedAt = new Date();
  const purgeAfter = new Date(
    deletedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  );
  const record: DeletedProduct = {
    product,
    deletedAt: deletedAt.toISOString(),
    purgeAfter: purgeAfter.toISOString(),
  };
  updateJson<DeletedProduct[]>(FILE, (all) => [
    record,
    ...all.filter((item) => item.product.slug !== product.slug),
  ]);
  return record;
}

export function removeFromTrash(slug: string): void {
  updateJson<DeletedProduct[]>(FILE, (all) =>
    all.filter((item) => item.product.slug !== slug),
  );
}

export function findDeletedProduct(slug: string): DeletedProduct | undefined {
  return getDeletedProducts().find((item) => item.product.slug === slug);
}

export async function purgeExpiredDeletedProducts(now = new Date()): Promise<number> {
  const all = getDeletedProducts();
  const expired = all.filter((item) => item.purgeAfter <= now.toISOString());
  if (!expired.length) return 0;

  const active = readJson<Product[]>(PRODUCTS_FILE);
  const retained = all.filter((item) => item.purgeAfter > now.toISOString());
  const stillUsed = new Set([
    ...active.flatMap((product) => [product.image, ...(product.images ?? [])]),
    ...retained.flatMap((item) => [
      item.product.image,
      ...(item.product.images ?? []),
    ]),
  ]);
  for (const photo of expired.flatMap((item) => [
    item.product.image,
    ...(item.product.images ?? []),
  ])) {
    if (!stillUsed.has(photo)) await deleteProductImage(photo);
  }
  updateJson<DeletedProduct[]>(FILE, () => retained);
  return expired.length;
}

