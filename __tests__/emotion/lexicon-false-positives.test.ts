import { describe, it, expect } from "vitest";
import { detectTextEmotionLexicon } from "../../lib/emotion/detect";

describe("Lexicon — 'help me' false-positive regression", () => {
  it("does not classify a routine booking request as distress", () => {
    const result = detectTextEmotionLexicon("Can you help me book an appointment?");
    expect(result.label).not.toBe("distress");
  });

  it("does not classify a routine information request as distress", () => {
    const result = detectTextEmotionLexicon("Could you help me understand my bill?");
    expect(result.label).not.toBe("distress");
  });

  it("still classifies genuine crisis language as distress via the other keywords", () => {
    const result = detectTextEmotionLexicon("This is an emergency, I'm scared and desperate.");
    expect(result.label).toBe("distress");
  });
});
