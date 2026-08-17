import { describe, it, expect, vi } from "vitest";
import { createFirstAgent } from "../../lib/db/onboarding";

/** Minimal fake Supabase query-builder chain — supports exactly the methods
 * createFirstAgent()/createAgent() call (select/eq/insert/single), resolving
 * to a pre-programmed result. Each call to db.from() advances to the next
 * queued chain, matching the sequential order the real code issues queries. */
function makeChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function makeDb(results: Array<{ data: any; error: any }>) {
  const queue = results.map(makeChain);
  let i = 0;
  return { from: vi.fn(() => queue[i++]) } as any;
}

const payload = {
  businessName: "Acme Dental",
  agentName: "Front Desk Agent",
  description: "Handles booking and FAQs.",
  systemPrompt: "You are the friendly front desk agent for Acme Dental.",
  greeting: "Hey, thanks for calling Acme Dental!",
  voicePersona: "female-friendly",
};

describe("createFirstAgent — new tenant", () => {
  it("creates a tenant then an agent when no tenant exists yet for this account", async () => {
    const db = makeDb([
      { data: null, error: { code: "PGRST116", message: "no rows" } }, // tenant lookup: not found
      { data: { id: "tenant-1" }, error: null }, // tenant insert
      {
        data: {
          id: "agent-1",
          tenant_id: "tenant-1",
          name: payload.agentName,
          type: "custom",
          status: "active",
          description: payload.description,
          system_prompt: payload.systemPrompt,
          greeting: payload.greeting,
          voice_persona: payload.voicePersona,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      }, // agent insert
    ]);

    const result = await createFirstAgent(db, "user-1", payload);

    expect(result.tenantId).toBe("tenant-1");
    expect(result.agent.id).toBe("agent-1");
    expect(result.agent.system_prompt).toBe(payload.systemPrompt);
    expect(db.from).toHaveBeenCalledWith("tenants");
    expect(db.from).toHaveBeenCalledWith("agents");
  });
});

describe("createFirstAgent — existing tenant", () => {
  it("reuses the existing tenant instead of creating a duplicate", async () => {
    const db = makeDb([
      { data: { id: "tenant-existing" }, error: null }, // tenant lookup: found
      {
        data: {
          id: "agent-2",
          tenant_id: "tenant-existing",
          name: payload.agentName,
          type: "custom",
          status: "active",
          description: payload.description,
          system_prompt: payload.systemPrompt,
          greeting: payload.greeting,
          voice_persona: payload.voicePersona,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      }, // agent insert (no tenant insert call this time)
    ]);

    const result = await createFirstAgent(db, "user-2", payload);

    expect(result.tenantId).toBe("tenant-existing");
    expect(result.agent.id).toBe("agent-2");
    // Exactly 2 .from() calls — no tenant insert — since the tenant already existed.
    expect(db.from).toHaveBeenCalledTimes(2);
  });
});

describe("createFirstAgent — failure paths", () => {
  it("throws a clear error when the agent insert fails", async () => {
    const db = makeDb([
      { data: { id: "tenant-existing" }, error: null },
      { data: null, error: { message: "insert failed" } },
    ]);

    await expect(createFirstAgent(db, "user-3", payload)).rejects.toThrow(/Failed to create agent/);
  });

  it("throws when the tenant lookup fails with a real (non-not-found) error", async () => {
    const db = makeDb([{ data: null, error: { code: "500", message: "db down" } }]);

    await expect(createFirstAgent(db, "user-4", payload)).rejects.toThrow(/Failed to check tenant/);
  });

  it("gives a migration hint when the tenants table doesn't exist yet (PGRST205)", async () => {
    const db = makeDb([
      { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.tenants' in the schema cache" } },
    ]);

    await expect(createFirstAgent(db, "user-5", payload)).rejects.toThrow(/migration_consolidated\.sql/);
  });
});
