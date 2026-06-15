import type { MemoryRecord, MemoryTier } from "../types";
import { cosine } from "../util/math";

// In-memory vector store. Indexed by tier for cheap scoped queries.
// Swap with pgvector/Qdrant by reimplementing this interface.
const tierStore: Record<MemoryTier, Map<string, MemoryRecord>> = {
  STM: new Map(),
  MTM: new Map(),
  LTM_user: new Map(),
  LTM_client: new Map(),
};

export const vectorStore = {
  put(rec: MemoryRecord) {
    tierStore[rec.tier].set(rec.id, rec);
  },

  get(id: string): MemoryRecord | undefined {
    for (const tier of Object.values(tierStore)) {
      const v = tier.get(id);
      if (v) return v;
    }
    return undefined;
  },

  update(id: string, patch: Partial<MemoryRecord>) {
    const existing = this.get(id);
    if (!existing) return;
    Object.assign(existing, patch);
  },

  byTier(tier: MemoryTier, userId: string | null, clientId: string): MemoryRecord[] {
    const bucket = tierStore[tier];
    const out: MemoryRecord[] = [];
    for (const rec of bucket.values()) {
      if (rec.clientId !== clientId) continue;
      if (userId && tier !== "LTM_client" && rec.userId !== userId) continue;
      out.push(rec);
    }
    return out;
  },

  search(args: {
    tier: MemoryTier;
    userId: string | null;
    clientId: string;
    query: number[];
    topK: number;
  }): Array<{ rec: MemoryRecord; sim: number }> {
    const candidates = this.byTier(args.tier, args.userId, args.clientId);
    const scored = candidates.map((rec) => ({ rec, sim: cosine(args.query, rec.embedding) }));
    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, args.topK);
  },

  nearest(tier: MemoryTier, userId: string, clientId: string, query: number[]): { rec: MemoryRecord; sim: number } | null {
    const top = this.search({ tier, userId, clientId, query, topK: 1 });
    return top[0] ?? null;
  },

  size(): Record<MemoryTier, number> {
    return {
      STM: tierStore.STM.size,
      MTM: tierStore.MTM.size,
      LTM_user: tierStore.LTM_user.size,
      LTM_client: tierStore.LTM_client.size,
    };
  },
};
