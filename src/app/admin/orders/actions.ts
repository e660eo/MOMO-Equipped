"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { updateOrder } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

/* Работа с заказом из панели: статус и заметка менеджера. */

const ALLOWED: OrderStatus[] = ["new", "in_work", "done", "canceled"];

export async function setOrderStatus(formData: FormData): Promise<void> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!ALLOWED.includes(status)) return;

  updateOrder(id, { status });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

export async function setOrderNote(formData: FormData): Promise<void> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  updateOrder(id, { note: String(formData.get("note") ?? "").trim() });
  revalidatePath(`/admin/orders/${id}`);
}
