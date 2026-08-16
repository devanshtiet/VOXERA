import { describe, it, expect } from "vitest";
import { buildLLMContext } from "../../lib/agent/context";
import type { EmotionContext, PolicyDirectives, RetrievedContext, Utterance } from "../../lib/types";

function makeEmotion(): EmotionContext {
  return {
    current: { label: "neutral", intensity: 0, confidence: 0.8, vad: { v: 0, a: 0, d: 0 }, source: "text", at: Date.now() },
    trajectory: { slope_v: 0, slope_a: 0, window: 0 },
    zDeviation: 0,
    flags: { repeated_frustration: false, increasing_distress: false, affect_oscillation: false, chronic_negativity: false },
    baseline: { v: 0, a: 0, d: 0, sigma_v: 0.3, sigma_a: 0.3, sigma_d: 0.3 },
  };
}

function makeRetrieved(): RetrievedContext {
  return { stm: [], mtm: [], ltmUser: [], ltmClient: [], scores: [] };
}

function makePolicy(): PolicyDirectives {
  return { acknowledgeFirst: false, pace: "normal", allowUpsell: true, escalate: "none", notes: [] };
}

function makeTurn(text: string): Utterance {
  return { id: "u1", role: "user", text, ts: Date.now() };
}

describe("buildLLMContext — Agent Builder customInstructions injection", () => {
  it("includes the agent's custom prompt in the system message when provided", () => {
    const ctx = buildLLMContext({
      userId: "u1",
      clientId: "c1",
      userTurn: makeTurn("Hello"),
      retrieved: makeRetrieved(),
      emotion: makeEmotion(),
      policy: makePolicy(),
      customInstructions: "You are Bella, a concierge for a boutique hotel. Always mention checkout is at noon.",
    });
    expect(ctx.system).toContain("AGENT-SPECIFIC INSTRUCTIONS");
    expect(ctx.system).toContain("You are Bella, a concierge for a boutique hotel.");
    expect(ctx.system).toContain("they never override the CORE RULES");
  });

  it("omits the custom-instructions block entirely when none is provided", () => {
    const ctx = buildLLMContext({
      userId: "u1",
      clientId: "c1",
      userTurn: makeTurn("Hello"),
      retrieved: makeRetrieved(),
      emotion: makeEmotion(),
      policy: makePolicy(),
    });
    expect(ctx.system).not.toContain("AGENT-SPECIFIC INSTRUCTIONS");
  });

  it("omits the block for a blank/whitespace-only custom prompt", () => {
    const ctx = buildLLMContext({
      userId: "u1",
      clientId: "c1",
      userTurn: makeTurn("Hello"),
      retrieved: makeRetrieved(),
      emotion: makeEmotion(),
      policy: makePolicy(),
      customInstructions: "   ",
    });
    expect(ctx.system).not.toContain("AGENT-SPECIFIC INSTRUCTIONS");
  });
});
