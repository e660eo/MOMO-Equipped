import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site-url";

/*
  Единственная точка, через которую проходит каждый запрос к страницам.
  Делает две вещи:

    1. не пускает посторонних в закрытые разделы;
    2. выдаёт каждому HTML-ответу строгую политику безопасности контента.

  Файл называется proxy.ts: в Next 16 так называется бывший middleware.ts,
  под старым именем сборка его просто не увидит.

  Здесь нельзя импортировать lib/admin-auth: он тянет node:crypto и чтение
  файлов, а этот код исполняется в edge-окружении. Поэтому имя куки написано
  строкой — при переименовании поправить в обоих местах.
*/

const SESSION_COOKIE = "momo_admin";
const LOGIN_PAGE = "/admin/login";

/*
  Закрытые разделы. У проекта это только панель владельца: кабинет
  покупателя /profile намеренно открыт — вошедшему он показывает заказы,
  остальным форму входа на том же месте. Появится раздел вида /dashboard —
  достаточно дописать его сюда, matcher внизу уже покрывает весь сайт.
*/
const PROTECTED = ["/admin"];
// …кроме самой формы входа, иначе редирект зациклится сам на себя.
const OPEN_INSIDE = [LOGIN_PAGE];

function inSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

function needsSession(pathname: string): boolean {
  if (OPEN_INSIDE.some((p) => inSection(pathname, p))) return false;
  return PROTECTED.some((p) => inSection(pathname, p));
}

/* ---------------------------------- CSP ---------------------------------- */

/*
  Политика безопасности контента.

  Внешние скрипты разрешены только с нашего домена и с явно перечисленных
  доменов Яндекса. `unsafe-inline` нужен для встроенных RSC/bootstrap-данных
  Next: nonce сделал бы каждую страницу динамической. Production-бандлы при
  этом получают SRI-хеши, остальные опасные возможности ограничены ниже.
*/
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://mc.yandex.com https://pay.yandex.ru https://yastatic.net https://*.yandex.ru https://*.yandex.net",
    // React не использует HTML-обработчики onclick="...". Запрещаем их
    // отдельно, даже пока bootstrap Next требует inline script elements.
    "script-src-attr 'none'",
    // Стили инлайновые по устройству React (style={{…}}) и Tailwind. Отдельной
    // дырой это не является: подмена стилей — не выполнение кода.
    "style-src 'self' 'unsafe-inline' blob:",
    // data: — заглушки next/image; внешние домены — Метрика, Web SDK Пэй и
    // подложка Яндекс Карты для выбора ПВЗ Ozon.
    "img-src 'self' data: blob: https://mc.yandex.ru https://mc.yandex.com https://pay.yandex.ru https://yandex.ru https://*.maps.yandex.net https://api-maps.yandex.ru https://*.api-maps.yandex.ru",
    "font-src 'self' data:",
    // Куда странице разрешено стучаться. Даже выполнившийся чужой скрипт не
    // отправит отсюда корзину и телефоны покупателей на свой сервер.
    "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com https://pay.yandex.ru https://yandex.ru https://*.yandex.ru https://*.maps.yandex.net https://*.taxi.yandex.net https://api-maps.yandex.ru https://*.api-maps.yandex.ru",
    // Карта проезда, служебная рамка Метрики и — когда включат — оплата.
    "child-src https://api-maps.yandex.ru",
    "frame-src https://yandex.ru https://mc.yandex.ru https://pay.yandex.ru https://api-maps.yandex.ru",
    // Нас самих в чужую рамку не затянуть: кликджекинг на форме входа.
    "frame-ancestors 'none'",
    // Подменённый <base> увёл бы все относительные адреса на чужой сервер.
    "base-uri 'none'",
    // Форма с паролем может отправиться только к нам.
    "form-action 'self'",
    "object-src 'none'",
    /*
      upgrade-insecure-requests намеренно нет: HTTPS на всём домене уже
      обеспечен HSTS из next.config.ts, а на локальной прод-сборке по http
      директива ломала бы загрузку всего.
    */
  ].join("; ");
}

/* --------------------------------- запрос -------------------------------- */

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Один индексируемый хост. Редирект в приложении страхует конфигурацию
  // reverse proxy и сохраняет путь с query string.
  if (process.env.NODE_ENV === "production") {
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = (forwardedHost || req.headers.get("host") || req.nextUrl.host)
      .toLowerCase()
      .replace(/:\d+$/, "");
    if (host === "www.momo-eq.ru") {
      const canonical = new URL(`${pathname}${req.nextUrl.search}`, SITE_URL);
      return NextResponse.redirect(canonical, 308);
    }
  }

  /*
    Отсев без куки — быстрый и грубый. Подпись здесь не проверить (в edge нет
    node:crypto), поэтому настоящая проверка живёт в каждой странице панели
    (requireAdminPage) и в каждом действии записи (requireSession). Этот шаг
    экономит рендер и не даёт мигнуть панелью.
  */
  if (needsSession(pathname) && !req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_PAGE;
    url.search = "";
    return NextResponse.redirect(url);
  }

  /*
    В разработке политику не выдаём: Turbopack пересобирает страницу
    скриптами с eval и своими встроенными вставками, под CSP отвалилась бы
    горячая перезагрузка. Dev-сервер доступен только с этой машины.
  */
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const csp = contentSecurityPolicy();
  const res = NextResponse.next();
  // Filter, sort and search combinations must not create duplicate pages in
  // the index. The header preserves noindex while /catalog itself stays SSG.
  if (pathname === "/catalog" && req.nextUrl.searchParams.size > 0) {
    res.headers.set("X-Robots-Tag", "noindex, follow");
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
  }
  /*
    CSP_REPORT_ONLY=1 в окружении переводит политику в режим наблюдения:
    браузер ничего не блокирует, только пишет нарушения в консоль. Нужен,
    если после правки внешних скриптов на сайте что-то отвалится — включить
    на день, посмотреть, вернуть обратно.
  */
  res.headers.set(
    process.env.CSP_REPORT_ONLY === "1"
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    csp,
  );
  return res;
}

export const config = {
  matcher: [
    {
      /*
        Все страницы, кроме статики: бандлы, картинки и файлы для роботов
        политику не читают, а лишний вызов на каждый снимок каталога — это
        сотни вызовов на страницу.
      */
      source:
        "/((?!_next/static|_next/image|media/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|woff2?)$).*)",
      // Предзагрузка ссылок роутером тянет данные, а не разметку со
      // скриптами: метка ей не нужна, а проверка сессии на них не влияет —
      // страницы панели всё равно проверяют подпись сами.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
