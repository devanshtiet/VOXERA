import type { EmotionContext, PolicyDirectives } from "../types";

export function decidePolicy(emotion: EmotionContext): PolicyDirectives {
  const directives: PolicyDirectives = {
    acknowledgeFirst: false,
    pace: "normal",
    allowUpsell: true,
    escalate: "none",
    notes: [],
  };

  if (emotion.flags.increasing_distress || emotion.current.label === "distress") {
    directives.acknowledgeFirst = true;
    directives.pace = "slow";
    directives.allowUpsell = false;
    directives.escalate = emotion.current.intensity > 0.8 ? "human" : "tier2";
    directives.safetyScript = "Offer to connect to a human specialist. Prioritize user safety.";
    directives.notes.push("User shows escalating distress — acknowledge, slow down, escalate.");
    return directives;
  }

  if (emotion.flags.repeated_frustration || emotion.current.label === "frustration") {
    directives.acknowledgeFirst = true;
    directives.pace = "slow";
    directives.allowUpsell = false;
    directives.escalate = "tier2";
    directives.notes.push("Repeated frustration — acknowledge first, no upsell, offer concrete next step.");
    return directives;
  }

  if (emotion.current.label === "anger") {
    directives.acknowledgeFirst = true;
    directives.pace = "slow";
    directives.allowUpsell = false;
    directives.notes.push("Anger detected — lead with acknowledgement; avoid defensive language.");
    return directives;
  }

  if (emotion.flags.affect_oscillation || emotion.current.label === "confusion") {
    directives.pace = "slow";
    directives.notes.push("User seems confused — shorter turns, one question at a time, confirm understanding.");
    return directives;
  }

  if (emotion.current.label === "joy" || emotion.current.label === "gratitude") {
    directives.notes.push("Positive affect — brief acknowledgement, allow upsell if relevant.");
    return directives;
  }

  return directives;
}

export function policyToPrompt(d: PolicyDirectives): string {
  const parts = [
    `Pace: ${d.pace}.`,
    d.acknowledgeFirst ? "Open with a genuine acknowledgement of the user's feeling BEFORE any procedural content." : "",
    d.allowUpsell ? "" : "Do NOT upsell or suggest paid add-ons.",
    d.escalate !== "none" ? `Escalation required: ${d.escalate}. State the escalation clearly in your reply.` : "",
    d.safetyScript ? `Safety: ${d.safetyScript}` : "",
    ...d.notes.map((n) => `Note: ${n}`),
  ].filter(Boolean);
  return parts.join("\n");
}
