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
    expect(clean).toContain("Let me connect you with a senior specialist now.");
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
