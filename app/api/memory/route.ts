import type { NextRequest } from "next/server";
import { DEMO, ensureSeeded } from "@/lib/bootstrap";
import { stm } from "@/lib/memory/stm";
import { vectorStore } from "@/lib/memory/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  ensureSeeded();
  const url = request.nextUrl;
  const userId = url.searchParams.get("userId") ?? DEMO.userId;
  const clientId = url.searchParams.get("clientId") ?? DEMO.clientId;
  const sessionId = url.searchParams.get("sessionId") ?? DEMO.sessionId;

  return Response.json({
    sizes: vectorStore.size(),
    stm: stm.get(sessionId),
    mtm: vectorStore.byTier("MTM", userId, clientId),
    ltmUser: vectorStore.byTier("LTM_user", userId, clientId),
    ltmClient: vectorStore.byTier("LTM_client", null, clientId),
  });
}
