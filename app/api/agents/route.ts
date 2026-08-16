import { NextResponse } from "next/server";
import { supabase, probeHealth } from "../../../lib/db/supabase";
import { listPublicAgents } from "../../../lib/db/agents";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents
 *
 * Public, read-only, minimal-field agent listing — powers the "which agent
 * am I testing/calling" selectors on the public /demo page (TestAgentDrawer,
 * PhoneCallDemo). Mirrors /api/tenants' shape and graceful-degradation
 * pattern (empty list, not an error, when Supabase is unreachable), but
 * lists individual custom agents built via /admin/agents rather than whole
 * tenant accounts — an account can now own several.
 */
export async function GET() {
  const healthy = await probeHealth();
  if (!healthy) {
    return NextResponse.json({ agents: [] });
  }

  try {
    const agents = await listPublicAgents(supabase);
    return NextResponse.json({ agents });
  } catch (err) {
    console.error("[/api/agents] Failed to list agents:", err);
    return NextResponse.json({ agents: [] });
  }
}
