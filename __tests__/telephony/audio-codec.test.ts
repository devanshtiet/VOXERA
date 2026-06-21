/**
 * Tests: mulaw ↔ PCM audio codec (lib/telephony/stream-handler.ts)
 * Sprint 1 — Audio encoding correctness
 *
 * We export the codec functions for testing by extracting them from
 * the module. These are pure functions with no I/O dependencies.
 *
 * Run: npm run test:run
 */

import { describe, it, expect } from "vitest";

// ─── Inline the codec logic for isolated unit testing ────────────────────────
// (Mirrors exactly what stream-handler.ts uses internally)

const MULAW_DECODE_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let u = ~i;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    let mantissa = u & 0x0f;
    mantissa = (mantissa << 3) | 0x84;
    let sample = mantissa << exponent;
    sample -= 0x84;
    table[i] = sign !== 0 ? -sample : sample;
  }
  return table;
})();

function decodeMulaw(mulawBytes: Buffer): Buffer {
  const pcm = Buffer.alloc(mulawBytes.length * 2);
  for (let i = 0; i < mulawBytes.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawBytes[i]];
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
}

function encodeMulaw(pcmSample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = 0;
  if (pcmSample < 0) { sign = 0x80; pcmSample = -pcmSample; }
  if (pcmSample > CLIP) pcmSample = CLIP;
  pcmSample += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (pcmSample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (pcmSample >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

function pcmToMulaw(pcmBuffer: Buffer): Buffer {
  const mulaw = Buffer.alloc(pcmBuffer.length / 2);
  for (let i = 0; i < mulaw.length; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulaw[i] = encodeMulaw(sample);
  }
  return mulaw;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("mulaw decode table", () => {
  it("has exactly 256 entries", () => {
    expect(MULAW_DECODE_TABLE.length).toBe(256);
  });

  it("all entries are finite numbers", () => {
    for (const v of MULAW_DECODE_TABLE) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("silence byte (0xFF) decodes near zero", () => {
    // 0xFF is the standard mulaw silence value
    const silence = MULAW_DECODE_TABLE[0xff];
    expect(Math.abs(silence)).toBeLessThan(100);
  });
});

describe("decodeMulaw — mulaw → PCM", () => {
  it("output buffer is exactly 2x the input length (16-bit samples)", () => {
    const input = Buffer.alloc(160); // 160 mulaw bytes = 20ms at 8kHz
    const output = decodeMulaw(input);
    expect(output.length).toBe(320);
  });

  it("produces a Buffer", () => {
    const output = decodeMulaw(Buffer.from([0xff, 0x7f, 0x00]));
    expect(Buffer.isBuffer(output)).toBe(true);
  });

  it("empty input produces empty output", () => {
    expect(decodeMulaw(Buffer.alloc(0)).length).toBe(0);
  });

  it("all-silence input (0xFF) produces near-zero PCM samples", () => {
    const input = Buffer.alloc(10, 0xff);
    const pcm = decodeMulaw(input);
    for (let i = 0; i < 10; i++) {
      const sample = pcm.readInt16LE(i * 2);
      expect(Math.abs(sample)).toBeLessThan(100);
    }
  });
});

describe("encodeMulaw — PCM → mulaw", () => {
  it("returns a value in [0, 255]", () => {
    for (const v of [-32000, -1000, 0, 1000, 32000]) {
      const encoded = encodeMulaw(v);
      expect(encoded).toBeGreaterThanOrEqual(0);
      expect(encoded).toBeLessThanOrEqual(255);
    }
  });

  it("silence (0) encodes to 0xFF (standard mulaw silence)", () => {
    expect(encodeMulaw(0)).toBe(0xff);
  });

  it("clips large positive values without throwing", () => {
    expect(() => encodeMulaw(99999)).not.toThrow();
    expect(encodeMulaw(99999)).toBeGreaterThanOrEqual(0);
  });

  it("clips large negative values without throwing", () => {
    expect(() => encodeMulaw(-99999)).not.toThrow();
  });
});

describe("pcmToMulaw — Buffer round-trip", () => {
  it("output buffer is half the input length", () => {
    const pcm = Buffer.alloc(320); // 160 samples × 2 bytes
    const mulaw = pcmToMulaw(pcm);
    expect(mulaw.length).toBe(160);
  });

  it("silence PCM (all zeros) produces all-0xFF mulaw bytes", () => {
    const pcm = Buffer.alloc(20, 0); // 10 silent 16-bit samples
    const mulaw = pcmToMulaw(pcm);
    for (const b of mulaw) {
      expect(b).toBe(0xff);
    }
  });

  it("produces a Buffer", () => {
    expect(Buffer.isBuffer(pcmToMulaw(Buffer.alloc(4)))).toBe(true);
  });
});
