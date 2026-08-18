import { afterEach, describe, expect, it, vi } from "vitest";
import {
  METRIKA_GOALS,
  reachMetrikaGoal,
  YANDEX_METRIKA_ID,
} from "./metrika";

describe("reachMetrikaGoal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is safe during server rendering", () => {
    expect(() =>
      reachMetrikaGoal(METRIKA_GOALS.registrationSuccess),
    ).not.toThrow();
  });

  it("sends the successful registration goal without parameters", () => {
    const ym = vi.fn();
    vi.stubGlobal("window", { ym });

    reachMetrikaGoal(METRIKA_GOALS.registrationSuccess);

    expect(ym).toHaveBeenCalledWith(
      YANDEX_METRIKA_ID,
      "reachGoal",
      "registration_success",
    );
  });
});
