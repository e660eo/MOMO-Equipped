import { hasSession } from "@/lib/admin-auth";
import { currentDealer } from "@/lib/dealer-auth";
import { readDealerInvoice } from "@/lib/dealer-invoices";
import { getDealerOrderAgreement } from "@/lib/dealer-order-management";
import { getDealerOrders } from "@/lib/dealers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await hasSession();
  const dealer = admin ? null : await currentDealer();
  if (!admin && !dealer) return new Response("Требуется вход", { status: 401, headers: privateHeaders });
  const { id } = await params;
  const order = getDealerOrders().find((item) => item.id === id);
  if (!order || (!admin && dealer?.account.id !== order.accountId)) return new Response("Файл не найден", { status: 404, headers: privateHeaders });
  const invoice = getDealerOrderAgreement(order.id)?.invoiceFile;
  if (!invoice) return new Response("Файл не найден", { status: 404, headers: privateHeaders });
  try {
    const buffer = readDealerInvoice(invoice);
    return new Response(new Uint8Array(buffer), { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Length": String(buffer.length), "Content-Disposition": `attachment; filename="invoice.pdf"; filename*=UTF-8''${encodeURIComponent(invoice.originalName)}` } });
  } catch { return new Response("Файл не найден", { status: 404, headers: privateHeaders }); }
}
