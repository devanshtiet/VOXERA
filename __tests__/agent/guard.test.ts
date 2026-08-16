import { describe, it, expect } from "vitest";
import { guardOutput } from "../../lib/agent/guard";
import type { PolicyDirectives } from "../../lib/types";

function policy(escalate: PolicyDirectives["escalate"]): PolicyDirectives {
  return { acknowledgeFirst: false, pace: "normal", allowUpsell: true, escalate, notes: [] };
}

describe("guardOutput — escalation sentence never says 'specialist'", () => {
  it("appends a natural hand-off sentence when the reply mentions no hand-off at all", () => {
    const result = guardOutput({
      reply: "That sounds tough. What's going on?",
      allowedCitations: [],
      policy: policy("tier2"),
      sttConfidence: 1,
      topRetrievalScore: 1,
      minStt: 0,
      minRetrieval: 0,
    });
    expect(result.cleaned).not.toMatch(/specialist/i);
    expect(result.cleaned.toLowerCase()).toContain("someone from the team");
  });

  it("does NOT double up when the reply already offered a hand-off naturally", () => {
    const naturalReply = "That sounds tough. Let me grab someone from the team to help with this.";
    const result = guardOutput({
      reply: naturalReply,
      allowedCitations: [],
      policy: policy("human"),
      sttConfidence: 1,
      topRetrievalScore: 1,
      minStt: 0,
      minRetrieval: 0,
    });
    // Should be unchanged — no second escalation sentence appended.
    expect(result.cleaned).toBe(naturalReply);
    expect(result.reasons).not.toContain("appended escalation sentence (policy)");
  });

  it("does not append anything when escalate is none", () => {
    const reply = "Sure, I can help with that.";
    const result = guardOutput({
      reply,
      allowedCitations: [],
      policy: policy("none"),
      sttConfidence: 1,
      topRetrievalScore: 1,
      minStt: 0,
      minRetrieval: 0,
    });
    expect(result.cleaned).toBe(reply);
  });
});
