import { CONFIG } from "../config";
import type { EmotionLabel, PolicyDirectives } from "../types";
import { getDeepgram } from "./client";
import { supabase } from "../db/supabase";
import { synthesizeElevenLabs } from "../tts/voice-clone";
import { applyEmotionProsody, getEmotionTTSParams } from "../emotion/tts-params";
import { isDeepgramModelId } from "./voices";

/**
 * Resolves a `persona` string to a Deepgram TTS model id. Accepts either
 * one of the 4 legacy curated keys (CONFIG.deepgram.voicePersonas, e.g.
 * "female-friendly") for backward compatibility, or a full Deepgram model
 * id directly (e.g. "aura-2-luna-en") as saved by the Agent Builder voice
 * picker — which covers the full ~50-voice catalog without needing a
 * migration or an expanded config map.
 */
function resolveVoiceModel(persona?: string): string {
  if (!persona) return CONFIG.deepgram.ttsModel;
  if (isDeepgramModelId(persona)) return persona;
  const personaConfig = CONFIG.deepgram.voicePersonas[persona as keyof typeof CONFIG.deepgram.voicePersonas];
  return personaConfig?.model || CONFIG.deepgram.ttsModel;
}

// Resolve voice settings for client
async function getClientVoiceSettings(clientId?: string): Promise<{ provider?: string; voiceId?: string } | null> {
  if (!clientId || clientId === "demo") return null;
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("auth_user_id", clientId)
      .single();

    if (!tenant) return null;

    const { data: settings } = await supabase
      .from("business_settings")
      .select("voice_provider, custom_voice_id")
      .eq("tenant_id", tenant.id)
      .single();

    return {
      provider: settings?.voice_provider ?? undefined,
      voiceId: settings?.custom_voice_id ?? undefined,
    };
  } catch (err) {
    console.error("[TTS] Failed to retrieve client voice settings:", err);
    return null;
  }
}

// Deepgram Aura TTS. Returns audio bytes (mp3).
export async function synthesize(text: string, opts?: {
  policy?: PolicyDirectives;
  persona?: string;
  clientId?: string;
  emotion?: EmotionLabel;
}): Promise<Uint8Array> {
  const settings = await getClientVoiceSettings(opts?.clientId);
  
  // If ElevenLabs is configured for custom voice, handle it
  if (settings?.provider === "elevenlabs" && settings.voiceId) {
    try {
      const pcm = await synthesizeElevenLabs(text, settings.voiceId);
      return new Uint8Array(pcm);
    } catch (err) {
      console.warn("[TTS] ElevenLabs synthesis failed, falling back to Deepgram:", err);
    }
  }

  const dg = getDeepgram();
  const emotionParams = getEmotionTTSParams(opts?.emotion);
  let shaped = applyEmotionProsody(text, emotionParams);
  if (opts?.policy) {
    shaped = applyProsody(shaped, opts.policy);
  }

  const model = resolveVoiceModel(opts?.persona);

  const MAX_TTS_RETRIES = 2;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_TTS_RETRIES; attempt++) {
    try {
      const binary = await dg.speak.v1.audio.generate({
        text: shaped,
        model: model,
        encoding: "mp3",
      });
      const buf = await binary.arrayBuffer();
      return new Uint8Array(buf);
    } catch (err: any) {
      lastErr = err;
      if (attempt < MAX_TTS_RETRIES) {
        const backoff = (attempt + 1) * 500;
        console.warn(`[TTS] Attempt ${attempt + 1} failed: ${err.message ?? err}. Retrying in ${backoff}ms...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastErr;
}

/**
 * Synthesizes speech as raw linear16 PCM at 8kHz — ready for Twilio mulaw encoding.
 */
export async function synthesizeLinear16(text: string, opts?: {
  policy?: PolicyDirectives;
  persona?: string;
  clientId?: string;
  emotion?: EmotionLabel;
}): Promise<Buffer> {
  const settings = await getClientVoiceSettings(opts?.clientId);

  if (settings?.provider === "elevenlabs" && settings.voiceId) {
    try {
      return await synthesizeElevenLabs(text, settings.voiceId);
    } catch (err) {
      console.warn("[TTS] ElevenLabs synthesis failed, falling back to Deepgram:", err);
    }
  }

  const dg = getDeepgram();
  const emotionParams = getEmotionTTSParams(opts?.emotion);
  let shaped = applyEmotionProsody(text, emotionParams);
  if (opts?.policy) {
    shaped = applyProsody(shaped, opts.policy);
  }

  const model = resolveVoiceModel(opts?.persona);

  const binary = await dg.speak.v1.audio.generate({
    text: shaped,
    model: model,
    encoding: "linear16",
    sample_rate: 8000,
    container: "none",
  });
  const buf = await binary.arrayBuffer();
  return Buffer.from(buf);
}

// Light prosody adaptation: under slow pacing, insert subtle pauses and keep sentences short.
function applyProsody(text: string, policy?: PolicyDirectives): string {
  if (!policy || policy.pace !== "slow") return text;
  return text.replace(/([\.!?])\s+/g, "$1  ");
}
