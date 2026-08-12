import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit } from "../../lib/telephony/rate-limit";

describe("checkRateLimit — fixed-window limiter over MockRedis", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const key = `test:rate-limit:${Math.random()}`;
    const r1 = await checkRateLimit(key, 3, 60_000);
    const r2 = await checkRateLimit(key, 3, 60_000);
    const r3 = await checkRateLimit(key, 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  it("blocks requests once the limit is exceeded, with a retryAfterMs", async () => {
    const key = `test:rate-limit:${Math.random()}`;
    await checkRateLimit(key, 1, 60_000);
    const blocked = await checkRateLimit(key, 1, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("resets the window after it elapses", async () => {
    const key = `test:rate-limit:${Math.random()}`;
    const shortWindowMs = 50;
    await checkRateLimit(key, 1, shortWindowMs);
    const blockedImmediately = await checkRateLimit(key, 1, shortWindowMs);
    expect(blockedImmediately.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, shortWindowMs + 20));

    const allowedAfterReset = await checkRateLimit(key, 1, shortWindowMs);
    expect(allowedAfterReset.allowed).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const keyA = `test:rate-limit:a:${Math.random()}`;
    const keyB = `test:rate-limit:b:${Math.random()}`;
    await checkRateLimit(keyA, 1, 60_000);
    const blockedA = await checkRateLimit(keyA, 1, 60_000);
    const allowedB = await checkRateLimit(keyB, 1, 60_000);
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});
