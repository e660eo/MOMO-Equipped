import { NextResponse, type NextRequest } from "next/server";

/*
  Быстрый отсев неавторизованных запросов к панели.

  Файл называется proxy.ts — так в Next 16 называется бывший middleware.
  Работает в edge-окружении, где нет node:crypto, поэтому здесь проверяется
  только наличие куки. Подпись и срок сессии проверяет серверный код панели
  (layout и каждое действие записи) — на нём и держится защита, а это лишь
  избавляет от лишнего рендера и мигания страницы.
*/
export default function proxy(req: NextRequest) {
  if (req.cookies.has("momo_admin")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Всё в /admin, кроме самой страницы входа
  matcher: ["/admin", "/admin/((?!login).*)"],
};
