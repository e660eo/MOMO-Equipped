export const YANDEX_METRIKA_ID = 110907002;

export const METRIKA_GOALS = {
  registrationSuccess: "registration_success",
  productView: "product_view",
  addToCart: "add_to_cart",
  catalogSearch: "catalog_search",
  catalogFilter: "catalog_filter",
  checkoutStart: "checkout_start",
  orderCreated: "order_created",
  paymentStarted: "payment_started",
  purchase: "purchase",
  supportMessage: "support_message",
  systemBuilderComplete: "system_builder_complete",
  systemBuilderAdd: "system_builder_add",
  vehicleFitmentCheck: "vehicle_fitment_check",
} as const;

export const ANALYTICS_CONSENT_KEY = "momo-cookie-consent";
export const ANALYTICS_CONSENT_VERSION = "2026-10-14";
export const ANALYTICS_CONSENT_EVENT = "momo:analytics-consent";
export const METRIKA_GOAL_EVENT = "momo:metrika-goal";

export function analyticsChoice(): { accepted: boolean; version: string; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(ANALYTICS_CONSENT_KEY) || "null");
    const at = Date.parse(value?.at);
    return value?.version === ANALYTICS_CONSENT_VERSION && typeof value.accepted === "boolean" &&
      Number.isFinite(at) && at <= Date.now() && Date.now() - at < 180 * 86400000 ? value : null;
  } catch { return null; }
}
export function analyticsConsentGranted(): boolean { return analyticsChoice()?.accepted === true; }
export function analyticsPathAllowed(path: string): boolean {
  return !/^\/(admin|dealer|profile|order|cart|verify-email|reset-password|support|contacts|become-dealer)(\/|$)/.test(path);
}

declare global {
  interface Window {
    ym?: (id: number, action: string, ...rest: unknown[]) => void;
  }
}

/**
 * Явные цели отправляем только после подтверждённого результата сервера.
 * Никакие имя, телефон или email в Метрику не передаются.
 */
export function reachMetrikaGoal(
  goal: (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS],
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined" || !analyticsConsentGranted() || !analyticsPathAllowed(window.location.pathname)) return;
  if (window.ym) {
    if (params) window.ym(YANDEX_METRIKA_ID, "reachGoal", goal, params);
    else window.ym(YANDEX_METRIKA_ID, "reachGoal", goal);
    return;
  }
  window.dispatchEvent(new CustomEvent(METRIKA_GOAL_EVENT, { detail: { goal, params } }));
}
