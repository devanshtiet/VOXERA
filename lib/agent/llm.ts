import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "../config";

export interface LLMReply {
  text: string;
  model: string;
  usedLive: boolean;
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (client) return client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  client = new Anthropic({ apiKey: key });
  return client;
}

export async function generateReply(args: {
  system: string;
  user: string;
}): Promise<LLMReply> {
  const anthropic = getClient();
  if (!anthropic) {
    return { text: offlineFallback(args.user), model: "offline-fallback", usedLive: false };
  }

  const resp = await anthropic.messages.create({
    model: CONFIG.llm.model,
    max_tokens: CONFIG.llm.maxOutputTokens,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return { text, model: CONFIG.llm.model, usedLive: true };
}

// Deterministic canned response used when ANTHROPIC_API_KEY is not set.
// Lets the pipeline run end-to-end in dev without live API access.
function offlineFallback(userBlock: string): string {
  const turnMatch = userBlock.match(/=== CURRENT TURN ===\nUSER: (.+)/);
  const current = turnMatch?.[1] ?? "";
  const lc = current.toLowerCase();
  if (/signal|dropp|outage|coverage/.test(lc)) {
    return "I completely understand — losing signal when you're trying to work is genuinely frustrating. I can see this isn't the first time you've raised it. Let me connect you to a senior specialist who can look into the pattern on your line.";
  }
  if (/charge|bill|refund/.test(lc)) {
    return "I hear you — an unexpected charge is upsetting. I don't want to guess at the details, so let me pull your most recent billing record and walk you through exactly what it is.";
  }
  if (/thank|great|love/.test(lc)) {
    return "Thank you — I'm really glad that helped. Is there anything else I can take care of for you today?";
  }
  return "Thanks for letting me know. To make sure I help you correctly, could you tell me a little more about what you'd like me to do next?";
}
