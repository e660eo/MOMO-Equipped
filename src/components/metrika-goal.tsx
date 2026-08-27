"use client";

import { useEffect } from "react";
import { reachMetrikaGoal, type METRIKA_GOALS } from "@/lib/metrika";

type Goal = (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS];

export function MetrikaGoal({
  goal,
  dedupeKey,
  params,
}: {
  goal: Goal;
  dedupeKey?: string;
  params?: Record<string, string | number | boolean>;
}) {
  useEffect(() => {
    const storageKey = dedupeKey ? `momo-metrika-${goal}-${dedupeKey}` : "";
    try {
      if (storageKey && sessionStorage.getItem(storageKey)) return;
      reachMetrikaGoal(goal, params);
      if (storageKey) sessionStorage.setItem(storageKey, "1");
    } catch {
      reachMetrikaGoal(goal, params);
    }
  }, [dedupeKey, goal, params]);
  return null;
}
