import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/db/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/telephony/status
 *
 * Twilio status callback — called when a call changes status
 * (completed, busy, no-answer, failed, etc.)
 *
 * Configure this as the "Status Callback URL" in Twilio console or
 * when initiating outbound calls.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = Object.fromEntries(new URLSearchParams(body));

    const callSid = params.CallSid;
    const callStatus = params.CallStatus; // completed | busy | no-answer | failed | canceled
    const callDuration = params.CallDuration; // seconds (Twilio provides this on completion)

    console.log(`[Telephony/Status] CallSid=${callSid}, status=${callStatus}, duration=${callDuration}s`);

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      completed: "completed",
      busy: "failed",
      "no-answer": "failed",
      failed: "failed",
      canceled: "failed",
    };

    const updates: Record<string, unknown> = {
      status: statusMap[callStatus] || "completed",
      endedAt: Date.now(),
    };

    if (callDuration) {
      updates.durationMs = parseInt(callDuration, 10) * 1000;
    }

    const { error } = await supabase
      .from("call_logs")
      .update(updates)
      .eq("id", callSid);

    if (error) {
      console.error("[Telephony/Status] DB update failed:", error);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telephony/Status] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
