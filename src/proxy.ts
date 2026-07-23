import { NextResponse, type NextRequest } from "next/server";

/*
  Единственная точка, через которую проходит каждый запрос к страницам.
  Делает две вещи:

    1. не пускает посторонних в закрытые разделы;
    2. выдаёт каждому ответу политику безопасности контента (CSP) с
       одноразовой меткой nonce — она и есть настоящая защита от XSS.

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

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/*
  Политика безопасности контента.

  Читается так: «выполняй только те скрипты, у которых есть сегодняшняя
  метка». Метка одноразовая и заранее не известна, поэтому скрипт, попавший
  в страницу через дыру в данных, не выполнится, даже если разметку
  собирает наш собственный код.

  Про подпорки в script-src: 'unsafe-inline' игнорируется всеми браузерами,
  которые понимают nonce, а https: — всеми, кто понимает 'strict-dynamic'.
  Они лежат здесь для старых браузеров, где иначе сайт остался бы вообще
  без скриптов. Порядок именно такой, это стандартный «strict CSP».

  'strict-dynamic' нужен Метрике: её встроенный загрузчик (метку он получает)
  сам вставляет tag.js с mc.yandex.ru, и перечислять внешние адреса не надо —
  доверие наследуется от того, кто вставил.
*/
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // Стили инлайновые по устройству React (style={{…}}) и Tailwind. Отдельной
    // дырой это не является: подмена стилей — не выполнение кода.
    "style-src 'self' 'unsafe-inline'",
    // data: — заглушки-размытия next/image, mc.yandex.ru — пиксель Метрики.
    "img-src 'self' data: blob: https://mc.yandex.ru https://mc.yandex.com",
    "font-src 'self' data:",
    // Куда странице разрешено стучаться. Даже выполнившийся чужой скрипт не
    // отправит отсюда корзину и телефоны покупателей на свой сервер.
    "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com",
    // Карта проезда, служебная рамка Метрики и — когда включат — оплата.
    "frame-src https://yandex.ru https://mc.yandex.ru https://pay.yandex.ru",
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

  const nonce = makeNonce();
  const csp = contentSecurityPolicy(nonce);

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  /*
    Политика в заголовках запроса — не опечатка: по ней Next достаёт nonce и
    сам проставляет его своим служебным скриптам (загрузчику бандлов и
    потоковым данным RSC). Наружу этот заголовок не уходит, наружу идёт тот,
    что ставится ответу ниже.
  */
  headers.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers } });
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
