import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpectedError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), account: vi.fn(), location: vi.fn(), session: vi.fn(), audit: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireSession: mocks.auth }));
vi.mock("@/lib/dealer-auth", () => ({ startDealerSession: mocks.session }));
vi.mock("@/lib/dealers", () => ({ findDealerAccount: mocks.account, getDealerLocation: mocks.location }));
vi.mock("@/lib/audit-log", () => ({ audit: mocks.audit }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { openDemoDealerCabinet } from "./demo-action";

const account = { id: "trial-dealer-account", dealerId: "trial-dealer-momo", activatedAt: "2026-08-19T11:10:00Z" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(undefined);
  mocks.account.mockReturnValue(account);
  mocks.location.mockReturnValue({ id: account.dealerId });
  mocks.session.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});

describe("admin access to the existing demo dealer", () => {
  it("requires a valid administrator session before looking up or opening any dealer account", async () => {
    mocks.auth.mockRejectedValue(new ExpectedError("Нужно войти заново"));
    expect(await openDemoDealerCabinet({})).toEqual({ error: "Нужно войти заново" });
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("opens only the fixed demo account and audits the action", async () => {
    await expect(openDemoDealerCabinet({ error: "real-customer-account" })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.account).toHaveBeenCalledWith("trial-dealer-account");
    expect(mocks.session).toHaveBeenCalledWith("trial-dealer-account");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ entityId: account.id, action: "demo_opened" }));
    expect(mocks.redirect).toHaveBeenCalledWith("/dealer");
  });
  it.each([undefined, { ...account, dealerId: "another-dealer" }, { ...account, disabled: true }, { ...account, activatedAt: undefined }])("does not activate, recreate or open an unavailable demo account", async (value) => {
    mocks.account.mockReturnValue(value);
    expect((await openDemoDealerCabinet({})).error).toBeTruthy();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
