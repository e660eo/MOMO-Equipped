import type { CartItem } from "./cart-store";
import type { Product, ResolvedBundle } from "./types";
import { bundleCartSlug, bundleSlugFromCart } from "./bundle-cart";
import { isInStock, stockLimit } from "./format";

type SnapshotLine = { slug: string; price: number; qty: number; bundle?: { items: Array<{ slug: string; price: number; qty?: number }> } };
export function cartSnapshot(items: SnapshotLine[]): string {
  return JSON.stringify(items.map((item) => ({
    slug: item.slug, qty: item.qty, price: item.price,
    components: item.bundle?.items.map((p) => ({ slug: p.slug, qty: p.qty ?? 1, price: p.price })).sort((a, b) => a.slug.localeCompare(b.slug)) ?? [],
  })).sort((a, b) => a.slug.localeCompare(b.slug)));
}

/** Proposed changes only. The buyer must explicitly accept these lines. */
export function reviewCart(lines: Array<{ slug: string; qty: number }>, products: Product[], bundles: ResolvedBundle[]): CartItem[] {
  return lines.slice(0, 99).flatMap((line): CartItem[] => {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1) return [];
    const bundleSlug = bundleSlugFromCart(line.slug);
    if (bundleSlug) {
      const bundle = bundles.find((b) => b.slug === bundleSlug);
      if (!bundle) return [];
      const counts = new Map<string, number>();
      for (const p of bundle.products) counts.set(p.slug, (counts.get(p.slug) ?? 0) + 1);
      const cap = Math.min(99, ...bundle.products.map((p) => Math.floor((stockLimit(p) ?? 99) / counts.get(p.slug)!)));
      if (cap < 1) return [];
      return [{ slug: bundleCartSlug(bundle.slug), title: bundle.title, price: bundle.price, image: bundle.products[0]?.image ?? "", stock: cap, qty: Math.min(line.qty, cap), bundle: {
        slug: bundle.slug, title: bundle.title, discountPercent: bundle.discountPercent, fullPrice: bundle.fullPrice, saving: bundle.saving,
        items: [...counts].map(([slug, qty]) => { const p = bundle.products.find((p) => p.slug === slug)!; return { slug, qty, title: p.title, price: p.price, image: p.image }; }),
      } }];
    }
    const p = products.find((p) => p.slug === line.slug);
    if (!p || isInStock(p) === false) return [];
    const cap = Math.min(99, stockLimit(p) ?? 99);
    if (cap < 1) return [];
    return [{ slug: p.slug, title: p.title, price: p.price, image: p.image, stock: p.stock, packageQuantity: p.packageQuantity, qty: Math.min(line.qty, cap) }];
  });
}
