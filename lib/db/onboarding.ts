import type { SupabaseClient } from "@supabase/supabase-js";
import { createAgent, type AgentRecord } from "./agents";

export interface CreateFirstAgentPayload {
  /** Used for the tenant row when this is the account's first agent — later
   * agents under the same account don't touch the tenant name again. */
  businessName: string;
  agentName: string;
  description?: string;
  systemPrompt: string;
  greeting?: string;
  voicePersona?: string;
}

export interface CreateFirstAgentResult {
  tenantId: string;
  agent: AgentRecord;
}

/**
 * Onboarding's whole job, replacing the old multi-field business-profile
 * wizard (industry/workflow/operating-hours/plan): make sure this account
 * has a tenant row, then create an agent under it with the prompt the user
 * wrote or generated. Everything about how that agent actually talks lives
 * on the agents row itself (lib/db/agents.ts) — no separate business_settings
 * write, since each agent under an account can now have its own voice/
 * greeting/prompt instead of one shared config for the whole account.
 */
export async function createFirstAgent(
  db: SupabaseClient,
  userId: string,
  payload: CreateFirstAgentPayload
): Promise<CreateFirstAgentResult> {
  const { data: existingTenant, error: tErr } = await db
    .from("tenants")
    .select("id")
    .eq("auth_user_id", userId)
    .single();

  if (tErr && tErr.code !== "PGRST116") {
    // PGRST116 = "no rows found", expected for a brand-new account — any
    // other error here is a real failure worth surfacing. PGRST205
    // specifically means PostgREST can't find the table at all — almost
    // always because sql/migration_v2.sql (which creates `tenants`) was
    // never run against this Supabase project, not a bug in this code.
    const hint =
      tErr.code === "PGRST205"
        ? " — the `tenants` table doesn't exist in this Supabase project yet. Run sql/migration.sql " +
          "through sql/migration_v11.sql, in order, in the Supabase SQL Editor."
        : "";
    throw new Error(`Failed to check tenant: ${tErr.message}${hint}`);
  }

  let tenantId: string;
  if (existingTenant) {
    tenantId = existingTenant.id;
  } else {
    const { data: newTenant, error: insertErr } = await db
      .from("tenants")
      .insert({ auth_user_id: userId, name: payload.businessName })
      .select("id")
      .single();
    if (insertErr || !newTenant) {
      throw new Error(`Failed to create tenant: ${insertErr?.message}`);
    }
    tenantId = newTenant.id;
  }

  const agent = await createAgent(db, tenantId, {
    name: payload.agentName,
    description: payload.description,
    system_prompt: payload.systemPrompt,
    greeting: payload.greeting,
    voice_persona: payload.voicePersona,
  });

  if (!agent) {
    throw new Error("Failed to create agent");
  }

  return { tenantId, agent };
}
