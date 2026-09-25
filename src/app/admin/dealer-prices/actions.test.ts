import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), apply: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/dealer-price-import-store", () => ({ applyDealerPriceImport: mocks.apply, saveDealerPriceImportPreview: mocks.save }));
vi.mock("@/lib/dealer-workbook", () => ({ readDealerWorkbook: mocks.read, normalizeDealerSource: (value: string) => value.trim().toLowerCase() }));
vi.mock("@/lib/data", () => ({ getAllProducts: () => [] }));
vi.mock("@/lib/b2b-prices", () => ({ getB2BPriceBook: () => ({ prices: {} }) }));
vi.mock("@/lib/audit-log", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { previewDealerPriceUpload, confirmDealerPriceUpload } from "./actions";

describe("admin Excel import actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireSession.mockResolvedValue(undefined); });

  it("requires administrator authentication before reading uploads or applying prices", async () => {
    mocks.requireSession.mockRejectedValue(new Error("sign in"));
    await expect(previewDealerPriceUpload({}, new FormData())).rejects.toThrow("sign in");
    await expect(confirmDealerPriceUpload({}, new FormData())).rejects.toThrow("sign in");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("requires explicit review confirmation and a server saved preview id", async () => {
    const form = new FormData();
    expect((await confirmDealerPriceUpload({}, form)).error).toContain("подтвердите");
    form.set("confirmed", "yes");
    form.set("previewId", "../data");
    expect((await confirmDealerPriceUpload({}, form)).error).toContain("не найден");
    expect(mocks.apply).not.toHaveBeenCalled();
    const id = "d0a5c211-49f2-4f12-a4ff-bd7f3c10eae3";
    form.set("previewId", id);
    mocks.apply.mockReturnValue(106);
    expect(await confirmDealerPriceUpload({}, form)).toEqual({ count: 106 });
    expect(mocks.apply).toHaveBeenCalledWith(id);
  });

  it("rejects unsupported files before spreadsheet parsing", async () => {
    const form = new FormData();
    form.set("workbook", new File(["not excel"], "price.csv"));
    expect((await previewDealerPriceUpload({}, form)).error).toContain(".xlsx");
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
