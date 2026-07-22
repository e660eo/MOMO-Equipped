"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, writeJson, assertWritable } from "@/lib/store";
import { uniqueSlug } from "@/lib/slug";
import type { NewsItem } from "@/lib/types";

/* Новости журнала: короткие заметки на главной и в разделе /news. */

const FILE = "news.json";

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

    if (!title) return { error: "Впишите заголовок." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Выберите дату." };
    if (!excerpt) return { error: "Впишите текст новости." };

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
    };

    const next = existing
      ? news.map((n) => (n.slug === item.slug ? item : n))
      : [item, ...news];

    // Свежие сверху: главная и /news показывают список как есть.
    next.sort((a, b) => b.date.localeCompare(a.date));

    writeJson(FILE, next);
    revalidatePath("/", "layout");
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Не удалось сохранить." };
  }

  redirect("/admin/news?saved=1");
}

export async function deleteNews(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  const news = readJson<NewsItem[]>(FILE);
  writeJson(
    FILE,
    news.filter((n) => n.slug !== slug),
  );
  revalidatePath("/", "layout");
  revalidatePath("/admin/news");
}
