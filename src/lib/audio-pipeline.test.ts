import { describe, expect, it } from "vitest";
import { AudioError, validateProductAudio } from "./audio-pipeline";

describe("product audio validation", () => {
  it("accepts supported audio formats", () => {
    const file = new File([new Uint8Array(2_048)], "recording.mp3", { type: "audio/mpeg" });
    expect(validateProductAudio(file)).toBe(".mp3");
  });

  it("rejects disguised and empty files", () => {
    const image = new File([new Uint8Array(2_048)], "recording.mp3", { type: "image/jpeg" });
    const empty = new File([new Uint8Array(10)], "recording.wav", { type: "audio/wav" });
    expect(() => validateProductAudio(image)).toThrow(AudioError);
    expect(() => validateProductAudio(empty)).toThrow(AudioError);
  });
});
