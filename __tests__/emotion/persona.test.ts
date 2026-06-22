/**
 * Tests: Emotion Persona (lib/emotion/persona.ts)
 * Sprint 2 — FR-11 Emotion-Aware Response Generation
 *
 * Run: npm run test:run
 */

import { describe, it, expect } from "vitest";
import { getEmotionPersona, formatPersonaBlock, type EmotionPersona } from "../../lib/emotion/persona";
import type { EmotionContext, EmotionLabel } from "../../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(
  label: EmotionLabel,
  intensity = 0.5,
  flags: Partial<EmotionContext["flags"]> = {}
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
    trajectory: { slope_v: 0, slope_a: 0, window: 6 },
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

describe("getEmotionPersona — all 9 labels return a valid persona", () => {
  const labels: EmotionLabel[] = [
    "anger", "frustration", "distress", "sadness",
    "fear", "confusion", "joy", "gratitude", "neutral",
  ];

  for (const label of labels) {
    it(`returns a persona for "${label}"`, () => {
      const ctx = makeContext(label);
      const persona = getEmotionPersona(ctx);

      expect(persona).toBeDefined();
      expect(typeof persona.tone).toBe("string");
      expect(persona.tone.length).toBeGreaterThan(0);

      expect(typeof persona.openingStyle).toBe("string");
      expect(persona.openingStyle.length).toBeGreaterThan(0);

      expect(Array.isArray(persona.languageRules)).toBe(true);
      expect(persona.languageRules.length).toBeGreaterThan(0);

      expect(Array.isArray(persona.forbidden)).toBe(true);

      expect(typeof persona.example).toBe("string");
      expect(persona.example.length).toBeGreaterThan(0);
    });
  }
});

describe("getEmotionPersona — priority overrides", () => {
  it("increasing_distress flag overrides label — always returns distress persona", () => {
    // Even if label is "neutral", distress flag → distress persona
    const ctx = makeContext("neutral", 0.5, { increasing_distress: true });
    const persona = getEmotionPersona(ctx);

    // Distress persona has safety-first tone
    expect(persona.tone.toLowerCase()).toContain("safety");
  });

  it("distress label also returns distress persona", () => {
    const ctx = makeContext("distress");
    const persona = getEmotionPersona(ctx);
    expect(persona.tone.toLowerCase()).toContain("safety");
  });

  it("repeated_frustration + anger label → anger persona", () => {
    const ctx = makeContext("anger", 0.7, { repeated_frustration: true });
    const persona = getEmotionPersona(ctx);
    expect(persona.tone.toLowerCase()).toContain("de-escalat");
  });

  it("distress takes priority over repeated_frustration + anger", () => {
    const ctx = makeContext("anger", 0.9, {
      repeated_frustration: true,
      increasing_distress: true,
    });
    const persona = getEmotionPersona(ctx);
    // Should get distress (safety first), not anger
    expect(persona.tone.toLowerCase()).toContain("safety");
  });
});

describe("getEmotionPersona — persona content correctness", () => {
  it("anger persona forbids 'I understand your frustration'", () => {
    const persona = getEmotionPersona(makeContext("anger"));
    expect(persona.forbidden).toContain("I understand your frustration");
  });

  it("anger persona forbids 'policy'", () => {
    const persona = getEmotionPersona(makeContext("anger"));
    expect(persona.forbidden).toContain("policy");
  });

  it("fear persona forbids uncertainty words like 'maybe'", () => {
    const persona = getEmotionPersona(makeContext("fear"));
    expect(persona.forbidden).toContain("maybe");
  });

  it("neutral persona has empty forbidden list (no restrictions)", () => {
    const persona = getEmotionPersona(makeContext("neutral"));
    expect(persona.forbidden).toHaveLength(0);
  });

  it("joy persona allows upselling (no anti-upsell rule)", () => {
    const persona = getEmotionPersona(makeContext("joy"));
    const hasAntiUpsell = persona.languageRules.some((r) =>
      r.toLowerCase().includes("upsell")
    );
    // joy persona explicitly allows upsell if relevant
    expect(persona.languageRules.some((r) => r.includes("Upselling is allowed"))).toBe(true);
  });
});

describe("formatPersonaBlock — output format", () => {
  it("contains emotion label in uppercase", () => {
    const ctx = makeContext("anger", 0.82);
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);

    expect(block).toContain("ANGER");
  });

  it("contains intensity value", () => {
    const ctx = makeContext("frustration", 0.65);
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);

    expect(block).toContain("0.65");
  });

  it("contains TONE section", () => {
    const ctx = makeContext("neutral");
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);
    expect(block).toContain("TONE YOU MUST ADOPT:");
  });

  it("contains LANGUAGE RULES section", () => {
    const ctx = makeContext("confusion");
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);
    expect(block).toContain("LANGUAGE RULES:");
  });

  it("contains EXAMPLE OPENING", () => {
    const ctx = makeContext("sadness");
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);
    expect(block).toContain("EXAMPLE OPENING:");
  });

  it("contains trajectory arrow", () => {
    const ctx = makeContext("anger");
    ctx.trajectory.slope_a = 0.12; // rising
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);
    expect(block).toContain("↑");
  });

  it("shows repeated_frustration warning when flag is true", () => {
    const ctx = makeContext("frustration", 0.7, { repeated_frustration: true });
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);
    expect(block).toContain("Repeated frustration");
  });

  it("shows increasing_distress warning when flag is true", () => {
    const ctx = makeContext("distress", 0.9, { increasing_distress: true });
    const persona = getEmotionPersona(ctx);
    const block = formatPersonaBlock(persona, ctx);
    expect(block).toContain("Distress is increasing");
  });

  it("returns a non-empty string for every emotion label", () => {
    const labels: EmotionLabel[] = [
      "anger", "frustration", "distress", "sadness",
      "fear", "confusion", "joy", "gratitude", "neutral",
    ];
    for (const label of labels) {
      const ctx = makeContext(label);
      const persona = getEmotionPersona(ctx);
      const block = formatPersonaBlock(persona, ctx);
      expect(block.length).toBeGreaterThan(50);
    }
  });
});
