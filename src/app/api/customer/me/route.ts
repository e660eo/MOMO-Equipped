import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { currentDealer } from "@/lib/dealer-auth";
import { toPublicDealerSession } from "@/lib/viewer-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const [customer, dealerSession] = await Promise.all([
    currentCustomer(),
    currentDealer(),
  ]);
  return NextResponse.json(
    { customer, dealer: toPublicDealerSession(dealerSession) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
