import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasSession } from "@/lib/admin-auth";
import { currentDealer } from "@/lib/dealer-auth";
import { readDealerInvoice } from "@/lib/dealer-invoices";
import { getDealerOrderAgreement } from "@/lib/dealer-order-management";
import { getDealerOrders } from "@/lib/dealers";
import { GET } from "./route";

vi.mock("@/lib/admin-auth", () => ({ hasSession: vi.fn() }));
vi.mock("@/lib/dealer-auth", () => ({ currentDealer: vi.fn() }));
vi.mock("@/lib/dealer-invoices", () => ({ readDealerInvoice: vi.fn() }));
vi.mock("@/lib/dealer-order-management", () => ({ getDealerOrderAgreement: vi.fn() }));
vi.mock("@/lib/dealers", () => ({ getDealerOrders: vi.fn() }));
const request = new Request("https://momo.test/dealer/orders/D-test/invoice");
const params = { params: Promise.resolve({ id: "D-test" }) };

beforeEach(() => {
  vi.mocked(hasSession).mockResolvedValue(false);
  vi.mocked(currentDealer).mockResolvedValue(null);
  vi.mocked(getDealerOrders).mockReturnValue([{ id: "D-test", accountId: "owner" }] as ReturnType<typeof getDealerOrders>);
  vi.mocked(getDealerOrderAgreement).mockReturnValue({ invoiceFile: { id: "file", originalName: "Счёт.pdf" } } as ReturnType<typeof getDealerOrderAgreement>);
  vi.mocked(readDealerInvoice).mockReset().mockReturnValue(Buffer.from("%PDF-1.7"));
});

describe("dealer invoice authorization", () => {
  it("denies anonymous and other dealer accounts without reading the file", async () => {
    expect((await GET(request, params)).status).toBe(401);
    vi.mocked(currentDealer).mockResolvedValue({ account: { id: "other" } } as Awaited<ReturnType<typeof currentDealer>>);
    expect((await GET(request, params)).status).toBe(404);
    expect(readDealerInvoice).not.toHaveBeenCalled();
  });
  it("serves the owner with private attachment headers", async () => {
    vi.mocked(currentDealer).mockResolvedValue({ account: { id: "owner" } } as Awaited<ReturnType<typeof currentDealer>>);
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("%PDF-1.7");
  });
  it("allows the authenticated administrator", async () => {
    vi.mocked(hasSession).mockResolvedValue(true);
    expect((await GET(request, params)).status).toBe(200);
  });
});
