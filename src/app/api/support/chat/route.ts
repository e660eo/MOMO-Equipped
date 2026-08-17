import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { clientIp } from "@/lib/client-ip";
import { ExpectedError, messageFor } from "@/lib/errors";
import {
  addVisitorSupportMessage,
  findPublicSupportConversation,
} from "@/lib/support-conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_MESSAGES = 12;
const MAX_TRACKED = 5_000;

function forgetOld(now: number): void {
  for (const [key, times] of recent) {
    const active = times.filter((time) => now - time < WINDOW_MS);
    if (active.length) recent.set(key, active);
    else recent.delete(key);
  }
  while (recent.size >= MAX_TRACKED) {
    const oldest = recent.keys().next().value;
    if (oldest === undefined) break;
    recent.delete(oldest);
  }
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (!recent.has(ip) && recent.size >= MAX_TRACKED) forgetOld(now);
  const active = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (active.length >= MAX_MESSAGES) return true;
  recent.set(ip, [...active, now]);
  return false;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_384) return json({ ok: false, error: "Сообщение слишком большое." }, 413);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Не удалось прочитать сообщение." }, 400);
  }

  if (body.action === "load") {
    return json({ ok: true, conversation: findPublicSupportConversation(body.token) });
  }
  if (body.action !== "send") {
    return json({ ok: false, error: "Неизвестное действие." }, 400);
  }

  const ip = await clientIp();
  if (rateLimited(ip)) {
    return json(
      { ok: false, error: "Слишком много сообщений. Подождите несколько минут." },
      429,
    );
  }

  try {
    const customer = await currentCustomer();
    const conversation = addVisitorSupportMessage({
      token: body.token,
      name: body.name || customer?.name,
      contact: body.contact || customer?.email || customer?.phone,
      text: body.text,
      customerId: customer?.id,
    });
    return json({ ok: true, conversation });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof ExpectedError
            ? error.message
            : messageFor(error, "Не удалось отправить сообщение.", "support chat"),
      },
      400,
    );
  }
}
