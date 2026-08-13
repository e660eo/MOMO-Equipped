import type { Product } from "./types";
import { parseTech, type TechSpec } from "./specs";

/** Product projection safe to serialise into the client-side catalogue. */
export interface CatalogProduct extends Product {
  tech: TechSpec;
}

export function toCatalogProduct(product: Product): CatalogProduct {
  return {
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    category: product.category,
    price: product.price,
    image: product.image,
    images: product.images?.slice(0, 1),
    isClearance: product.isClearance,
    isNew: product.isNew,
    inStock: product.inStock,
    stock: product.stock,
    tech: parseTech(product.title, product.description),
  };
}
