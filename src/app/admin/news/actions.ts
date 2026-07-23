"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, updateJson, assertWritable } from "@/lib/store";
import { uniqueSlug } from "@/lib/slug";
import { messageFor, isRedirect } from "@/lib/errors";
import type { NewsItem } from "@/lib/types";

/* Новости журнала: заметки и статьи на главной и в разделе /news. */

const FILE = "news.json";

/*
  Границы полей. Панель за паролем, так что это не защита от нападающего,
  а страховка от вставки не туда: нечаянно уроненный в поле мегабайт уедет
  в JSON, в сборку статических страниц и в разметку каждой новости.

  Полный текст — до 40 000 знаков: это примерно 20 страниц, длиннее любого
  разбора установки.
*/
const MAX_TITLE = 200;
const MAX_EXCERPT = 600;
const MAX_BODY = 40_000;

/**
 * Нормализация текста статьи: переносы строк к одному виду, обрезка хвостовых
 * пробелов в строках и склейка трёх и более пустых строк в одну.
 *
 * Так текст из Word не приносит с собой вертикальные дыры на странице, а
 * разбор в article.ts получает предсказуемый вход.
 */
function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ActionState = { error?: string };

export async function saveNews(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();

    const title = String(formData.get("title") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();
    const excerpt = String(formData.get("excerpt") ?? "").trim();
    const body = normalizeBody(String(formData.get("body") ?? ""));

    if (!title) return { error: "Впишите заголовок." };
    if (title.length > MAX_TITLE) {
      return { error: `Заголовок длиннее ${MAX_TITLE} знаков — сократите.` };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Выберите дату." };
    if (!excerpt) return { error: "Впишите анонс новости." };
    if (excerpt.length > MAX_EXCERPT) {
      return {
        error: `Анонс длиннее ${MAX_EXCERPT} знаков. Он показывается карточкой в списке — длинное лучше перенести в полный текст.`,
      };
    }
    if (body.length > MAX_BODY) {
      return {
        error: `Текст статьи длиннее ${MAX_BODY.toLocaleString("ru-RU")} знаков — разбейте на несколько заметок.`,
      };
    }

    const news = readJson<NewsItem[]>(FILE);
    const editing = String(formData.get("slug") ?? "").trim();
    const existing = editing ? news.find((n) => n.slug === editing) : undefined;
    if (editing && !existing) return { error: "Новость не найдена." };

    const item: NewsItem = {
      slug:
        existing?.slug ??
        uniqueSlug(
          title,
          news.map((n) => n.slug),
        ),
      title,
      date,
      excerpt,
      // Пустое поле не сохраняем ключом: заметка без статьи и заметка со
      // статьёй из пустой строки — одно и то же, а разное в файле путает.
      ...(body ? { body } : {}),
    };

    updateJson<NewsItem[]>(FILE, (all) => {
      const merged = existing
        ? all.map((n) => (n.slug === item.slug ? item : n))
        : [item, ...all];
      // Свежие сверху: главная и /news показывают список как есть
      return [...merged].sort((a, b) => b.date.localeCompare(a.date));
    });
    revalidatePath("/", "layout");
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: messageFor(e, "Не удалось сохранить.", "saveNews") };
  }

  redirect("/admin/news?saved=1");
}

export async function deleteNews(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  updateJson<NewsItem[]>(FILE, (all) => all.filter((n) => n.slug !== slug));
  revalidatePath("/", "layout");
  revalidatePath("/admin/news");
}
