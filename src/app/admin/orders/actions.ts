"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { getOrder, setOrderArchived, updateOrder } from "@/lib/orders";
import { enqueueIntegrationJob, runIntegrationQueue } from "@/lib/job-queue";
import { audit } from "@/lib/audit-log";
import type { OrderStatus } from "@/lib/types";
import type { IntegrationJobType } from "@/lib/types";

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
  // Статус меняют и из раздела «Клиенты» — там он должен освежиться сразу.
  revalidatePath("/admin/customers");
}

export async function setOrderNote(formData: FormData): Promise<void> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  updateOrder(id, { note: String(formData.get("note") ?? "").trim() });
  revalidatePath(`/admin/orders/${id}`);
}

export async function bulkManageOrders(formData: FormData): Promise<void> {
  await requireSession();
  const ids = [...new Set(formData.getAll("ids").map(String).filter(Boolean))];
  const operation = String(formData.get("operation") ?? "");
  if (!ids.length) return;

  if (operation === "archive" || operation === "restore") {
    const archived = operation === "archive";
    for (const id of ids) {
      const before = getOrder(id);
      if (!before || Boolean(before.archivedAt) === archived) continue;
      const after = setOrderArchived(id, archived);
      if (!after) continue;
      audit({
        entity: "order",
        entityId: id,
        action: archived ? "archived" : "restored",
        summary: archived ? `Заказ ${id} перемещён в архив` : `Заказ ${id} восстановлен из архива`,
        before: { archivedAt: before.archivedAt },
        after: { archivedAt: after.archivedAt },
      });
    }
  } else if (operation.startsWith("status:")) {
    const status = operation.slice("status:".length) as OrderStatus;
    if (!ALLOWED.includes(status)) return;
    for (const id of ids) updateOrder(id, { status });
  } else {
    return;
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  for (const id of ids) revalidatePath(`/admin/orders/${id}`);
}

export async function setOrderArchivedAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  const before = getOrder(id);
  if (!before || Boolean(before.archivedAt) === archived) return;
  const after = setOrderArchived(id, archived);
  if (!after) return;
  audit({
    entity: "order",
    entityId: id,
    action: archived ? "archived" : "restored",
    summary: archived ? `Заказ ${id} перемещён в архив` : `Заказ ${id} восстановлен из архива`,
    before: { archivedAt: before.archivedAt },
    after: { archivedAt: after.archivedAt },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/customers");
}

export async function retryOzonShipment(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const order = getOrder(id);
  if (!order?.delivery || order.delivery.shipment?.status === "created") return;

  enqueueIntegrationJob("ozon_shipment", id);
  await runIntegrationQueue();
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function retryOrderIntegration(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "") as IntegrationJobType;
  const allowed: IntegrationJobType[] = ["order_mail", "customer_payment_mail", "fiscal_check"];
  if (!getOrder(id) || !allowed.includes(type)) return;
  const kind = String(formData.get("kind") ?? "").slice(0, 40);
  enqueueIntegrationJob(type, id, kind ? { kind } : undefined);
  await runIntegrationQueue();
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}
