import { describe, it, expect } from "vitest";
import { int16ToFloat32Pcm } from "../../lib/emotion/local-audio-detect";

describe("int16ToFloat32Pcm — Int16 PCM to Float32 [-1,1] conversion for wav2vec2", () => {
  it("converts silence (all zeros) to all zeros", () => {
    const buf = Buffer.alloc(8); // 4 samples of 0
    const out = int16ToFloat32Pcm(buf);
    expect(out.length).toBe(4);
    expect(Array.from(out)).toEqual([0, 0, 0, 0]);
  });

  it("converts max positive Int16 (32767) to just under 1.0", () => {
    const buf = Buffer.alloc(2);
    buf.writeInt16LE(32767, 0);
    const out = int16ToFloat32Pcm(buf);
    expect(out[0]).toBeCloseTo(32767 / 32768, 5);
    expect(out[0]).toBeLessThan(1);
  });

  it("converts max negative Int16 (-32768) to exactly -1.0", () => {
    const buf = Buffer.alloc(2);
    buf.writeInt16LE(-32768, 0);
    const out = int16ToFloat32Pcm(buf);
    expect(out[0]).toBeCloseTo(-1, 5);
  });

  it("produces the correct sample count for a buffer with an odd trailing byte", () => {
    const buf = Buffer.alloc(5); // 2 full samples + 1 leftover byte
    const out = int16ToFloat32Pcm(buf);
    expect(out.length).toBe(2);
  });
});
