import { describe, it, expect } from "vitest";
import { getEmotionTTSParams, applyEmotionProsody } from "../../lib/emotion/tts-params";

describe("Emotion TTS Prosody Mapping", () => {
  it("maps distress to slow speed and long pauses", () => {
    const params = getEmotionTTSParams("distress");
    expect(params.speed).toBe(0.75);
    expect(params.pauseStrategy).toBe("long");

    const shaped = applyEmotionProsody("I can help you. Please stay calm.", params);
    expect(shaped).toContain("...");
  });

  it("maps excitement to faster speed and no extra pauses", () => {
    const params = getEmotionTTSParams("excitement");
    expect(params.speed).toBe(1.1);
    expect(params.pauseStrategy).toBe("none");

    const shaped = applyEmotionProsody("That is awesome!", params);
    expect(shaped).toBe("That is awesome!");
  });

  it("defaults to neutral for undefined emotion", () => {
    const params = getEmotionTTSParams(undefined);
    expect(params.speed).toBe(1.0);
    expect(params.pauseStrategy).toBe("none");
  });
});
