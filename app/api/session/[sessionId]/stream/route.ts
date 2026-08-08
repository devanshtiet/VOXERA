import { NextRequest } from "next/server";
import { redisSub } from "../../../../../lib/redis/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/session/[sessionId]/stream
 *
 * Real-time Server-Sent Events (SSE) endpoint that streams session events
 * (emotion, transcript, CAI, escalation) to the Admin Dashboard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const channel = `session:${sessionId}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`)
      );

      const messageHandler = (ch: string, message: string) => {
        if (ch === channel) {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch (err) {
            console.error(`[SSE Stream] Error enqueuing message for ${sessionId}:`, err);
          }
        }
      };

      try {
        await redisSub.subscribe(channel);
        redisSub.on("message", messageHandler);
      } catch (err) {
        console.error(`[SSE Stream] Redis subscribe error for ${sessionId}:`, err);
      }

      req.signal.addEventListener("abort", () => {
        try {
          redisSub.removeListener("message", messageHandler);
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
