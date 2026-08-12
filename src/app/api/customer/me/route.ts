import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { customer: await currentCustomer() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
