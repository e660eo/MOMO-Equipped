import { NextResponse } from "next/server";
import { getProducts } from "@/lib/data";
import { buildSearchIndex, searchIndex, toSearchHits } from "@/lib/search-index";
import { cleanQuery } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = cleanQuery(url.searchParams.get("q"));
  const requested = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(8, Math.round(requested)))
    : 6;

  const result = searchIndex(buildSearchIndex(toSearchHits(getProducts())), query, limit);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
