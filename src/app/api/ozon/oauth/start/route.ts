import { NextResponse } from "next/server";
import { hasSession } from "@/lib/admin-auth";
import { createOzonAuthorizeUrl, isOzonOAuthConfigured } from "@/lib/ozon-auth";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Запуск подключения доступен только владельцу с действующей сессией панели. */
export async function GET() {
  if (!(await hasSession())) {
    return NextResponse.redirect(`${SITE_URL}/admin/login`);
  }
  if (!isOzonOAuthConfigured()) {
    return NextResponse.json({ error: "Ozon OAuth is not configured" }, { status: 503 });
  }

  const response = NextResponse.redirect(createOzonAuthorizeUrl());
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
