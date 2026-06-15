import { CONFIG } from "../config";
import { getDeepgram } from "./client";

export interface STTResult {
  transcript: string;
  confidence: number;
  languageDetected?: string;
}

// One-shot REST STT. Accepts a raw audio buffer (e.g. webm/opus from the browser).
// For low-latency telephony, swap this for the WebSocket streaming client
// (client.listen.v1.connect) — the orchestrator already accepts a plain transcript
// plus confidence, so streaming is a drop-in replacement for this function.
export async function transcribeBuffer(
  audio: Uint8Array,
  opts?: { language?: string; mimetype?: string },
): Promise<STTResult> {
  const dg = getDeepgram();
  const body = await dg.listen.v1.media.transcribeFile(audio, {
    model: CONFIG.deepgram.sttModel,
    language: opts?.language ?? CONFIG.deepgram.language,
    smart_format: true,
    punctuate: true,
    detect_language: !opts?.language,
    sentiment: false,
  });
  if (!("results" in body) || !body.results) {
    return { transcript: "", confidence: 0 };
  }
  const channels = body.results.channels ?? [];
  const alt = channels[0]?.alternatives?.[0];
  return {
    transcript: alt?.transcript?.trim() ?? "",
    confidence: alt?.confidence ?? 0,
    languageDetected: channels[0]?.detected_language,
  };
}
