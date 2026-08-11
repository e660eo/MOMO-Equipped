import { NextResponse } from "next/server";
import {
  exchangeOzonAuthorizationCode,
  isOzonOAuthConfigured,
  verifyOzonOAuthState,
} from "@/lib/ozon-auth";

export const dynamic = "force-dynamic";

function page(title: string, message: string, ok: boolean, status = 200): NextResponse {
  const color = ok ? "#16a34a" : "#dc2626";
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title}</title></head>
<body style="margin:0;background:#111;color:#f7f7f7;font:16px/1.5 system-ui,sans-serif">
<main style="max-width:620px;margin:10vh auto;padding:32px;border:1px solid #333;border-radius:16px;background:#1b1b1b">
<div style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:${color};font-size:26px">${ok ? "✓" : "!"}</div>
<h1 style="margin:20px 0 8px;font-size:26px">${title}</h1><p style="margin:0;color:#c8c8c8">${message}</p>
<p style="margin:28px 0 0"><a href="/admin" style="color:#ff6a1f">Вернуться в панель сайта</a></p>
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: Request) {
  if (!isOzonOAuthConfigured()) {
    return page("Ozon не настроен", "На сервере нет OAuth-реквизитов Ozon.", false, 503);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return page("Доступ не выдан", "Ozon отменил или отклонил авторизацию.", false, 400);
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  if (!code || !state || !verifyOzonOAuthState(state)) {
    return page("Неверный ответ Ozon", "Код или защитная подпись не прошли проверку.", false, 400);
  }

  try {
    await exchangeOzonAuthorizationCode(code);
    return page(
      "Ozon Доставка подключена",
      "Токен получен и сохранён на сервере. Эту вкладку можно закрыть.",
      true,
    );
  } catch (error) {
    console.error("Ozon OAuth: не удалось обменять код", error);
    return page(
      "Не удалось получить токен",
      "Ozon выдал код, но сервер не смог завершить подключение. Попробуйте ещё раз.",
      false,
      502,
    );
  }
}
