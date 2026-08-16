import { describe, it, expect } from "vitest";
import { detectTextEmotionLexicon, detectTextEmotion } from "../../lib/emotion/detect";

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

describe("Lexicon — negation handling", () => {
  it("does not classify 'not feeling good' as joy", () => {
    const result = detectTextEmotionLexicon("I'm not feeling good. What should I do?");
    expect(result.label).not.toBe("joy");
  });

  it("flips a negated positive keyword to its negative counterpart", () => {
    const result = detectTextEmotionLexicon("That's not great news.");
    expect(result.label).toBe("sadness");
  });

  it("still classifies un-negated positive language as joy", () => {
    const result = detectTextEmotionLexicon("That's great news, I'm so happy.");
    expect(result.label).toBe("joy");
  });

  it("drops a negated negative keyword rather than mislabeling it", () => {
    const result = detectTextEmotionLexicon("I'm not angry, just curious about the schedule.");
    expect(result.label).not.toBe("anger");
  });
});

describe("Small-talk guard — bare greetings never get misclassified", () => {
  it("classifies 'How are you?' as neutral, not confusion", async () => {
    const result = await detectTextEmotion("How are you?");
    expect(result.primary.label).toBe("neutral");
  });

  it("classifies a plain 'Hello.' as neutral", async () => {
    const result = await detectTextEmotion("Hello.");
    expect(result.primary.label).toBe("neutral");
  });

  it("does NOT guard a question that contains genuine distress content", async () => {
    const result = await detectTextEmotion("How am I supposed to deal with this, I'm scared and desperate?");
    expect(result.primary.label).toBe("distress");
  });
});
