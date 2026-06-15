import type { EmotionLabel, EmotionSignal, VAD } from "../types";
import { clamp } from "../util/math";
import { classifyConfidence } from "./confidence";
import { LEXICON } from "./lexicon";

// Text emotion detector. Lexicon + caps/punctuation cues.
// Returns a calibrated EmotionSignal. Acts as the RoBERTa stub in §3.1.
export function detectTextEmotion(text: string): EmotionSignal {
  const labelScores: Partial<Record<EmotionLabel, number>> = {};
  const vadAcc: VAD = { v: 0, a: 0, d: 0 };
  let totalW = 0;

  for (const entry of LEXICON) {
    const matches = text.match(entry.kw);
    if (!matches) continue;
    const w = entry.w * matches.length;
    labelScores[entry.label] = (labelScores[entry.label] ?? 0) + w;
    vadAcc.v += entry.vad.v * w;
    vadAcc.a += entry.vad.a * w;
    vadAcc.d += entry.vad.d * w;
    totalW += w;
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

  const intensity = clamp(Math.sqrt(vad.v * vad.v + vad.a * vad.a + vad.d * vad.d) / Math.sqrt(3));
  const confidence = clamp(totalW === 0 ? 0.5 : Math.min(1, 0.45 + 0.15 * totalW));

  return {
    label,
    intensity,
    confidence,
    confidenceCategory: classifyConfidence(confidence),
    vad,
    source: "text",
    at: Date.now(),
  };
}

// Stub for audio emotion (Wav2Vec2 head). In production, replace with a real
// model call; the rest of the pipeline is indifferent to where the VAD came from.
export function detectAudioEmotionStub(_audioMeta: { durationMs?: number; rmsDb?: number }): EmotionSignal | null {
  return null;
}

// Late fusion per §3.1: confidence-weighted mix of VAD and label distributions.
export function fuseEmotion(text: EmotionSignal, audio: EmotionSignal | null): EmotionSignal {
  if (!audio) return { ...text, source: "fused" };
  const wa = audio.confidence;
  const wt = text.confidence;
  const sum = wa + wt || 1;
  const vad: VAD = {
    v: (audio.vad.v * wa + text.vad.v * wt) / sum,
    a: (audio.vad.a * wa + text.vad.a * wt) / sum,
    d: (audio.vad.d * wa + text.vad.d * wt) / sum,
  };
  const label = audio.confidence > text.confidence ? audio.label : text.label;
  const intensity = clamp(Math.sqrt(vad.v * vad.v + vad.a * vad.a + vad.d * vad.d) / Math.sqrt(3));
  const confidence = clamp((audio.confidence + text.confidence) / 2 + 0.05);
  return { label, intensity, confidence, confidenceCategory: classifyConfidence(confidence), vad, source: "fused", at: Date.now() };
}
