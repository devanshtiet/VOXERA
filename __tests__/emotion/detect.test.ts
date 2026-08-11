import { describe, it, expect } from "vitest";
import { detectTextEmotion, fuseEmotion } from "../../lib/emotion/detect";

describe("Emotion Detection Lexicon & Calibration Suite (Issue #23)", () => {
  describe("Colloquial Contractions (Issue #23)", () => {
    it("matches feeling low variants", async () => {
      const res = await detectTextEmotion("i m feelin low");
      expect(res.label).toBe("sadness");
      expect(res.confidence).toBeGreaterThan(0);
      expect(res.confidenceCategory?.level).toBeDefined();
    });

    it("matches feeling low with apostrophe", async () => {
      const res = await detectTextEmotion("feelin' low");
      expect(res.label).toBe("sadness");
    });

    it("matches explicit feeling low", async () => {
      const res = await detectTextEmotion("feeling low");
      expect(res.label).toBe("sadness");
    });

    it("matches feel low", async () => {
      const res = await detectTextEmotion("feel low");
      expect(res.label).toBe("sadness");
    });

    it("matches frustration contractions", async () => {
      const res = await detectTextEmotion("costin me money");
      expect(res.label).toBe("frustration");
    });

    it("matches distress contractions", async () => {
      const res = await detectTextEmotion("breakin' down");
      expect(res.label).toBe("distress");
    });
  });

  describe("Safety Nets", () => {
    it("defaults to neutral for normal inputs", async () => {
      const res = await detectTextEmotion("this is a completely normal day");
      expect(res.label).toBe("neutral");
      expect(res.confidence).toBe(0.5);
      expect(res.confidenceCategory?.level).toBe("medium");
    });

    it("preserves positive excitement without regression", async () => {
      const res = await detectTextEmotion("this is absolutely amazing!!!");
      expect(res.label).toBe("excitement");
      expect(res.confidence).toBeGreaterThan(0.5);
    });

    it("preserves gratitude correctly", async () => {
      const res = await detectTextEmotion("thank you so much for the support");
      expect(res.label).toBe("gratitude");
    });
  });

  describe("Late Fusion (fuseEmotion)", () => {
    it("blends audio and text confidences correctly", async () => {
      const textSig = await detectTextEmotion("i am angry");
      const audioSig = {
        label: "sadness" as any,
        intensity: 0.5,
        confidence: 1, // Max confidence to overpower ML text
        confidenceCategory: { level: "high", range: [0.7, 1], explanation: "Mock" } as ConfidenceCategory,
        vad: { v: -0.6, a: -0.2, d: -0.3 },
        source: "audio" as const,
        at: Date.now(),
      };

      const fused = fuseEmotion(textSig, audioSig);
      expect(fused.source).toBe("fused");
      expect(fused.label).toBe("sadness"); // Takes label from higher confidence source (audio 0.8 > text 0.57)
    });
  });
});
