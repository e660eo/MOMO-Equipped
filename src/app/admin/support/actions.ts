"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { addSupportDocument, removeSupportDocument } from "@/lib/support-documents";
import { saveSupportFile, deleteSupportFile } from "@/lib/support-files";
import { audit } from "@/lib/audit-log";
import { ExpectedError, isRedirect, messageFor } from "@/lib/errors";
import type { SupportDocumentCategory } from "@/lib/types";

const CATEGORIES: SupportDocumentCategory[] = ["instruction", "scheme", "certificate", "warranty", "catalog", "marketing"];

export async function uploadSupportDocument(formData: FormData): Promise<void> {
  await requireSession();
  let savedFile: string | undefined;
  try {
    const title = String(formData.get("title") ?? "").trim().slice(0, 180);
    const description = String(formData.get("description") ?? "").trim().slice(0, 500);
    const category = String(formData.get("category") ?? "") as SupportDocumentCategory;
    const audience = String(formData.get("audience") ?? "");
    const upload = formData.get("file");
    if (!title) throw new ExpectedError("Впишите название документа.");
    if (!CATEGORIES.includes(category)) throw new ExpectedError("Выберите раздел документа.");
    if (audience !== "public" && audience !== "dealer") throw new ExpectedError("Выберите аудиторию.");
    if (!(upload instanceof File) || !upload.size) throw new ExpectedError("Выберите файл.");
    savedFile = await saveSupportFile(upload, audience);
    const document = addSupportDocument({
      title,
      ...(description ? { description } : {}),
      category,
      audience,
      file: savedFile,
      originalName: upload.name.slice(0, 200),
      mimeType: upload.type,
      size: upload.size,
    });
    audit({ entity: "support", entityId: document.id, action: "document_added", summary: `Добавлен материал «${title}» (${audience})` });
    revalidatePath("/support");
    revalidatePath("/dealer");
    redirect("/admin/support?saved=1");
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (savedFile) {
      const failedAudience = String(formData.get("audience") ?? "") === "dealer" ? "dealer" : "public";
      await deleteSupportFile(savedFile, failedAudience);
    }
    const message = messageFor(error, "Не удалось загрузить материал.", "uploadSupportDocument");
    redirect(`/admin/support?error=${encodeURIComponent(message)}`);
  }
}

export async function deleteSupportDocument(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  await removeSupportDocument(id);
  audit({ entity: "support", entityId: id, action: "document_removed", summary: "Материал поддержки удалён" });
  revalidatePath("/admin/support");
  revalidatePath("/support");
  revalidatePath("/dealer");
}
