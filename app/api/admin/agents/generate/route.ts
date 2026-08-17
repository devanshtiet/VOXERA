import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../../lib/db/server";
import { generateReply } from "../../../../../lib/agent/llm";
import type { GeneratedAgentDraft } from "../../../../admin/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  description: z.string().min(1).max(2000),
});

const GENERATOR_SYSTEM_PROMPT = [
  "You design complete AI voice agents for real businesses from a short description. Given a " +
    "description of a business and what its phone agent should handle, invent a full agent profile.",
  "",
  "Output ONLY a single JSON object, no markdown code fences, no prose before or after it, with " +
    "exactly these four string fields:",
  '{"name": "...", "description": "...", "system_prompt": "...", "greeting": "..."}',
  "",
  "- name: a short, natural agent name (e.g. \"Front Desk Concierge\", \"Bella\") — a name a real " +
    "business would actually use, not a generic label like \"AI Assistant\".",
  "- description: one sentence summarizing what this agent does, shown in a list of agents.",
  "- system_prompt: written in second person (\"You are...\"), covering who the agent is, its " +
    "personality/tone, and what it should help callers with. Grounded ONLY in what the description " +
    "actually says — never invent specific prices, hours, or policies that weren't mentioned. This " +
    "prompt is layered on top of the platform's own core safety/escalation rules, which already " +
    "handle those — focus on what makes this agent distinct. 3-6 sentences.",
  "- greeting: a short, natural first line the agent would say when answering a call — one sentence, " +
    "no more than ~15 words, matching the personality of the system_prompt.",
].join("\n");

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  // Strip a ```json ... ``` or ``` ... ``` fence if the model added one
  // despite being told not to — cheap models don't always comply.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const reply = await generateReply({
      system: GENERATOR_SYSTEM_PROMPT,
      user: parsed.data.description,
      clientId: user.id,
      maxOutputTokens: 500,
      useTools: false,
    });

    if (!reply.usedLive) {
      return NextResponse.json(
        { error: "The AI builder is temporarily unavailable — try again in a moment, or build it manually." },
        { status: 503 }
      );
    }

    let draft: Partial<GeneratedAgentDraft>;
    try {
      draft = JSON.parse(extractJson(reply.text));
    } catch {
      return NextResponse.json(
        { error: "The AI builder returned something unexpected — try again, or build it manually." },
        { status: 502 }
      );
    }

    if (!draft.name || !draft.system_prompt) {
      return NextResponse.json(
        { error: "The AI builder's draft was incomplete — try again, or build it manually." },
        { status: 502 }
      );
    }

    const result: GeneratedAgentDraft = {
      name: String(draft.name).slice(0, 80),
      description: String(draft.description ?? "").slice(0, 280),
      system_prompt: String(draft.system_prompt).slice(0, 6000),
      greeting: String(draft.greeting ?? "").slice(0, 500),
    };

    return NextResponse.json({ agent: result });
  } catch (err) {
    console.error("[/api/admin/agents/generate] Failed:", err);
    return NextResponse.json({ error: "Failed to generate an agent. Try again or build it manually." }, { status: 500 });
  }
}
