import { describe, it, expect, vi, beforeEach } from "vitest";
import { emitSessionEvent } from "../../lib/realtime/emitter";
import { redis, redisSub } from "../../lib/redis/client";

vi.mock("../../lib/redis/client", () => ({
  redis: {
    hset: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockResolvedValue(1),
  },
  redisSub: {
    subscribe: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Realtime Session Emitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes emotion events and updates session state hash", async () => {
    const sessionId = "test-session-123";
    const data = { label: "anger", intensity: 0.8 };

    await emitSessionEvent(sessionId, "emotion", data);

    // Should update hash
    expect(redis.hset).toHaveBeenCalledWith(
      `session_state:${sessionId}`,
      "last_emotion",
      JSON.stringify(data)
    );
    expect(redis.hset).toHaveBeenCalledWith(
      `session_state:${sessionId}`,
      "updated_at",
      expect.any(String)
    );

    // Should publish to channel
    expect(redis.publish).toHaveBeenCalledWith(
      `session:${sessionId}`,
      expect.stringContaining('"type":"emotion"')
    );
    expect(redis.publish).toHaveBeenCalledWith(
      "active_calls_events",
      expect.stringContaining('"type":"emotion"')
    );
  });

  it("publishes transcript events and updates session state hash", async () => {
    const sessionId = "test-session-123";
    const data = { role: "user", text: "hello" };

    await emitSessionEvent(sessionId, "transcript", data);

    expect(redis.hset).toHaveBeenCalledWith(
      `session_state:${sessionId}`,
      "last_transcript",
      JSON.stringify(data)
    );

    expect(redis.publish).toHaveBeenCalledWith(
      `session:${sessionId}`,
      expect.stringContaining('"type":"transcript"')
    );
  });
});
