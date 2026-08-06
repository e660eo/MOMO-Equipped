import { permanentRedirect } from "next/navigation";
import { getCategories } from "@/lib/data";

/*
  Старый магазин оставил в поиске ссылки вида
  /login?backurl=/catalog/sabvufery/. Страница входа больше не нужна, но 404
  обнуляет пользу старой ссылки. Перенаправляем только на известные внутренние
  разделы — произвольный backurl принимать нельзя из-за open redirect.
*/
export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ backurl?: string }>;
}) {
  const { backurl = "" } = await searchParams;
  const knownCategories = new Set(getCategories().map((item) => item.slug));

  let decoded = backurl;
  try {
    decoded = decodeURIComponent(backurl);
  } catch {
    // Next обычно уже декодировал значение. Некорректную строку не используем.
  }

  const category = decoded.match(/^\/catalog\/([a-z0-9-]+)(?:\/|\?|$)/)?.[1];
  if (category && knownCategories.has(category)) {
    permanentRedirect(`/catalog/${category}`);
  }

  if (decoded.startsWith("/catalog")) permanentRedirect("/catalog");
  permanentRedirect("/");
}
