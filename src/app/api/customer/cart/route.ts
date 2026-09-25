import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { getProducts, getBundles } from "@/lib/data";
import { reviewCart } from "@/lib/cart-review";
import { validCartMutation } from "@/lib/cart-sync";
import { getCustomerCart, changeCustomerCart } from "@/lib/customer-carts";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return json({ error: "Войдите в аккаунт." }, 401);
  try {
    return json({ customerId: customer.id, items: reviewCart(getCustomerCart(customer.id), getProducts(), getBundles()) });
  } catch {
    return json({ error: "Не удалось загрузить корзину." }, 503);
  }
}

export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) return json({ error: "Войдите в аккаунт." }, 401);
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  // Next's request URL may contain the internal listen address behind a proxy.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  try { sameOrigin = Boolean(origin) && new URL(origin!).host === host; } catch {}
  if (!sameOrigin
    || !request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "Недопустимый запрос." }, 403);
  }
  try {
    const raw = await request.text();
    if (raw.length > 60_000) return json({ error: "Слишком большой запрос." }, 413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object") return json({ error: "Некорректная корзина." }, 400);
    // A request queued before logout must never write into the next account.
    if (input.customerId !== customer.id) return json({ error: "Аккаунт изменился." }, 409);
    const mutation: unknown = input.mutation;
    if (!validCartMutation(mutation)) return json({ error: "Некорректная корзина." }, 400);
    const products = getProducts(), bundles = getBundles();
    const valid = new Map(reviewCart(mutation.lines.filter((line) => line.qty > 0), products, bundles).map((line) => [line.slug, line.qty]));
    const lines = changeCustomerCart(customer.id, {
      ...mutation,
      lines: mutation.lines.map((line) => ({ slug: line.slug, qty: valid.get(line.slug) ?? 0 })),
    });
    return json({ customerId: customer.id, items: reviewCart(lines, getProducts(), getBundles()) });
  } catch {
    return json({ error: "Не удалось сохранить корзину. Повторим при восстановлении связи." }, 503);
  }
}
