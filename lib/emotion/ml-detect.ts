import type { EmotionLabel, EmotionSignal, VAD } from "../types";
import { CONFIG } from "../config";
import { clamp } from "../util/math";
import { classifyConfidence } from "./confidence";

/**
 * HuggingFace Remote API — 7-class emotion detection.
 *
 * Uses j-hartmann/emotion-english-distilroberta-base which classifies into:
 * anger, disgust, fear, joy, neutral, sadness, surprise.
 *
 * This function does NOT pre-compute or depend on the lexicon.
 * It runs independently and returns null on timeout/error so the caller
 * can use the lexicon result that was computed in parallel.
 *
 * Strict latency budget controlled by CONFIG.emotion.hfLatencyBudgetMs.
 */

const HF_API_URL = "https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base";

const HF_LABEL_MAP: Record<string, EmotionLabel> = {
  anger: "anger",
  disgust: "frustration",
  fear: "fear",
  joy: "joy",
  neutral: "neutral",
  sadness: "sadness",
  surprise: "excitement",
};

/**
 * Synthetic VAD values for HF-detected emotions.
 * Used when the HF model returns a label that differs from lexicon.
 */
const HF_VAD_MAP: Record<EmotionLabel, VAD> = {
  anger: { v: -0.8, a: 0.8, d: 0.5 },
  frustration: { v: -0.6, a: 0.4, d: 0.2 },
  sadness: { v: -0.7, a: -0.4, d: -0.3 },
  distress: { v: -0.8, a: 0.6, d: -0.4 },
  fear: { v: -0.6, a: 0.7, d: -0.6 },
  confusion: { v: -0.2, a: 0.2, d: -0.2 },
  joy: { v: 0.8, a: 0.5, d: 0.3 },
  gratitude: { v: 0.7, a: 0.2, d: 0.1 },
  excitement: { v: 0.9, a: 0.8, d: 0.5 },
  disappointment: { v: -0.5, a: -0.1, d: -0.2 },
  neutral: { v: 0, a: 0, d: 0 },
};

export interface HFDetectResult {
  signal: EmotionSignal | null;
  latencyMs: number;
  timedOut: boolean;
  rawPredictions?: Array<{ label: string; score: number }>;
}

/**
 * Call the HuggingFace emotion API with a strict timeout covering the
 * entire operation (fetch + body parsing).
 *
 * Returns null signal on timeout, missing token, or error — the caller
 * should use the parallel lexicon result in that case.
 */
export async function detectTextEmotionHF(text: string): Promise<HFDetectResult> {
  const start = performance.now();
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
  const budgetMs = CONFIG.emotion.hfLatencyBudgetMs;

  if (!token || !text.trim()) {
    return { signal: null, latencyMs: performance.now() - start, timedOut: false };
  }

  const controller = new AbortController();
  // Timeout covers the ENTIRE operation: fetch + body parsing + processing
  const timeoutId = setTimeout(() => controller.abort(), budgetMs);

  try {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    });

    if (!res.ok) {
      clearTimeout(timeoutId);
      return { signal: null, latencyMs: performance.now() - start, timedOut: false };
    }

    // JSON parsing is still within the AbortController timeout window
    const data = await res.json();
    clearTimeout(timeoutId);

    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return { signal: null, latencyMs: performance.now() - start, timedOut: false };
    }

    const predictions = data[0] as Array<{ label: string; score: number }>;
    if (predictions.length === 0) {
      return { signal: null, latencyMs: performance.now() - start, timedOut: false };
    }

    predictions.sort((a, b) => b.score - a.score);
    const top = predictions[0];
    const label: EmotionLabel = HF_LABEL_MAP[top.label.toLowerCase()] || "neutral";
    const confidence = clamp(top.score, 0, 1);

    const vad = HF_VAD_MAP[label];
    const scaledVad: VAD = {
      v: vad.v * confidence,
      a: vad.a * confidence,
      d: vad.d * confidence,
    };
    const intensity = clamp(
      Math.sqrt(scaledVad.v * scaledVad.v + scaledVad.a * scaledVad.a + scaledVad.d * scaledVad.d) / Math.sqrt(3)
    );

    const signal: EmotionSignal = {
      label,
      intensity,
      confidence,
      confidenceCategory: classifyConfidence(confidence),
      vad: scaledVad,
      source: "text",
      at: Date.now(),
    };

    return {
      signal,
      latencyMs: performance.now() - start,
      timedOut: false,
      rawPredictions: predictions,
    };
  } catch {
    clearTimeout(timeoutId);
    const elapsed = performance.now() - start;
    // AbortError means timeout; other errors are network/parse failures
    return {
      signal: null,
      latencyMs: elapsed,
      timedOut: elapsed >= budgetMs * 0.9, // If we used >90% of budget, treat as timeout
    };
  }
}
