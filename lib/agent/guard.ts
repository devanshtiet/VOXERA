import type { PolicyDirectives } from "../types";

// Lightweight anti-hallucination checks. Run on the LLM output before TTS.
export interface GuardResult {
  ok: boolean;
  reasons: string[];
  cleaned: string;
}

export function guardOutput(args: {
  reply: string;
  allowedCitations: string[];
  policy: PolicyDirectives;
  sttConfidence: number;
  topRetrievalScore: number;
  minStt: number;
  minRetrieval: number;
}): GuardResult {
  const reasons: string[] = [];
  let reply = args.reply.trim();

  // 1) Citation fence: strip citations not in the allowed list.
  reply = reply.replace(/\[MEM_ID=([a-zA-Z0-9_-]+)\]/g, (full, id) => {
    return args.allowedCitations.includes(id) ? full : "";
  });

  // 2) Detect obvious hallucinated tokens (fake ticket patterns the LLM might fabricate).
  const fabricatedTickets = [...reply.matchAll(/\b[A-Z]{2,}-\d{3,}\b/g)].map((m) => m[0]);
  const groundedText = args.allowedCitations.join(" ");
  for (const t of fabricatedTickets) {
    // Only OK if present in citations' IDs OR replied-with a citation nearby.
    if (!groundedText.includes(t)) {
      const idx = reply.indexOf(t);
      const window = reply.slice(Math.max(0, idx - 40), idx + t.length + 40);
      if (!/\[MEM_ID=/.test(window)) {
        reply = reply.replace(t, "[unverified reference removed]");
        reasons.push(`stripped unverifiable identifier: ${t}`);
      }
    }
  }

  // 3) Policy compliance: acknowledgement-first.
  if (args.policy.acknowledgeFirst) {
    const first120 = reply.slice(0, 120).toLowerCase();
    const ackPhrases = [
      "i understand",
      "i hear",
      "i'm sorry",
      "i am sorry",
      "that sounds",
      "i can see",
      "apologize",
      "completely understand",
      "i get that",
    ];
    const hasAck = ackPhrases.some((p) => first120.includes(p));
    if (!hasAck) {
      reply = `I'm really sorry this is happening. ${reply}`;
      reasons.push("injected acknowledgement (policy)");
    }
  }

  // 4) Confidence gating → convert to clarification if below thresholds.
  if (args.sttConfidence < args.minStt) {
    return {
      ok: false,
      reasons: [`STT confidence ${args.sttConfidence.toFixed(2)} below ${args.minStt}`],
      cleaned: "I want to make sure I got that right — could you say that once more for me?",
    };
  }

  if (args.topRetrievalScore < args.minRetrieval && args.allowedCitations.length > 0 && /\b(ticket|account|order|charge|refund)\b/i.test(reply)) {
    reasons.push("retrieval below threshold — hedging factual claim");
    reply = `I don't have reliable information on that yet, so I want to avoid guessing. ${reply}`;
  }

  // 5) Escalation mention required. Recognizes natural hand-off phrasing
  // ("grab someone from the team", "loop in a teammate") in addition to the
  // literal words, so a reply that already offered a hand-off naturally
  // doesn't get a second, robotic sentence bolted on top of it. The
  // fallback sentence itself is phrased the way a person would say it out
  // loud, matching the persona/policy prompts — never "specialist".
  if (args.policy.escalate !== "none") {
    const alreadyMentionsHandoff =
      /(connect|transfer|supervisor|human|someone from the team|teammate|grab someone|loop (?:in|you in)|bring (?:in|someone))/i.test(
        reply
      );
    if (!alreadyMentionsHandoff) {
      reply += " Let me grab someone from the team to help with this.";
      reasons.push("appended escalation sentence (policy)");
    }
  }

  return { ok: true, reasons, cleaned: reply.trim() };
}
