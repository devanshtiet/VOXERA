import type { NextRequest } from "next/server";
import { hasDeepgram } from "@/lib/deepgram/client";
import { transcribeBuffer } from "@/lib/deepgram/stt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasDeepgram()) {
    return Response.json(
      { error: "DEEPGRAM_API_KEY not configured" },
      { status: 501 },
    );
  }
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength === 0) {
    return Response.json({ error: "empty audio body" }, { status: 400 });
  }
  try {
    const result = await transcribeBuffer(buf, { mimetype: contentType });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
