/**
 * Acoustic Emotion Analysis — Maps acoustic features to EmotionSignal.
 *
 * Replaces the previous rigid if/else chain with a scored approach where
 * multiple features contribute weighted scores to each candidate label.
 *
 * Key improvements over v1:
 * - Crying/sobbing detection (high pitch + broken speech + high energy modulation)
 * - Laughter detection (high ZCR + rapid energy modulation + mid-high pitch)
 * - ZCR is now used in label inference (was previously extracted but ignored)
 * - Scored multi-feature inference instead of rigid if/else chain
 * - Raised confidence ceiling to 0.85 for long utterances with clear patterns
 * - Energy modulation rate and pitch contour are used when available
 */

import type { AcousticFeatures, EmotionLabel, EmotionSignal, VAD } from "../types";
import { CONFIG } from "../config";
import { clamp } from "../util/math";
import { classifyConfidence } from "./confidence";

/**
 * Derive an EmotionSignal from physical acoustic features.
 *
 * Confidence scales with audio duration and pattern clarity:
 * - <2s = low confidence (0.30)
 * - 2-5s = medium (0.45–0.65)
 * - 5-8s = high (0.65–0.75)
 * - >8s with clear patterns = very high (up to 0.85)
 */
export function detectAudioEmotion(features: AcousticFeatures): EmotionSignal | null {
  // Minimum meaningful analysis requires at least 500ms of audio
  if (features.durationMs < 500) return null;

  // ─── Normalize features to 0-1 ranges ──────────────────────────────────

  // RMS energy: typical speech 800-6000 for 16-bit, normalize to 0-1
  const energyNorm = clamp(features.rmsEnergy / 5000, 0, 1);

  // Pitch: 70-400Hz range → 0-1
  const pitchNorm = features.pitchHz > 0 ? clamp((features.pitchHz - 70) / 330, 0, 1) : 0.5;

  // Speaking rate: 60-220 WPM → 0-1
  const rateNorm = clamp((features.speakingRateWPM - 60) / 160, 0, 1);

  // Pause ratio: fraction of total duration spent in pauses
  const pauseRatio = features.durationMs > 0
    ? clamp(features.pauseDurationMs / features.durationMs, 0, 1)
    : 0;

  // ZCR: already 0-1 from extraction
  const zcr = features.zeroCrossingRate;

  // Energy modulation: 0-1 (high = rapid amplitude changes like crying/laughter)
  const energyMod = features.energyModulationRate ?? 0;

  // Pitch contour: direction of pitch across the utterance
  const contour = features.pitchContour ?? "flat";

  // ─── VAD computation from acoustic features ────────────────────────────

  // Valence: harder to determine from audio alone. Use rate + pitch variation
  // as weak proxies. Fast + varied = likely positive; slow + monotone = likely negative.
  let valence = 0;
  valence += (features.pitchVariation - 0.3) * 0.6;   // High variation → positive
  valence += (rateNorm - 0.5) * 0.3;                   // Fast → slightly positive
  valence -= pauseRatio * 0.3;                          // Pauses → slightly negative
  // Unstable pitch contour suggests distress
  if (contour === "unstable") valence -= 0.2;
  valence = clamp(valence, -1, 1);

  // Arousal: strongly correlated with energy, pitch, and rate
  let arousal = 0;
  arousal += energyNorm * 0.5;
  arousal += pitchNorm * 0.25;
  arousal += rateNorm * 0.25;
  arousal = clamp(arousal * 2 - 0.5, -1, 1); // Center around 0

  // Dominance: loud + fast = dominant; quiet + slow + pauses = submissive
  let dominance = 0;
  dominance += energyNorm * 0.4;
  dominance += rateNorm * 0.3;
  dominance -= pauseRatio * 0.3;
  dominance = clamp(dominance * 2 - 0.5, -1, 1);

  const vad: VAD = { v: valence, a: arousal, d: dominance };

  // ─── Scored label inference ────────────────────────────────────────────

  const { label, patternStrength } = inferLabelScored({
    energy: energyNorm,
    pitch: pitchNorm,
    pitchVariation: features.pitchVariation,
    rate: rateNorm,
    pauseRatio,
    zcr,
    energyMod,
    contour,
    pauseCount: features.pauseCount,
    vad,
  });

  // ─── Confidence based on audio duration + pattern clarity ──────────────

  const { audioConfidenceCeiling, audioConfidenceCeilingLong } = CONFIG.emotion;
  let confidence: number;
  if (features.durationMs < 2000) {
    confidence = 0.3;  // Very short — low confidence
  } else if (features.durationMs < 5000) {
    confidence = 0.45 + (features.durationMs - 2000) / 15000; // 0.45–0.65
  } else if (features.durationMs < 8000) {
    confidence = Math.min(audioConfidenceCeiling, 0.65 + (features.durationMs - 5000) / 50000);
  } else {
    // Long utterances with clear acoustic patterns get higher confidence
    confidence = Math.min(
      audioConfidenceCeilingLong,
      0.70 + (features.durationMs - 8000) / 100000 + patternStrength * 0.1
    );
  }

  const intensity = clamp(Math.sqrt(vad.v * vad.v + vad.a * vad.a + vad.d * vad.d) / Math.sqrt(3));

  return {
    label,
    intensity,
    confidence,
    confidenceCategory: classifyConfidence(confidence),
    vad,
    source: "audio",
    at: Date.now(),
  };
}

// ─── Scored Label Inference ──────────────────────────────────────────────────

interface NormalizedFeatures {
  energy: number;
  pitch: number;
  pitchVariation: number;
  rate: number;
  pauseRatio: number;
  zcr: number;
  energyMod: number;
  contour: "rising" | "falling" | "flat" | "unstable";
  pauseCount: number;
  vad: VAD;
}

/**
 * Multi-feature scored label inference.
 * Each candidate label accumulates a score based on feature contributions.
 * Returns the highest-scoring label and a pattern strength (0-1) indicating
 * how clear/distinctive the acoustic pattern is.
 */
function inferLabelScored(f: NormalizedFeatures): { label: EmotionLabel; patternStrength: number } {
  const scores: Record<EmotionLabel, number> = {
    neutral: 0,
    anger: 0,
    frustration: 0,
    sadness: 0,
    distress: 0,
    fear: 0,
    confusion: 0,
    joy: 0,
    gratitude: 0,
    excitement: 0,
    disappointment: 0,
  };

  // ── Anger: high energy, high pitch, fast rate, LOW pitch variation (controlled rage)
  if (f.energy > 0.6) scores.anger += 0.3;
  if (f.pitch > 0.5) scores.anger += 0.2;
  if (f.rate > 0.6) scores.anger += 0.2;
  if (f.pitchVariation < 0.25) scores.anger += 0.3; // Monotone loud = angry
  if (f.energy > 0.7 && f.pitchVariation < 0.2) scores.anger += 0.2; // Strong signal

  // ── Excitement: high energy, high pitch, fast rate, HIGH pitch variation
  if (f.energy > 0.5) scores.excitement += 0.2;
  if (f.pitch > 0.5) scores.excitement += 0.15;
  if (f.rate > 0.5) scores.excitement += 0.15;
  if (f.pitchVariation > 0.4) scores.excitement += 0.3;
  if (f.energy > 0.4 && f.pitchVariation > 0.5) scores.excitement += 0.2;

  // ── Sadness: low energy, low pitch, slow rate, low variation, falling contour
  if (f.energy < 0.3) scores.sadness += 0.25;
  if (f.pitch < 0.4) scores.sadness += 0.2;
  if (f.rate < 0.4) scores.sadness += 0.2;
  if (f.pitchVariation < 0.2) scores.sadness += 0.15;
  if (f.contour === "falling") scores.sadness += 0.15;

  // ── Crying/Sobbing → maps to distress (NOT sadness):
  // High pitch + high energy modulation + broken speech (many short pauses) + unstable contour
  if (f.energyMod > 0.5 && f.pitch > 0.4) scores.distress += 0.3;
  if (f.energyMod > 0.4 && f.pauseCount > 2) scores.distress += 0.25;
  if (f.contour === "unstable") scores.distress += 0.2;
  if (f.pitchVariation > 0.4 && f.energy > 0.3 && f.energyMod > 0.3) scores.distress += 0.25;
  // Distinguish from anger: crying has high pitch variation, anger has low
  if (f.energy > 0.5 && f.pitch > 0.5 && f.pitchVariation > 0.35 && f.energyMod > 0.4) scores.distress += 0.2;

  // ── Laughter → maps to joy:
  // Very high ZCR + rapid energy modulation + mid-high pitch + moderate-high energy
  if (f.zcr > 0.3 && f.energyMod > 0.4) scores.joy += 0.3;
  if (f.zcr > 0.35 && f.energy > 0.4 && f.pitch > 0.4) scores.joy += 0.3;
  if (f.energyMod > 0.5 && f.pitchVariation > 0.3 && f.zcr > 0.25) scores.joy += 0.2;

  // ── Frustration: high energy + high pitch but moderate rate
  if (f.energy > 0.5 && f.pitch > 0.5 && f.rate >= 0.3 && f.rate < 0.6) scores.frustration += 0.4;
  if (f.energy > 0.4 && f.pitchVariation > 0.2 && f.pitchVariation < 0.4) scores.frustration += 0.2;

  // ── Confusion: frequent pauses + low energy + hesitation patterns
  if (f.pauseRatio > 0.3 && f.energy < 0.4) scores.confusion += 0.4;
  if (f.pauseRatio > 0.2 && f.rate < 0.4) scores.confusion += 0.2;
  if (f.contour === "rising") scores.confusion += 0.15; // Question intonation

  // ── Fear: moderate energy, high pitch, pauses, rising contour
  if (f.pauseRatio > 0.2 && f.energy > 0.3 && f.energy < 0.5 && f.pitch > 0.5) scores.fear += 0.35;
  if (f.contour === "rising" && f.pitch > 0.6) scores.fear += 0.2;
  if (f.rate > 0.6 && f.pitch > 0.6 && f.energy < 0.5) scores.fear += 0.15;

  // ── Distress (general): high energy + low pitch (deep groaning/distress sounds)
  if (f.energy > 0.5 && f.pitch < 0.3) scores.distress += 0.3;

  // ── Disappointment: low energy, slight falling contour, slow rate
  if (f.energy < 0.35 && f.rate < 0.4 && f.contour === "falling") scores.disappointment += 0.35;
  if (f.pitchVariation < 0.15 && f.energy < 0.3) scores.disappointment += 0.15;

  // ── Neutral: low variation, moderate everything, no strong signals
  if (f.pitchVariation < 0.15 && f.vad.a < 0) scores.neutral += 0.3;
  if (f.energy > 0.2 && f.energy < 0.5 && f.rate > 0.3 && f.rate < 0.6) scores.neutral += 0.2;
  // Neutral gets a base score — it should win when nothing else is strong
  scores.neutral += 0.15;

  // ── Find winner ─────────────────────────────────────────────────────────
  let bestLabel: EmotionLabel = "neutral";
  let bestScore = 0;
  let secondBestScore = 0;

  for (const [lbl, score] of Object.entries(scores) as [EmotionLabel, number][]) {
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestLabel = lbl;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  // Pattern strength: how much the winner stands out from runner-up (0-1)
  const patternStrength = bestScore > 0
    ? clamp((bestScore - secondBestScore) / bestScore, 0, 1)
    : 0;

  return { label: bestLabel, patternStrength };
}
