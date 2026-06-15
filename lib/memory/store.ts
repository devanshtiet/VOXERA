import type { MemoryRecord, MemoryTier } from "../types";
import { supabase } from "../db/supabase";

export const vectorStore = {
  async put(rec: MemoryRecord) {
    const { error } = await supabase.from("memories").upsert({
      id: rec.id,
      tier: rec.tier,
      userId: rec.userId,
      clientId: rec.clientId,
      text: rec.text,
      embedding: rec.embedding, // Automatically cast to vector type in Supabase
      metadata: rec.metadata,
      createdAt: rec.createdAt,
    });
    if (error) console.error("[VectorStore] Put Error:", error);
  },

  async get(id: string): Promise<MemoryRecord | undefined> {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("id", id)
      .single();
      
    if (error || !data) return undefined;
    return data as MemoryRecord;
  },

  async update(id: string, patch: Partial<MemoryRecord>) {
    const { error } = await supabase
      .from("memories")
      .update(patch)
      .eq("id", id);
    if (error) console.error("[VectorStore] Update Error:", error);
  },

  async byTier(tier: MemoryTier, userId: string | null, clientId: string): Promise<MemoryRecord[]> {
    let query = supabase
      .from("memories")
      .select("*")
      .eq("tier", tier)
      .eq("clientId", clientId);
      
    if (userId && tier !== "LTM_client") {
      query = query.eq("userId", userId);
    }
    
    const { data, error } = await query;
    if (error || !data) return [];
    return data as MemoryRecord[];
  },

  async search(args: {
    tier: MemoryTier;
    userId: string | null;
    clientId: string;
    query: number[];
    topK: number;
  }): Promise<Array<{ rec: MemoryRecord; sim: number }>> {
    // Uses the Supabase RPC function we will create via SQL
    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: args.query,
      match_threshold: 0.0, // Minimum similarity
      match_count: args.topK,
      filter_tier: args.tier,
      filter_client_id: args.clientId,
      filter_user_id: args.userId,
    });

    if (error) {
      console.error("[VectorStore] Search Error:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      rec: {
        id: row.id,
        tier: row.tier,
        userId: row.userId,
        clientId: row.clientId,
        text: row.text,
        embedding: [], // Omitted from RPC response to save bandwidth
        metadata: row.metadata,
        createdAt: row.createdAt,
      } as MemoryRecord,
      sim: row.similarity,
    }));
  },

  async nearest(
    tier: MemoryTier,
    userId: string,
    clientId: string,
    query: number[]
  ): Promise<{ rec: MemoryRecord; sim: number } | null> {
    const top = await this.search({ tier, userId, clientId, query, topK: 1 });
    return top[0] ?? null;
  },

  async size(): Promise<Record<MemoryTier, number>> {
    // In a real app we'd run an aggregate count query, but for dashboard simplicity
    const { data, error } = await supabase
      .from("memories")
      .select("tier");
      
    const counts = { STM: 0, MTM: 0, LTM_user: 0, LTM_client: 0 };
    if (!error && data) {
      for (const row of data) {
        if (row.tier in counts) counts[row.tier as MemoryTier]++;
      }
    }
    return counts;
  },
};
