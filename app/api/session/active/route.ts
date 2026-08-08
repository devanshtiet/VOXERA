import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/db/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/session/active
 *
 * Fetches recent/active call sessions for real-time admin monitoring.
 */
export async function GET() {
  try {
    const { data: calls, error } = await supabase
      .from("call_logs")
      .select("*")
      .order("startedAt", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[Active Sessions API] Error fetching call_logs:", error);
      return NextResponse.json({ calls: [] });
    }

    return NextResponse.json({ calls: calls || [] });
  } catch (err) {
    console.error("[Active Sessions API] Exception:", err);
    return NextResponse.json({ calls: [] });
  }
}
