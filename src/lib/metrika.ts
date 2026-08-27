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
} as const;

export const ANALYTICS_CONSENT_KEY = "momo-cookie-consent";
export const ANALYTICS_CONSENT_EVENT = "momo:analytics-consent";
export const METRIKA_GOAL_EVENT = "momo:metrika-goal";

export function analyticsConsentGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "1";
  } catch {
    return false;
  }
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
  if (typeof window === "undefined" || !analyticsConsentGranted()) return;
  if (window.ym) {
    if (params) window.ym(YANDEX_METRIKA_ID, "reachGoal", goal, params);
    else window.ym(YANDEX_METRIKA_ID, "reachGoal", goal);
    return;
  }
  window.dispatchEvent(new CustomEvent(METRIKA_GOAL_EVENT, { detail: { goal, params } }));
}
