import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createFirstAgent } from "@/lib/db/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateAgentSchema = z.object({
  businessName: z.string().min(1).max(120),
  agentName: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1).max(6000),
  greeting: z.string().max(500).optional(),
  voicePersona: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (!user || authErr) {
    return NextResponse.json(
      { error: "You must be logged in to create an agent." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid fields.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await createFirstAgent(supabase, user.id, parsed.data);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Onboarding API Error]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
