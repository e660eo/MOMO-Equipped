import { describe, expect, it } from "vitest";
import {
  compatibleVehicleSlots,
  detectSpeakerMount,
  slotMatchesMount,
  VEHICLE_FITMENTS,
} from "./vehicle-fitment";

describe("vehicle speaker fitment", () => {
  it("detects common round, oval and horn formats", () => {
    expect(detectSpeakerMount("Динамики MOMO HE-715 16см", 165)).toMatchObject({
      kind: "round",
      diameterMm: 165,
      label: "16,5 см",
    });
    expect(detectSpeakerMount("Динамики коаксиальные овалы SBS-690")).toMatchObject({
      kind: "oval-6x9",
    });
    expect(detectSpeakerMount("Динамики рупорные HE-290", 100)).toMatchObject({
      kind: "horn",
    });
  });

  it("treats 16, 16.5 and 17 cm as the same mounting class", () => {
    const vesta = VEHICLE_FITMENTS.find((vehicle) => vehicle.id === "lada-vesta");
    const front = vesta?.slots.find((slot) => slot.location === "передние двери");
    expect(front).toBeDefined();
    expect(slotMatchesMount(front!, detectSpeakerMount("Динамик 16 см", 160))).toBe(true);
    expect(slotMatchesMount(front!, detectSpeakerMount("Динамик 13 см", 130))).toBe(false);
  });

  it("returns both direct and adapter-based compatible vehicles", () => {
    const matches = compatibleVehicleSlots(detectSpeakerMount("Динамик 13 см", 130));
    expect(matches.some(({ vehicle, slot }) => vehicle.id === "lada-largus" && slot.method === "direct")).toBe(true);
    expect(matches.some(({ vehicle, slot }) => vehicle.id === "lada-vesta" && slot.method === "adapter")).toBe(true);
  });
});

