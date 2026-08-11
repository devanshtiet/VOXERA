import type { EmotionLabel, EmotionSignal, VAD } from "../types";
import { CONFIG } from "../config";
import { clamp } from "../util/math";
import { classifyConfidence } from "./confidence";
import { LEXICON } from "./lexicon";
import { detectTextEmotionHF, type HFDetectResult } from "./ml-detect";

import MLClassifier from "./classifier";

// ─── Lexicon Engine ──────────────────────────────────────────────────────────

/**
 * Deterministic text emotion detector using keyword lexicon + punctuation cues.
 * Always returns synchronously (zero-latency).
 * Returns a calibrated EmotionSignal.
 */
export function detectTextEmotionLexicon(text: string): EmotionSignal & { matchedKeywords: string[] } {
  const labelScores: Partial<Record<EmotionLabel, number>> = {};
  const vadAcc: VAD = { v: 0, a: 0, d: 0 };
  let totalW = 0;
  const matchedKeywords: string[] = [];

  const negLabels = new Set<EmotionLabel>(["frustration", "anger", "distress", "sadness", "fear", "disappointment"]);
  const posLabels = new Set<EmotionLabel>(["joy", "gratitude", "excitement"]);
  let hasNegMatch = false;
  let hasPosMatch = false;

  for (const entry of LEXICON) {
    const matches = text.match(entry.kw);
    if (!matches) continue;
    const w = entry.w * matches.length;
    labelScores[entry.label] = (labelScores[entry.label] ?? 0) + w;
    vadAcc.v += entry.vad.v * w;
    vadAcc.a += entry.vad.a * w;
    vadAcc.d += entry.vad.d * w;
    totalW += w;
    matchedKeywords.push(...matches);
    if (negLabels.has(entry.label)) hasNegMatch = true;
    if (posLabels.has(entry.label)) hasPosMatch = true;
  }

  // Context-aware punctuation: !! and ??? boost arousal in the direction
  // of the already-detected valence, instead of blindly assuming frustration.
  const exclamCount = (text.match(/!{2,}/g) || []).length;
  const questionCount = (text.match(/\?{2,}/g) || []).length;
  if (exclamCount > 0) {
    const arousalBoost = 0.3 * exclamCount;
    vadAcc.a += arousalBoost;
    // If no negative keywords matched, treat !! as positive intensity amplifier
    if (!hasNegMatch) {
      vadAcc.v += 0.2 * exclamCount;
      labelScores["excitement"] = (labelScores["excitement"] ?? 0) + 0.4 * exclamCount;
    }
    totalW += arousalBoost;
  }
  if (questionCount > 0) {
    vadAcc.a += 0.1 * questionCount;
    labelScores["confusion"] = (labelScores["confusion"] ?? 0) + 0.3 * questionCount;
    totalW += 0.1 * questionCount;
  }

  // Caps boost arousal.
  const letters = text.replace(/[^A-Za-z]/g, "");
  const capsRatio = letters.length > 0 ? (text.match(/[A-Z]/g)?.length ?? 0) / letters.length : 0;
  if (capsRatio > 0.5 && letters.length > 6) {
    vadAcc.a += 0.4;
    totalW += 0.4;
  }

  let label: EmotionLabel = "neutral";
  let topScore = 0;
  for (const [k, v] of Object.entries(labelScores)) {
    if ((v ?? 0) > topScore) {
      topScore = v ?? 0;
      label = k as EmotionLabel;
    }
  }

  const vad: VAD =
    totalW === 0
      ? { v: 0, a: 0, d: 0 }
      : { v: clamp(vadAcc.v / totalW, -1, 1), a: clamp(vadAcc.a / totalW, -1, 1), d: clamp(vadAcc.d / totalW, -1, 1) };

  // Positivity safety net: if accumulated valence is clearly positive and arousal
  // is high, but the label ended up negative (e.g. due to thin lexicon overlap),
  // correct the label to excitement.
  if (vad.v > 0.2 && vad.a > 0.3 && negLabels.has(label) && hasPosMatch) {
    label = "excitement";
  }

  const intensity = clamp(Math.sqrt(vad.v * vad.v + vad.a * vad.a + vad.d * vad.d) / Math.sqrt(3));
  const confidence = clamp(totalW === 0 ? 0.5 : Math.min(1, 0.45 + 0.15 * totalW));

  // Mixed emotions safety net: if both positive and negative strong keywords hit,
  // we flag it as mixed so the persona engine can adapt and not just blindly celebrate.
  const isMixed = hasNegMatch && hasPosMatch;

  return {
    label,
    intensity,
    confidence,
    confidenceCategory: classifyConfidence(confidence),
    vad,
    source: "text",
    at: Date.now(),
    isMixed,
    matchedKeywords,
  };
}

// ─── Local ML Engine (SST-2 Sentiment — binary POSITIVE/NEGATIVE) ───────────

/**
 * Local ML classification using @xenova/transformers with DistilBERT-SST2.
 * NOTE: This is a 2-class sentiment model (POSITIVE/NEGATIVE), NOT a
 * multi-class emotion model. It can validate sentiment direction but cannot
 * distinguish between specific emotions (anger vs sadness vs fear).
 *
 * Used as a secondary check to validate lexicon direction, not as a primary
 * emotion classifier.
 */
export async function detectTextEmotionLocal(text: string): Promise<EmotionSignal> {
  const classifier = await MLClassifier.getInstance();

  // Predict POSITIVE/NEGATIVE using Deep Learning
  const results = await classifier(text) as { label: string; score: number }[];
  const sentiment = results[0]; // e.g., { label: "POSITIVE", score: 0.99 }

  // Get specific emotional nuance from lexicon
  const lexSignal = detectTextEmotionLexicon(text);

  // Hybrid Fusion Logic
  let label: EmotionLabel = lexSignal.label;
  let isOverride = false;

  // Only override neutral if ML is incredibly confident it's NEGATIVE
  if (lexSignal.label === "neutral" && lexSignal.confidence <= 0.5) {
    if (sentiment.score > 0.98 && sentiment.label === "NEGATIVE") {
      label = "frustration";
      isOverride = true;
    }
  } else {
    // If Lexicon found something, ensure it matches ML sentiment direction!
    const negativeLabels = ["anger", "frustration", "sadness", "distress", "fear", "disappointment"];
    const positiveLabels = ["joy", "gratitude", "excitement"];

    if (sentiment.label === "POSITIVE" && negativeLabels.includes(lexSignal.label) && sentiment.score > 0.9) {
      label = "joy";
      isOverride = true;
    } else if (sentiment.label === "NEGATIVE" && positiveLabels.includes(lexSignal.label) && sentiment.score > 0.9) {
      label = "frustration";
      isOverride = true;
    }
  }

  // Synthetic VAD map for when ML overrides the Lexicon
  const syntheticVadMap: Record<EmotionLabel, VAD> = {
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
    neutral: { v: 0, a: 0, d: 0 }
  };

  let vad = lexSignal.vad;
  let intensity = lexSignal.intensity;

  if (isOverride) {
    // Inject synthetic VAD scaled by ML confidence
    const base = syntheticVadMap[label];
    vad = {
      v: base.v * sentiment.score,
      a: base.a * sentiment.score,
      d: base.d * sentiment.score
    };
    intensity = clamp(Math.sqrt(vad.v*vad.v + vad.a*vad.a + vad.d*vad.d) / Math.sqrt(3));
  } else {
    // Boost Lexicon intensity by ML agreement
    intensity = clamp(lexSignal.intensity * (sentiment.score + 0.5));
  }

  // Probabilistic OR for confidence: 1 - (1 - P_lex) * (1 - P_ml)
  let confidence = clamp(1 - (1 - lexSignal.confidence) * (1 - sentiment.score));

  if (label === "neutral") {
    confidence = 0.5;
    intensity = 0;
    vad = { v: 0, a: 0, d: 0 };
  }

  return {
    label,
    intensity,
    confidence,
    confidenceCategory: classifyConfidence(confidence),
    vad,
    source: "text",
    at: Date.now(),
    isMixed: false,
  };
}

// ─── Concurrent Universal Router ────────────────────────────────────────────

/**
 * Result from the concurrent text emotion detection pipeline.
 * Exposes both individual engine results for diagnostics.
 */
export interface TextEmotionResult {
  /** The selected primary signal used for downstream processing. */
  primary: EmotionSignal;
  /** Lexicon engine result (always available, zero-latency). */
  lexicon: EmotionSignal & { matchedKeywords: string[] };
  /** HuggingFace engine result (null if timed out or unavailable). */
  hf: HFDetectResult;
  /** Which engine was selected as primary and why. */
  selection: { engine: "hf" | "lexicon"; reason: string };
}

/**
 * Universal text emotion router. Runs HF and Lexicon CONCURRENTLY.
 *
 * Design:
 *   HF ─────────→ result (races against latency budget)
 *   Lexicon ────→ result (instant, always ready)
 *
 * If HF finishes within the latency budget and returns a valid signal,
 * it's used as the primary candidate. Otherwise, lexicon is immediately used.
 *
 * Both results are always returned for diagnostic comparison.
 */
export async function detectTextEmotion(text: string): Promise<TextEmotionResult> {
  // Run HF and Lexicon concurrently — lexicon is synchronous but wrapped
  // in Promise.allSettled for uniform handling
  const [hfSettled, lexiconResult] = await Promise.all([
    detectTextEmotionHF(text).catch((err): HFDetectResult => {
      console.warn("[EmotionRouter] HF detection threw:", err);
      return { signal: null, latencyMs: 0, timedOut: false };
    }),
    Promise.resolve(detectTextEmotionLexicon(text)),
  ]);

  const hfResult = hfSettled;

  // Selection logic: HF wins if it returned a valid signal within budget
  if (hfResult.signal && !hfResult.timedOut) {
    return {
      primary: hfResult.signal,
      lexicon: lexiconResult,
      hf: hfResult,
      selection: {
        engine: "hf",
        reason: `HF returned in ${hfResult.latencyMs.toFixed(1)}ms with label=${hfResult.signal.label} conf=${hfResult.signal.confidence.toFixed(3)}`,
      },
    };
  }

  // Fallback: use lexicon
  const reason = hfResult.timedOut
    ? `HF timed out after ${hfResult.latencyMs.toFixed(1)}ms, using lexicon fallback`
    : hfResult.signal === null
      ? "HF unavailable (no token or error), using lexicon"
      : "HF returned no signal, using lexicon";

  return {
    primary: lexiconResult,
    lexicon: lexiconResult,
    hf: hfResult,
    selection: { engine: "lexicon", reason },
  };
}

// ─── Emotion Fusion ─────────────────────────────────────────────────────────

/**
 * Late fusion per §3.1: confidence-weighted mix of VAD and label distributions
 * between text and audio emotion signals.
 *
 * Improvements over original:
 * - Minimum confidence threshold: if both < fusionMinConfidence, return neutral
 * - Confidence margin: winner must have at least fusionConfidenceMargin higher
 *   confidence than loser, otherwise text wins (tie-breaking toward semantic)
 * - Preserves isMixed flag from text signal
 * - Attaches individual signals for diagnostics
 */
export function fuseEmotion(
  text: EmotionSignal,
  audio: EmotionSignal | null
): EmotionSignal & { textSignal?: EmotionSignal; audioSignal?: EmotionSignal | null } {
  if (!audio) {
    return { ...text, source: "fused", textSignal: text, audioSignal: null };
  }

  const wa = audio.confidence;
  const wt = text.confidence;
  const sum = wa + wt || 1;

  // Confidence-weighted VAD blending
  const vad: VAD = {
    v: (audio.vad.v * wa + text.vad.v * wt) / sum,
    a: (audio.vad.a * wa + text.vad.a * wt) / sum,
    d: (audio.vad.d * wa + text.vad.d * wt) / sum,
  };

  const { fusionConfidenceMargin, fusionMinConfidence } = CONFIG.emotion;

  // If both engines have very low confidence, default to neutral
  if (text.confidence < fusionMinConfidence && audio.confidence < fusionMinConfidence) {
    return {
      label: "neutral",
      intensity: 0,
      confidence: Math.max(text.confidence, audio.confidence),
      confidenceCategory: classifyConfidence(Math.max(text.confidence, audio.confidence)),
      vad: { v: 0, a: 0, d: 0 },
      source: "fused",
      at: Date.now(),
      textSignal: text,
      audioSignal: audio,
    };
  }

  // Label selection: require a meaningful confidence margin to override
  let label: EmotionLabel;
  if (audio.confidence > text.confidence + fusionConfidenceMargin) {
    label = audio.label;
  } else if (text.confidence > audio.confidence + fusionConfidenceMargin) {
    label = text.label;
  } else {
    // Within margin: prefer text (semantic meaning is generally more reliable)
    label = text.label;
  }

  const intensity = clamp(Math.sqrt(vad.v * vad.v + vad.a * vad.a + vad.d * vad.d) / Math.sqrt(3));
  const confidence = clamp((audio.confidence + text.confidence) / 2 + 0.05);

  return {
    label,
    intensity,
    confidence,
    confidenceCategory: classifyConfidence(confidence),
    vad,
    source: "fused",
    at: Date.now(),
    isMixed: text.isMixed,
    textSignal: text,
    audioSignal: audio,
  };
}
