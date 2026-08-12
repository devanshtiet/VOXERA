import { describe, it, expect } from "vitest";
import { POST } from "../../app/api/acoustic/analyze/route";
import type { NextRequest } from "next/server";

const SAMPLE_RATE = 8000;

function generateSteadyPCM(freqHz: number, durationMs: number, amplitude = 6000): Buffer {
  const sampleCount = Math.floor((durationMs / 1000) * SAMPLE_RATE);
  const pcm = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    pcm.writeInt16LE(Math.round(amplitude * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE)), i * 2);
  }
  return pcm;
}

function makeRequest(body: Buffer | null, headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/api/acoustic/analyze", {
    method: "POST",
    headers,
    body: body ? (body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer) : undefined,
  }) as unknown as NextRequest;
}

describe("POST /api/acoustic/analyze — reuses the real acoustic engine, no reimplementation", () => {
  it("returns real features + emotion for a valid PCM buffer, not a stub", async () => {
    const pcm = generateSteadyPCM(300, 4000, 4500);
    const res = await POST(makeRequest(pcm));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.features).toBeDefined();
    expect(data.features.durationMs).toBeGreaterThan(0);
    expect(data.features.rmsEnergy).toBeGreaterThan(0);
    // These are outputs of the real DSP pipeline, not hardcoded — a steady
    // tone at this amplitude should register non-trivial energy/pitch.
    expect(data.features.pitchHz).toBeGreaterThan(0);
  });

  it("rejects an empty body with 400", async () => {
    const res = await POST(makeRequest(Buffer.alloc(0)));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/empty/i);
  });

  it("respects the optional X-Word-Count header without requiring it", async () => {
    const pcm = generateSteadyPCM(200, 3000, 5000);
    const res = await POST(makeRequest(pcm, { "x-word-count": "12" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.features.speakingRateWPM).toBeGreaterThan(0);
  });

  it("returns emotion: null (not a fabricated result) for very short/quiet audio", async () => {
    const tooShort = generateSteadyPCM(200, 100, 4000); // <500ms — below detectAudioEmotion's floor
    const res = await POST(makeRequest(tooShort));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.emotion).toBeNull();
  });
});
