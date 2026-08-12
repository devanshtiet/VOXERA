import type { NextRequest } from "next/server";
import { extractAcousticFeatures } from "../../../../lib/audio/acoustic";
import { detectAudioEmotion } from "../../../../lib/emotion/audio-emotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/acoustic/analyze
 *
 * Thin transport wrapping the real acoustic engine (lib/audio/acoustic.ts +
 * lib/emotion/audio-emotion.ts, the same functions used for real telephony
 * calls) — no acoustic inference logic lives here. Body is a raw 8kHz mono
 * linear16 PCM buffer, mirroring /api/stt's binary-body convention.
 *
 * `wordCount` is passed via the `X-Word-Count` header (optional, defaults to
 * 0 — this mode has no transcript, so speakingRateWPM just won't be
 * meaningful; every other feature is unaffected).
 */
export async function POST(request: NextRequest) {
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) {
    return Response.json({ error: "empty audio body" }, { status: 400 });
  }

  const wordCountHeader = request.headers.get("x-word-count");
  const wordCount = wordCountHeader ? parseInt(wordCountHeader, 10) || 0 : 0;

  try {
    const features = extractAcousticFeatures(buf, wordCount);
    const emotion = detectAudioEmotion(features);
    return Response.json({ features, emotion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
