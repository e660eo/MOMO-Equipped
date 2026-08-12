import { describe, expect, it } from "vitest";
import { diameterBucket, parseTech, powerBucket } from "./specs";

describe("catalogue technical filters", () => {
  it("extracts diameter, power and impedance", () => {
    expect(parseTech("Сабвуфер 12 дюймов 1200 Вт 2 Ом")).toMatchObject({
      diameterMm: 305,
      powerMaxW: 1200,
      impedanceOhm: 2,
    });
  });

  it("maps values to stable filter buckets", () => {
    expect(diameterBucket(165)).toBe("16–17 см (6.5″)");
    expect(powerBucket(750)).toBe("400–1000 Вт");
  });
});
