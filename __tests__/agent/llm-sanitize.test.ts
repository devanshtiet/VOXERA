import { describe, it, expect } from "vitest";
import { sanitizeReply } from "../../lib/agent/llm";

describe("sanitizeReply — strips leaked tool-call syntax from LLM output", () => {
  it("removes a full <function=...>...</function> block with a fabricated arg", () => {
    const raw =
      'I\'m really sorry this is happening. I\'m here to help. <function=cancel_booking>{"bookingId": "BKG-XXXXXX"}</function> Let me connect you with a senior specialist now.';
    const clean = sanitizeReply(raw);
    expect(clean).not.toContain("<function");
    expect(clean).not.toContain("BKG-XXXXXX");
    expect(clean).toContain("I'm really sorry this is happening.");
    expect(clean).toContain("Let me connect you with someone from the team now.");
  });

  it("removes a dangling unclosed function tag", () => {
    const raw = "Sure, I can help with that. <function=check_availability>";
    const clean = sanitizeReply(raw);
    expect(clean).not.toContain("<function");
    expect(clean).toBe("Sure, I can help with that.");
  });

  it("leaves ordinary replies with no tool-call syntax untouched", () => {
    const raw = "Hello. How can I assist you today?";
    expect(sanitizeReply(raw)).toBe(raw);
  });

  it("collapses extra whitespace left behind after stripping", () => {
    const raw = "Let me check.   <function=lookup>{}</function>   One moment please.";
    const clean = sanitizeReply(raw);
    expect(clean).toBe("Let me check. One moment please.");
  });
});

describe("sanitizeReply — humanizes leaked support-ticket escalation language", () => {
  it("replaces 'a senior specialist' with natural phrasing", () => {
    const clean = sanitizeReply("That sounds frightening. Let me connect you with a senior specialist now.");
    expect(clean).not.toMatch(/specialist/i);
    expect(clean).toContain("connect you with someone from the team now.");
  });

  it("replaces 'a tier 2 specialist' as a whole phrase, not just 'specialist'", () => {
    const clean = sanitizeReply("I'll escalate your issue to a tier 2 specialist for further assistance.");
    expect(clean).not.toMatch(/tier|specialist|escalate/i);
  });

  it("replaces bare 'tier2' (no space) too", () => {
    const clean = sanitizeReply("I'm going to connect you with a tier2 specialist right now.");
    expect(clean).not.toMatch(/tier|specialist/i);
  });

  it("humanizes a standalone 'escalate' verb", () => {
    const clean = sanitizeReply("I think it would be best to escalate this for you.");
    expect(clean).not.toMatch(/escalate/i);
    expect(clean.toLowerCase()).toContain("loop in someone from the team");
  });

  it("leaves ordinary replies with none of these words completely untouched", () => {
    const raw = "Hey, good to hear from you! What's going on?";
    expect(sanitizeReply(raw)).toBe(raw);
  });
});
