import { NextResponse } from "next/server";
import { endSession } from "@/lib/admin-auth";

/*
  Выход из панели. Обычная форма (POST), а не серверное действие: кнопка
  «Выйти» живёт в layout и должна работать на любой странице панели,
  включая ту, где действие ещё не загрузилось.
*/
export async function POST(req: Request) {
  await endSession();
  return NextResponse.redirect(new URL("/admin/login", req.url), {
    status: 303,
  });
}
