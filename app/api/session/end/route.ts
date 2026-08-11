import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/db/server";

export const dynamic = "force-dynamic";

const EndSchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = EndSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("call_logs")
      .select("startedAt")
      .eq("id", parsed.data.sessionId)
      .eq("clientId", user.id)
      .maybeSingle();

    const endedAt = Date.now();
    const durationMs = existing?.startedAt ? endedAt - existing.startedAt : null;

    const { error } = await supabase
      .from("call_logs")
      .update({ status: "completed", endedAt, durationMs })
      .eq("id", parsed.data.sessionId)
      .eq("clientId", user.id);

    if (error) {
      console.error("[/api/session/end] update failed:", error);
      return NextResponse.json({ error: "failed to end session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/session/end] Exception:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
