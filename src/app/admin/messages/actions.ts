"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import {
  addAdminSupportReply,
  setSupportConversationStatus,
} from "@/lib/support-conversations";

export async function replySupportConversation(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim().slice(0, 80);
  const text = String(formData.get("text") ?? "").trim().slice(0, 2_000);
  if (!id || !text) return;
  addAdminSupportReply(id, text);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function changeSupportConversationStatus(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim().slice(0, 80);
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "open" && status !== "closed")) return;
  setSupportConversationStatus(id, status);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}
