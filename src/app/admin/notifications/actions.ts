"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { retryDealerNotification, processDealerOrderNotifications } from "@/lib/dealer-order-notifications";
import { retryIntegrationMailJob, runIntegrationQueue } from "@/lib/job-queue";
import { audit } from "@/lib/audit-log";

export async function retryNotification(form: FormData): Promise<void> {
  await requireSession();
  const id = String(form.get("id") ?? "");
  const source = String(form.get("source") ?? "");
  if (!id || id.length > 300) return;
  if (source === "dealer") {
    retryDealerNotification(id);
    void processDealerOrderNotifications().catch((error) => console.error("[mail-retry]", error));
  } else if (source === "shop") {
    retryIntegrationMailJob(id);
    void runIntegrationQueue().catch((error) => console.error("[mail-retry]", error));
  } else return;
  audit({ entity: "integration", entityId: id, action: "mail_retry", summary: "Запрошен повтор уведомления" });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
