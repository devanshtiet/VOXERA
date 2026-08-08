import type { EmotionLabel, EmotionSignal } from "../types";
import { detectTextEmotion } from "./detect";

/**
 * ML-assisted text emotion detection (Hugging Face Inference API / fallback).
 *
 * Uses j-hartmann/emotion-english-distilroberta-base (or similar) when HF token is set.
 * Gracefully falls back to the deterministic detectTextEmotion lexicon detector on error or timeout.
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

export async function detectTextEmotionML(text: string): Promise<EmotionSignal> {
  const fallback = detectTextEmotion(text);
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;

  if (!token || !text.trim()) {
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 200); // 200ms strict timeout for real-time streaming

    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return fallback;
    }

    // High score classification
    const predictions = data[0] as Array<{ label: string; score: number }>;
    if (predictions.length === 0) return fallback;

    predictions.sort((a, b) => b.score - a.score);
    const top = predictions[0];

    const mappedLabel = HF_LABEL_MAP[top.label.toLowerCase()] || fallback.label;
    const confidence = Math.max(top.score, fallback.confidence);

    return {
      ...fallback,
      label: mappedLabel,
      confidence,
      source: "text",
    };
  } catch (err) {
    // Timeout or network error -> use deterministic lexicon
    return fallback;
  }
}
