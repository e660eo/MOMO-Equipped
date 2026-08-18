export const YANDEX_METRIKA_ID = 110907002;

export const METRIKA_GOALS = {
  registrationSuccess: "registration_success",
} as const;

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
): void {
  if (typeof window === "undefined") return;
  window.ym?.(YANDEX_METRIKA_ID, "reachGoal", goal);
}
