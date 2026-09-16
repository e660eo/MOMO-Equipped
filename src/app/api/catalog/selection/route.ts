import { NextResponse } from "next/server";
import { getProducts } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slugs = [...new Set(new URL(request.url).searchParams.getAll("slug"))].slice(0, 4);
  const wanted = new Set(slugs);
  const products = getProducts().filter((p) => wanted.has(p.slug)).map((p) => ({
    slug: p.slug, title: p.title, brand: p.brand, category: p.category,
    price: p.price, image: p.image, isClearance: p.isClearance,
    inStock: p.inStock, stock: p.stock, description: p.description,
    packageQuantity: p.packageQuantity, packageContents: p.packageContents,
  }));
  return NextResponse.json({ products }, { headers: { "Cache-Control": "private, no-store" } });
}
