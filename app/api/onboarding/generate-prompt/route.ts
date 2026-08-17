import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/db/server";
import { generateReply } from "../../../../lib/agent/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  businessName: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
});

const GENERATOR_SYSTEM_PROMPT = [
  "You write system prompts for AI voice agents that answer phone calls for real businesses. " +
    "Given a business name and a short description of what the business does and what the agent " +
    "should handle, write a single, ready-to-use system prompt for that specific agent.",
  "",
  "Write it in second person, addressed to the agent (\"You are...\"). Cover: who the agent is and " +
    "which business it represents, its personality/tone, what it should help callers with, and any " +
    "obvious boundaries implied by the description (e.g. don't quote exact prices if none were given, " +
    "don't make medical/legal claims).",
  "",
  "Keep it grounded ONLY in what the description actually says — never invent specific facts, prices, " +
    "hours, or policies that weren't mentioned. If the description is thin, write a shorter, more " +
    "general prompt rather than padding it with invented specifics.",
  "",
  "This prompt will be layered on top of the platform's own core rules and safety behavior (which " +
    "already handle escalation, honesty about unknown facts, and voice-call pacing) — don't restate " +
    "those, focus on what makes THIS agent distinct: its role, personality, and domain focus.",
  "",
  "Output ONLY the prompt text itself — no headers, no markdown, no \"Here's a prompt:\" preamble, no " +
    "quotation marks around it. 3-6 sentences.",
].join("\n");

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

  const { businessName, description } = parsed.data;

  try {
    const reply = await generateReply({
      system: GENERATOR_SYSTEM_PROMPT,
      user: `Business name: ${businessName}\n\nWhat this agent should do: ${description}`,
      clientId: user.id,
      maxOutputTokens: 400,
      useTools: false,
    });

    if (!reply.usedLive) {
      return NextResponse.json(
        { error: "The AI writer is temporarily unavailable — try again in a moment, or write the prompt yourself." },
        { status: 503 }
      );
    }

    return NextResponse.json({ prompt: reply.text.trim() });
  } catch (err) {
    console.error("[/api/onboarding/generate-prompt] Failed:", err);
    return NextResponse.json({ error: "Failed to generate a prompt. Try again or write your own." }, { status: 500 });
  }
}
