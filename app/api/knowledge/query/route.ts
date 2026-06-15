import type { NextRequest } from "next/server";
import { DEMO, ensureSeeded } from "@/lib/bootstrap";
import { queryKnowledgeBase } from "@/lib/knowledge/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await ensureSeeded();

  const body = (await request.json()) as {
    query?: string;
    clientId?: string;
    topK?: number;
  };

  if (!body.query || body.query.trim().length === 0) {
    return Response.json(
      { error: "query is required" },
      { status: 400 },
    );
  }

  const clientId = body.clientId ?? DEMO.clientId;
  const topK = body.topK ?? 5;

  const results = queryKnowledgeBase({
    clientId,
    query: body.query,
    topK,
  });

  return Response.json({ query: body.query, clientId, results });
}
