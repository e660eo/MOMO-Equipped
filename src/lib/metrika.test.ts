import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_VERSION, analyticsChoice, analyticsPathAllowed, METRIKA_GOALS, reachMetrikaGoal, YANDEX_METRIKA_ID } from "./metrika";

const choice = (accepted = true, at = new Date().toISOString()) =>
  JSON.stringify({ accepted, at, version: ANALYTICS_CONSENT_VERSION });
describe("analytics consent and privacy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("is safe during server rendering", () => {
    expect(() => reachMetrikaGoal(METRIKA_GOALS.registrationSuccess)).not.toThrow();
  });
  it.each(["1", "accepted", "{}", "invalid", choice(false), choice(true, "2020-01-01")])
    ("does not send goals without a valid current permission: %s", (stored) => {
      const ym = vi.fn();
      vi.stubGlobal("window", { ym, location: { pathname: "/" } });
      vi.stubGlobal("localStorage", { getItem: () => stored });
      reachMetrikaGoal(METRIKA_GOALS.registrationSuccess);
      expect(ym).not.toHaveBeenCalled();
    });
  it("sends a permitted public-page goal without personal parameters", () => {
    const ym = vi.fn();
    vi.stubGlobal("window", { ym, location: { pathname: "/" } });
    vi.stubGlobal("localStorage", { getItem: () => choice() });
    reachMetrikaGoal(METRIKA_GOALS.registrationSuccess);
    expect(ym).toHaveBeenCalledWith(YANDEX_METRIKA_ID, "reachGoal", "registration_success");
    expect(analyticsChoice()?.accepted).toBe(true);
  });
  it.each(["/admin", "/dealer/orders", "/profile", "/order/secret", "/reset-password", "/verify-email", "/contacts", "/become-dealer", "/cart"])
    ("blocks private routes even with consent: %s", (pathname) => {
      const ym = vi.fn();
      vi.stubGlobal("window", { ym, location: { pathname } });
      vi.stubGlobal("localStorage", { getItem: () => choice() });
      expect(analyticsPathAllowed(pathname)).toBe(false);
      reachMetrikaGoal(METRIKA_GOALS.registrationSuccess);
      expect(ym).not.toHaveBeenCalled();
    });
});
