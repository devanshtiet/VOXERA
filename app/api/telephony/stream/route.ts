import { NextRequest } from "next/server";
import { WebSocketServer, WebSocket } from "ws";
import { TelephonyStreamHandler } from "../../../../lib/telephony/stream-handler";

export const dynamic = "force-dynamic";

// Next.js App Router WebSocket upgrade via the CONNECT method on GET.
// We use the `socket` from the underlying Node.js `req` object.
// This follows the Next.js 16 custom WebSocket pattern.

// In-process WebSocket server (one per Node process)
let wss: WebSocketServer | null = null;

function getWss(): WebSocketServer {
  if (!wss) {
    // port: 0 means "don't listen on a port" — we handle upgrades manually
    wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws: WebSocket, req: InstanceType<typeof Request>) => {
      const url = new URL((req as any).url || "", "http://localhost");
      const callSid = url.searchParams.get("callSid") || "unknown";
      const clientId = url.searchParams.get("clientId") || "demo";
      const callerNumber = url.searchParams.get("caller") || "unknown";

      console.log(`[TelephonyStream/WSS] New connection: callSid=${callSid}`);

      // TelephonyStreamHandler takes over from here — full audio loop
      new TelephonyStreamHandler({ ws, callSid, clientId, callerNumber });
    });
  }
  return wss;
}

/**
 * GET /api/telephony/stream
 *
 * Handles WebSocket upgrade for Twilio Media Streams.
 * Twilio opens this WebSocket after receiving our TwiML <Connect><Stream>.
 */
export async function GET(req: NextRequest) {
  // Access the raw Node.js socket via the internal request
  const nodeReq = (req as any).socket ?? (req as any)._socket;

  if (!nodeReq) {
    // Fallback: if running without Node.js socket access (e.g. edge runtime),
    // return a 426 Upgrade Required response
    return new Response("WebSocket upgrade required", {
      status: 426,
      headers: {
        "Upgrade": "websocket",
        "Connection": "Upgrade",
      },
    });
  }

  // Perform WebSocket handshake
  const server = getWss();
  const { socket, head } = nodeReq;

  await new Promise<void>((resolve) => {
    server.handleUpgrade(req as any, socket, head || Buffer.alloc(0), (ws) => {
      server.emit("connection", ws, req);
      resolve();
    });
  });

  // Keep connection open — don't return a Response, the WebSocket takes over
  return new Response(null, { status: 101 });
}
