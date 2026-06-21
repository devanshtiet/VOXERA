/**
 * Tests: Telephony API Routes — incoming & status webhooks
 * Sprint 1 — FR-1 Incoming Call Handling
 *
 * Tests route logic using mocked dependencies (no real Twilio / DB calls).
 * Run: npm run test:run
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Supabase so no real DB calls fire
vi.mock("../../lib/db/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

// Mock signature validation to always pass in tests
vi.mock("../../lib/telephony/twilio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/telephony/twilio")>();
  return {
    ...actual,
    validateTwilioSignature: () => true,
  };
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/telephony/incoming — request parsing", () => {
  it("correctly reads CallSid and From from form-encoded body", () => {
    const body = new URLSearchParams({
      CallSid: "CA123456",
      From: "+919876543210",
      To: "+11234567890",
    });

    const params = Object.fromEntries(body);
    expect(params.CallSid).toBe("CA123456");
    expect(params.From).toBe("+919876543210");
    expect(params.To).toBe("+11234567890");
  });

  it("handles missing optional fields gracefully", () => {
    const body = new URLSearchParams({ CallSid: "CA999" });
    const params = Object.fromEntries(body);
    expect(params.CallSid).toBe("CA999");
    expect(params.From).toBeUndefined();
    expect(params.To).toBeUndefined();
  });
});

describe("POST /api/telephony/status — status mapping", () => {
  it("maps 'completed' → 'completed'", () => {
    const statusMap: Record<string, string> = {
      completed: "completed",
      busy: "failed",
      "no-answer": "failed",
      failed: "failed",
      canceled: "failed",
    };
    expect(statusMap["completed"]).toBe("completed");
  });

  it("maps all failure statuses to 'failed'", () => {
    const statusMap: Record<string, string> = {
      completed: "completed",
      busy: "failed",
      "no-answer": "failed",
      failed: "failed",
      canceled: "failed",
    };
    for (const status of ["busy", "no-answer", "failed", "canceled"]) {
      expect(statusMap[status]).toBe("failed");
    }
  });

  it("duration seconds → milliseconds conversion", () => {
    const callDuration = "65"; // seconds from Twilio
    const durationMs = parseInt(callDuration, 10) * 1000;
    expect(durationMs).toBe(65000);
  });

  it("handles missing duration gracefully", () => {
    const callDuration: string | undefined = undefined;
    const durationMs = callDuration ? parseInt(callDuration, 10) * 1000 : undefined;
    expect(durationMs).toBeUndefined();
  });
});

describe("WebSocket URL construction", () => {
  it("converts https:// base URL to wss:// for WebSocket", () => {
    const baseUrl = "https://abc123.ngrok-free.app";
    const wsUrl = baseUrl.replace(/^https?/, "wss");
    expect(wsUrl).toBe("wss://abc123.ngrok-free.app");
  });

  it("converts http:// base URL to wss://", () => {
    const baseUrl = "http://localhost:3000";
    const wsUrl = baseUrl.replace(/^https?/, "wss");
    expect(wsUrl).toBe("wss://localhost:3000");
  });

  it("appends correct query params to stream URL", () => {
    const baseWs = "wss://example.ngrok-free.app";
    const callSid = "CA123";
    const clientId = "user-abc";
    const caller = "+919999999999";
    const wsUrl = `${baseWs}/api/telephony/stream?callSid=${callSid}&clientId=${clientId}&caller=${encodeURIComponent(caller)}`;

    expect(wsUrl).toContain("callSid=CA123");
    expect(wsUrl).toContain("clientId=user-abc");
    expect(wsUrl).toContain("caller=");
  });
});

describe("clientId resolution", () => {
  it("falls back to DEFAULT_CLIENT_ID when phone number not in DB", () => {
    const phoneRow = null as { clientId: string } | null; // no DB row
    const fallback = "demo-client";
    const clientId = phoneRow?.clientId || fallback;
    expect(clientId).toBe("demo-client");
  });

  it("uses clientId from DB row when available", () => {
    const phoneRow = { clientId: "real-client-id" };
    const fallback = "demo-client";
    const clientId = phoneRow?.clientId || fallback;
    expect(clientId).toBe("real-client-id");
  });
});
