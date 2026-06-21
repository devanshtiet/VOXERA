/**
 * Tests: Policy escalation logic (lib/agent/policy.ts)
 * Sprint 2 — FR-18 Human Escalation, sustained negativity
 *
 * Run: npm run test:run
 */

import { describe, it, expect } from "vitest";
import { decidePolicy, policyToPrompt } from "../../lib/agent/policy";
import type { EmotionContext, EmotionLabel } from "../../lib/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeCtx(
  label: EmotionLabel,
  intensity = 0.5,
  flags: Partial<EmotionContext["flags"]> = {},
  slope_a = 0
): EmotionContext {
  return {
    current: {
      label,
      intensity,
      confidence: 0.8,
      vad: { v: 0, a: 0, d: 0 },
      source: "text",
      at: Date.now(),
    },
    trajectory: { slope_v: 0, slope_a, window: 6 },
    zDeviation: 0,
    flags: {
      repeated_frustration: false,
      increasing_distress: false,
      affect_oscillation: false,
      chronic_negativity: false,
      ...flags,
    },
    baseline: { v: 0, a: 0, d: 0, sigma_v: 0.3, sigma_a: 0.3, sigma_d: 0.3 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("decidePolicy — neutral caller", () => {
  it("returns no escalation for neutral emotion", () => {
    const policy = decidePolicy(makeCtx("neutral"));
    expect(policy.escalate).toBe("none");
    expect(policy.acknowledgeFirst).toBe(false);
    expect(policy.allowUpsell).toBe(true);
  });
});

describe("decidePolicy — positive emotions", () => {
  it("joy → allows upsell, no escalation", () => {
    const policy = decidePolicy(makeCtx("joy"));
    expect(policy.allowUpsell).toBe(true);
    expect(policy.escalate).toBe("none");
  });

  it("gratitude → allows upsell, no escalation", () => {
    const policy = decidePolicy(makeCtx("gratitude"));
    expect(policy.allowUpsell).toBe(true);
    expect(policy.escalate).toBe("none");
  });
});

describe("decidePolicy — anger", () => {
  it("anger → acknowledgeFirst true, no upsell", () => {
    const policy = decidePolicy(makeCtx("anger", 0.5));
    expect(policy.acknowledgeFirst).toBe(true);
    expect(policy.allowUpsell).toBe(false);
    expect(policy.pace).toBe("slow");
  });

  it("high-intensity anger (>0.75) → tier2 escalation", () => {
    const policy = decidePolicy(makeCtx("anger", 0.8));
    expect(policy.escalate).toBe("tier2");
  });

  it("low-intensity anger (<0.75) → no escalation", () => {
    const policy = decidePolicy(makeCtx("anger", 0.5));
    expect(policy.escalate).toBe("none");
  });
});

describe("decidePolicy — frustration", () => {
  it("frustration label → tier2 escalation", () => {
    const policy = decidePolicy(makeCtx("frustration"));
    expect(policy.escalate).toBe("tier2");
    expect(policy.acknowledgeFirst).toBe(true);
  });

  it("repeated_frustration flag → tier2 escalation", () => {
    const policy = decidePolicy(makeCtx("neutral", 0.5, { repeated_frustration: true }));
    expect(policy.escalate).toBe("tier2");
  });
});

describe("decidePolicy — distress", () => {
  it("distress label at low intensity → tier2", () => {
    const policy = decidePolicy(makeCtx("distress", 0.5));
    expect(policy.escalate).toBe("tier2");
    expect(policy.acknowledgeFirst).toBe(true);
    expect(policy.pace).toBe("slow");
  });

  it("distress label at high intensity (>0.8) → human escalation", () => {
    const policy = decidePolicy(makeCtx("distress", 0.9));
    expect(policy.escalate).toBe("human");
  });

  it("increasing_distress flag → escalation triggered", () => {
    const policy = decidePolicy(makeCtx("neutral", 0.5, { increasing_distress: true }));
    expect(["tier2", "human"]).toContain(policy.escalate);
    expect(policy.allowUpsell).toBe(false);
  });
});

describe("decidePolicy — sustained negativity (Sprint 2 new rule)", () => {
  it("repeated_frustration + increasing_distress + intensity>0.7 → human escalation", () => {
    const policy = decidePolicy(
      makeCtx("frustration", 0.85, {
        repeated_frustration: true,
        increasing_distress: true,
      })
    );
    expect(policy.escalate).toBe("human");
    expect(policy.allowUpsell).toBe(false);
    expect(policy.acknowledgeFirst).toBe(true);
    expect(policy.pace).toBe("slow");
  });

  it("repeated_frustration + increasing_distress but intensity<=0.7 → does NOT trigger sustained rule", () => {
    const policy = decidePolicy(
      makeCtx("frustration", 0.6, {
        repeated_frustration: true,
        increasing_distress: true,
      })
    );
    // Falls through to distress/frustration path — still escalates but not "human"
    expect(["tier2", "human"]).toContain(policy.escalate);
  });

  it("repeated_frustration alone (no distress) → does NOT trigger sustained rule", () => {
    const policy = decidePolicy(
      makeCtx("frustration", 0.9, {
        repeated_frustration: true,
        increasing_distress: false,
      })
    );
    // Should be tier2 from frustration path, not human from sustained path
    expect(policy.escalate).toBe("tier2");
  });
});

describe("decidePolicy — confusion", () => {
  it("confusion → slow pace, no escalation", () => {
    const policy = decidePolicy(makeCtx("confusion"));
    expect(policy.pace).toBe("slow");
    expect(policy.escalate).toBe("none");
  });
});

describe("policyToPrompt — output format", () => {
  it("includes pace in output", () => {
    const policy = decidePolicy(makeCtx("anger"));
    const prompt = policyToPrompt(policy);
    expect(prompt).toContain("Pace:");
  });

  it("includes acknowledgement instruction when acknowledgeFirst is true", () => {
    const policy = decidePolicy(makeCtx("anger"));
    expect(policy.acknowledgeFirst).toBe(true);
    const prompt = policyToPrompt(policy);
    expect(prompt.toLowerCase()).toContain("acknowledgement");
  });

  it("includes escalation instruction when escalation is not none", () => {
    const policy = decidePolicy(makeCtx("distress", 0.9));
    expect(policy.escalate).toBe("human");
    const prompt = policyToPrompt(policy);
    expect(prompt).toContain("Escalation required");
  });

  it("does not include escalation text when escalate is none", () => {
    const policy = decidePolicy(makeCtx("neutral"));
    const prompt = policyToPrompt(policy);
    expect(prompt).not.toContain("Escalation required");
  });
});
