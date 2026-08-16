import { NextResponse } from "next/server";
import { supabase, probeHealth } from "../../../lib/db/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenants
 *
 * Public, read-only, minimal-field tenant listing — powers the "which
 * agent am I testing" selector in the live test drawer (TestAgentDrawer).
 * Returns only { id, name, authUserId } — no settings, no documents, no
 * PII — authUserId is what the rest of the app already calls `clientId`
 * (see lib/telephony/stream-handler.ts's tenant lookup by auth_user_id).
 */
export async function GET() {
  const healthy = await probeHealth();
  if (!healthy) {
    return NextResponse.json({ tenants: [] });
  }

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, auth_user_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      return NextResponse.json({ tenants: [] });
    }

    const tenants = data
      .filter((t) => t.auth_user_id)
      .map((t) => ({ id: t.id, name: t.name || "Untitled agent", authUserId: t.auth_user_id }));

    return NextResponse.json({ tenants });
  } catch (err) {
    console.error("[/api/tenants] Failed to list tenants:", err);
    return NextResponse.json({ tenants: [] });
  }
}
