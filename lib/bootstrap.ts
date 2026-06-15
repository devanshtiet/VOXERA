import { seedClientMemory } from "./memory/writer";
import { vectorStore } from "./memory/store";

let seeded = false;

export const DEMO = {
  clientId: "acme-telecom",
  userId: "user_42",
  sessionId: "session_local",
};

export function ensureSeeded() {
  if (seeded) return;
  if (vectorStore.byTier("LTM_client", null, DEMO.clientId).length > 0) {
    seeded = true;
    return;
  }
  seedClientMemory({
    clientId: DEMO.clientId,
    topic: "brand_voice",
    text: "Brand voice: warm, direct, never defensive. Prefer short sentences. Apologize sincerely when the user is frustrated. Offer concrete next steps.",
  });
  seedClientMemory({
    clientId: DEMO.clientId,
    topic: "compliance",
    text: "Compliance: never disclose account balances without explicit identity confirmation. For distress signals, follow safety-first protocol.",
  });
  seedClientMemory({
    clientId: DEMO.clientId,
    topic: "escalation",
    text: "Escalation matrix: repeated signal complaint with negative valence → route to Tier-2 within 60 seconds. Chronic issues → offer service credit.",
  });
  seeded = true;
}
