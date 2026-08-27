import { NextResponse } from "next/server";
import { getHealthReport, httpStatusForHealth } from "@/lib/health";

/*
  Точка для внешнего монитора доступности.

  Смысл именно во внешнем опросе: сервер, который проверяет сам себя, ничего не
  сообщит, когда ляжет целиком. Бесплатный монитор (UptimeRobot и подобные)
  дёргает этот адрес со стороны — и поднимает тревогу в двух случаях:
    • ответа нет вовсе (таймаут, отказ соединения) — сервер лёг или сеть;
    • ответ 503 — процесс жив, но само-диагностика нашла отказ (некуда писать
      данные, кончился диск). См. lib/health.ts.
  ok и warn отдаём как 200: warn (нет свежего бэкапа, не подключена почта) —
  не повод будить владельца ночью.

  Наружу без ключа отдаём только уровень — ни путей, ни цифр диска. С ключом
  с заголовком Authorization: Bearer HEALTH_TOKEN — полную раскладку по
  проверкам. Секрет не попадает в URL, историю браузера и access logs.
*/

// Ответ обязан быть свежим на каждый запрос — иначе монитор увидит протухший
// «ок». Диск за нас бережёт короткий кэш внутри getHealthReport.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const report = await getHealthReport();
  const status = httpStatusForHealth(report.status);

  const token = process.env.HEALTH_TOKEN?.trim();
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const authorized = Boolean(token) && authorization === `Bearer ${token}`;

  const body = authorized
    ? report
    : { status: report.status, checkedAt: report.checkedAt };

  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
