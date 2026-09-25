"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit-log";
import { getDealerOrders } from "@/lib/dealers";
import { getDealerOrderAgreement, saveDealerOrderAgreement, type DealerPaymentStatus } from "@/lib/dealer-order-management";
import { ensureDealerAgreementNotification, ensureDealerOrderNotifications, processDealerOrderNotifications, retryDealerOrderNotifications } from "@/lib/dealer-order-notifications";
import { ExpectedError, messageFor } from "@/lib/errors";
import { discardUnsavedDealerInvoice, saveDealerInvoice, type DealerInvoiceFile } from "@/lib/dealer-invoices";

export type DealerAgreementState = { error?: string; ok?: boolean; revision?: number; warning?: string };

export async function saveDealerAgreementAction(_state: DealerAgreementState, formData: FormData): Promise<DealerAgreementState> {
  await requireSession();
  let uploaded: DealerInvoiceFile | undefined;
  let saved = false;
  try {
    const orderId = String(formData.get("orderId") ?? "");
    const order = getDealerOrders().find((item) => item.id === orderId);
    if (!order) throw new ExpectedError("Заказ не найден.");
    const invoice = formData.get("invoiceFile");
    if (invoice instanceof File && invoice.size > 0) uploaded = await saveDealerInvoice(invoice);
    const field = (key: string) => String(formData.get(key) ?? "");
    const agreement = saveDealerOrderAgreement({
      orderId,
      expectedRevision: Number(field("revision")),
      quantities: Object.fromEntries(order.items.map((item) => [item.slug, Number(field(`qty:${item.slug}`))])),
      deliveryCost: Number(field("deliveryCost").replace(",", ".")),
      deliveryMethod: field("deliveryMethod"),
      deliveryAddress: field("deliveryAddress"),
      paymentTerms: field("paymentTerms"),
      paymentStatus: field("paymentStatus") as DealerPaymentStatus,
      invoiceReference: field("invoiceReference"),
      ...(uploaded ? { invoiceFile: uploaded } : {}),
      trackingNumber: field("trackingNumber"),
      trackingUrl: field("trackingUrl"),
      managerMessage: field("managerMessage"),
    });
    saved = true;
    try { audit({ entity: "dealer", entityId: orderId, action: "order_agreement", summary: `Согласованные условия заказа ${orderId}, версия ${agreement.revision}`, after: agreement }); }
    catch (error) { console.error("[dealer-agreement] audit:", error); }
    let warning: string | undefined;
    try { ensureDealerAgreementNotification(agreement); }
    catch (error) {
      console.error("[dealer-agreement] enqueue:", error);
      warning = "Условия сохранены. Уведомление будет поставлено в очередь автоматически; проверьте блок писем ниже.";
    }
    void processDealerOrderNotifications().catch((error) => console.error("[dealer-agreement] mail:", error));
    revalidatePath(`/admin/dealers/orders/${orderId}`);
    revalidatePath("/admin/dealers");
    revalidatePath(`/dealer/orders/${orderId}`);
    revalidatePath("/dealer/orders");
    revalidatePath("/dealer");
    return { ok: true, revision: agreement.revision, warning };
  } catch (error) {
    if (uploaded && !saved) {
      try { discardUnsavedDealerInvoice(uploaded); }
      catch (cleanupError) { console.error("[dealer-agreement] invoice cleanup:", cleanupError); }
    }
    const revision = Number(formData.get("revision"));
    return { error: messageFor(error, "Не удалось сохранить условия заказа.", "saveDealerAgreementAction"), ...(Number.isSafeInteger(revision) && revision >= 0 ? { revision } : {}) };
  }
}

export async function retryDealerOrderMailAction(formData: FormData): Promise<void> {
  await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  const order = getDealerOrders().find((item) => item.id === orderId);
  if (!order) throw new ExpectedError("Заказ не найден.");
  ensureDealerOrderNotifications(order);
  const agreement = getDealerOrderAgreement(orderId);
  if (agreement) ensureDealerAgreementNotification(agreement);
  retryDealerOrderNotifications(orderId);
  void processDealerOrderNotifications().catch((error) => console.error("[dealer-mail] manual retry:", error));
  revalidatePath(`/admin/dealers/orders/${orderId}`);
}
