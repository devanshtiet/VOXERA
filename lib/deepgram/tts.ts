import { CONFIG } from "../config";
import type { PolicyDirectives } from "../types";
import { getDeepgram } from "./client";

// Deepgram Aura TTS. Returns audio bytes (mp3).
// For low-latency voice agents, stream with client.speak.v1.connect (WebSocket)
// — this REST path is fine for non-streaming replies and demos.
export async function synthesize(text: string, opts?: {
  policy?: PolicyDirectives;
}): Promise<Uint8Array> {
  const dg = getDeepgram();
  const shaped = applyProsody(text, opts?.policy);
  const binary = await dg.speak.v1.audio.generate({
    text: shaped,
    model: CONFIG.deepgram.ttsModel,
    encoding: "mp3",
  });
  const buf = await binary.arrayBuffer();
  return new Uint8Array(buf);
}

// Light prosody adaptation: under slow pacing, insert subtle pauses and
// keep sentences short. Deepgram Aura does not accept SSML, so we rely on
// punctuation and pacing cues that the model respects.
function applyProsody(text: string, policy?: PolicyDirectives): string {
  if (!policy || policy.pace !== "slow") return text;
  return text.replace(/([\.!?])\s+/g, "$1  ");
}
