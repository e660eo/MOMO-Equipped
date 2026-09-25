import { NextResponse } from "next/server";
import { currentDealer } from "@/lib/dealer-auth";
import { getDealerDraft, changeDealerDraft } from "@/lib/dealer-drafts";
import { validDealerDraftMutation } from "@/lib/dealer-order-draft";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET() {
  const session = await currentDealer();
  if (!session) return json({ error: "Войдите в дилерский кабинет." }, 401);
  try { return json({ accountId: session.account.id, draft: getDealerDraft(session.account.id) }); }
  catch { return json({ error: "Не удалось загрузить черновик." }, 503); }
}

export async function POST(request: Request) {
  const session = await currentDealer();
  if (!session) return json({ error: "Войдите в дилерский кабинет." }, 401);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin) && new URL(origin!).host === host; } catch {}
  if (!sameOrigin || !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Недопустимый запрос." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 150_000) return json({ error: "Слишком большой запрос." }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: "Некорректный черновик." }, 400); }
    if (!input || input.accountId !== session.account.id) return json({ error: "Аккаунт изменился. Войдите заново." }, 409);
    if (!validDealerDraftMutation(input.mutation)) return json({ error: "Некорректный черновик." }, 400);
    return json({ accountId: session.account.id, draft: changeDealerDraft(session.account.id, input.mutation) });
  } catch { return json({ error: "Не удалось сохранить черновик. Повторим после восстановления связи." }, 503); }
}
