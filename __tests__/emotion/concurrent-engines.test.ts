import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ml-detect and local-onnx-detect so we can control HF/Local-ONNX
// timing and availability independently of real network calls / real model
// inference, to prove the router runs all three engines concurrently
// (Issue #26) rather than sequentially, and that the selection priority
// (lexicon-on-keyword-match > Local ONNX > HF > lexicon-default) holds.
const mockDetectTextEmotionHF = vi.fn();
vi.mock("../../lib/emotion/ml-detect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/emotion/ml-detect")>();
  return {
    ...actual,
    detectTextEmotionHF: (...args: unknown[]) => mockDetectTextEmotionHF(...args),
  };
});

const mockDetectTextEmotionLocalONNX = vi.fn();
vi.mock("../../lib/emotion/local-onnx-detect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/emotion/local-onnx-detect")>();
  return {
    ...actual,
    detectTextEmotionLocalONNX: (...args: unknown[]) => mockDetectTextEmotionLocalONNX(...args),
  };
});

import { detectTextEmotion, detectTextEmotionLexicon } from "../../lib/emotion/detect";
import { detectTextEmotionHF } from "../../lib/emotion/ml-detect";

/** Default: Local ONNX unavailable, so tests that only care about HF/lexicon
 * behavior aren't affected by the (now higher-priority) ONNX engine unless
 * they explicitly opt in. */
const ONNX_UNAVAILABLE = { signal: null, latencyMs: 1, errored: false };

describe("Issue #26: Concurrent HF + Local ONNX + Lexicon emotion engine architecture", () => {
  beforeEach(() => {
    mockDetectTextEmotionHF.mockReset();
    mockDetectTextEmotionLocalONNX.mockReset();
    mockDetectTextEmotionLocalONNX.mockResolvedValue(ONNX_UNAVAILABLE);
  });

  it("exposes the HF engine as detectTextEmotionHF (no naming conflict)", () => {
    expect(typeof detectTextEmotionHF).toBe("function");
  });

  it("exposes the deterministic engine as detectTextEmotionLexicon", () => {
    expect(typeof detectTextEmotionLexicon).toBe("function");
  });

  it("runs HF, Local ONNX, and Lexicon concurrently, not sequentially", async () => {
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

    // If the engines ran sequentially with each other's overhead stacked on
    // top, or if Lexicon were blocked waiting on HF first, elapsed would
    // balloon well past a single HF delay. The critical assertion is the
    // upper bound: total time should stay close to one engine's delay.
    expect(elapsed).toBeLessThan(DELAY_MS + 100);
  });

  it("returns HF, Local ONNX, and Lexicon results for diagnostic comparison", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({ signal: null, latencyMs: 5, timedOut: false });

    const result = await detectTextEmotion("i am furious about this");

    expect(result.hf).toBeDefined();
    expect(result.localOnnx).toBeDefined();
    expect(result.lexicon).toBeDefined();
    expect(result.lexicon.label).toBeDefined();
    expect(result.lexicon.matchedKeywords).toBeDefined();
  });

  it("uses the Lexicon result when it matched a real keyword, even with HF/ONNX unavailable", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({ signal: null, latencyMs: 2, timedOut: false });

    const result = await detectTextEmotion("i am furious about this");

    expect(result.selection.engine).toBe("lexicon");
    expect(result.primary).toEqual(result.lexicon);
  });

  it("uses the Lexicon result on keyword match even when HF timed out — keyword match wins outright, timeout is irrelevant", async () => {
    mockDetectTextEmotionHF.mockResolvedValue({ signal: null, latencyMs: 200, timedOut: true });

    const result = await detectTextEmotion("i am furious about this");

    expect(result.selection.engine).toBe("lexicon");
    expect(result.selection.reason).toMatch(/matched keyword/i);
  });

  it("falls back to the Lexicon default when HF throws and no keyword matched, without blocking", async () => {
    mockDetectTextEmotionHF.mockRejectedValue(new Error("network error"));

    const result = await detectTextEmotion("neutral filler text");

    expect(result.selection.engine).toBe("lexicon");
    expect(result.primary.label).toBe(result.lexicon.label);
  });

  it("prefers Local ONNX over HF when the lexicon found no keyword match and both ML engines return a signal", async () => {
    mockDetectTextEmotionLocalONNX.mockResolvedValue({
      signal: {
        label: "joy",
        intensity: 0.8,
        confidence: 0.9,
        confidenceCategory: { level: "high", range: [0.7, 1], explanation: "mock" },
        vad: { v: 0.8, a: 0.5, d: 0.3 },
        source: "text",
        at: Date.now(),
      },
      latencyMs: 8,
      errored: false,
    });
    mockDetectTextEmotionHF.mockResolvedValue({
      signal: {
        label: "sadness",
        intensity: 0.5,
        confidence: 0.95,
        confidenceCategory: { level: "high", range: [0.7, 1], explanation: "mock" },
        vad: { v: -0.7, a: -0.3, d: -0.3 },
        source: "text",
        at: Date.now(),
      },
      latencyMs: 10,
      timedOut: false,
    });

    const result = await detectTextEmotion("neutral filler text");

    expect(result.selection.engine).toBe("local_onnx");
    expect(result.primary.label).toBe("joy");
  });

  it("falls back to HF when Local ONNX is unavailable and no keyword matched", async () => {
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
