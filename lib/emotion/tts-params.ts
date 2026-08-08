import type { EmotionLabel } from "../types";

export interface TTSProsodyParams {
  speed: number; // Deepgram Aura / TTS speed factor (e.g. 0.75 - 1.1)
  pauseStrategy: "none" | "subtle" | "long";
  pitchHint: "low" | "neutral" | "high";
}

const PROSODY_MAP: Record<EmotionLabel, TTSProsodyParams> = {
  anger: {
    speed: 0.85,
    pauseStrategy: "subtle",
    pitchHint: "low",
  },
  frustration: {
    speed: 0.9,
    pauseStrategy: "none",
    pitchHint: "neutral",
  },
  distress: {
    speed: 0.75,
    pauseStrategy: "long",
    pitchHint: "low",
  },
  sadness: {
    speed: 0.8,
    pauseStrategy: "subtle",
    pitchHint: "low",
  },
  fear: {
    speed: 0.85,
    pauseStrategy: "none",
    pitchHint: "neutral",
  },
  confusion: {
    speed: 0.85,
    pauseStrategy: "subtle",
    pitchHint: "neutral",
  },
  joy: {
    speed: 1.05,
    pauseStrategy: "none",
    pitchHint: "high",
  },
  excitement: {
    speed: 1.1,
    pauseStrategy: "none",
    pitchHint: "high",
  },
  gratitude: {
    speed: 0.95,
    pauseStrategy: "none",
    pitchHint: "neutral",
  },
  disappointment: {
    speed: 0.85,
    pauseStrategy: "subtle",
    pitchHint: "neutral",
  },
  neutral: {
    speed: 1.0,
    pauseStrategy: "none",
    pitchHint: "neutral",
  },
};

export function getEmotionTTSParams(emotion?: EmotionLabel): TTSProsodyParams {
  if (!emotion) return PROSODY_MAP.neutral;
  return PROSODY_MAP[emotion] ?? PROSODY_MAP.neutral;
}

export function applyEmotionProsody(text: string, params: TTSProsodyParams): string {
  if (params.pauseStrategy === "long") {
    // Insert double spacing / pause breaks after punctuation for slow, comforting pacing
    return text.replace(/([\.!?])\s+/g, "$1  ... ");
  }
  if (params.pauseStrategy === "subtle") {
    return text.replace(/([\.!?])\s+/g, "$1  ");
  }
  return text;
}
