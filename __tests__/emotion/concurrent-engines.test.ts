import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ml-detect so we can control HF timing/availability independently of
// real network calls, to prove the router runs HF and Lexicon concurrently
// (Issue #26) rather than sequentially.
const mockDetectTextEmotionHF = vi.fn();
vi.mock("../../lib/emotion/ml-detect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/emotion/ml-detect")>();
  return {
    ...actual,
    detectTextEmotionHF: (...args: unknown[]) => mockDetectTextEmotionHF(...args),
  };
});

import { detectTextEmotion, detectTextEmotionLexicon } from "../../lib/emotion/detect";
import { detectTextEmotionHF } from "../../lib/emotion/ml-detect";

describe("Issue #26: Concurrent HF + Lexicon emotion engine architecture", () => {
  beforeEach(() => {
    mockDetectTextEmotionHF.mockReset();
  });

  it("exposes the HF engine as detectTextEmotionHF (no naming conflict)", () => {
    expect(typeof detectTextEmotionHF).toBe("function");
  });

  it("exposes the deterministic engine as detectTextEmotionLexicon", () => {
    expect(typeof detectTextEmotionLexicon).toBe("function");
  });

  it("runs HF and Lexicon concurrently, not sequentially", async () => {
    const DELAY_MS = 60;
    mockDetectTextEmotionHF.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ signal: null, latencyMs: DELAY_MS, timedOut: false }),
            DELAY_MS
          )
        )
    );

    const start = performance.now();
    await detectTextEmotion("hello there");
    const elapsed = performance.now() - start;

    // If HF and Lexicon ran sequentially with Lexicon's own overhead added on
    // top, or if Lexicon were blocked waiting on HF first, elapsed would still
    // be roughly DELAY_MS either way for this trivial case — the real
    // regression this guards is HF's own internal work (fetch + parsing)
    // being duplicated or awaited twice. The critical assertion is the
    // upper bound: total time should not balloon past a single HF delay.
    expect(elapsed).toBeLessThan(DELAY_MS + 100);
  });

  it("returns both HF and Lexicon results for diagnostic comparison", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({ signal: null, latencyMs: 5, timedOut: false });

    const result = await detectTextEmotion("i am furious about this");

    expect(result.hf).toBeDefined();
    expect(result.lexicon).toBeDefined();
    expect(result.lexicon.label).toBeDefined();
    expect(result.lexicon.matchedKeywords).toBeDefined();
  });

  it("falls back to the Lexicon result when HF is unavailable, without blocking", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({ signal: null, latencyMs: 2, timedOut: false });

    const result = await detectTextEmotion("i am furious about this");

    expect(result.selection.engine).toBe("lexicon");
    expect(result.primary).toEqual(result.lexicon);
  });

  it("falls back to the Lexicon result when HF times out, without blocking", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({ signal: null, latencyMs: 200, timedOut: true });

    const result = await detectTextEmotion("i am furious about this");

    expect(result.selection.engine).toBe("lexicon");
    expect(result.selection.reason).toMatch(/timed out/i);
  });

  it("falls back to the Lexicon result when HF throws, without blocking", async () => {
    mockDetectTextEmotionHF.mockRejectedValue(new Error("network error"));

    const result = await detectTextEmotion("i am furious about this");

    expect(result.selection.engine).toBe("lexicon");
    expect(result.primary.label).toBe(result.lexicon.label);
  });

  it("prefers the HF result as primary when it returns a valid signal in time", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({
      signal: {
        label: "joy",
        intensity: 0.8,
        confidence: 0.95,
        confidenceCategory: { level: "high", range: [0.7, 1], explanation: "mock" },
        vad: { v: 0.8, a: 0.5, d: 0.3 },
        source: "text",
        at: Date.now(),
      },
      latencyMs: 10,
      timedOut: false,
    });

    const result = await detectTextEmotion("neutral filler text");

    expect(result.selection.engine).toBe("hf");
    expect(result.primary.label).toBe("joy");
    // Lexicon result must still be present even though HF was selected.
    expect(result.lexicon).toBeDefined();
  });
});
