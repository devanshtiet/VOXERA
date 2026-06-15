import { WebSocketServer, WebSocket } from "ws";
import { DeepgramLiveWrapper } from "./lib/deepgram/live";
import { config } from "dotenv";

// Load environment variables since this is run via tsx directly
config({ path: ".env.local" });

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🚀 VOXERA Real-Time Audio Server starting on ws://localhost:${PORT}`);

wss.on("connection", async (ws: WebSocket) => {
  console.log("\n[Server] New client connected.");

  // Initialize Deepgram Live stream wrapper
  const dg = new DeepgramLiveWrapper((text, isFinal) => {
    // When Deepgram gives us text, send it down the WebSocket to the client.
    // In Phase 2, we will route this to the LLM agent instead of just echoing it.
    ws.send(
      JSON.stringify({
        type: isFinal ? "transcript_final" : "transcript_interim",
        text,
      })
    );
    
    if (isFinal) {
      console.log(`[STT] User: "${text}"`);
      // TODO (Phase 2): Send to LLMAgent.handleUserUtterance()
    }
  });

  try {
    await dg.connect();
    ws.send(JSON.stringify({ type: "system", message: "Connected to Deepgram STT engine" }));
  } catch (err) {
    console.error("[Server] Failed to connect to Deepgram:", err);
    ws.send(JSON.stringify({ type: "error", message: "Failed to initialize STT" }));
    ws.close();
    return;
  }

  // Handle incoming messages from the client (usually raw audio buffers)
  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      // It's raw binary audio -> pump to Deepgram
      dg.sendAudio(message);
    } else {
      // Handle text control messages
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch (e) {
        // ignore
      }
    }
  });

  ws.on("close", () => {
    console.log("[Server] Client disconnected.");
    dg.close();
  });

  ws.on("error", (err) => {
    console.error("[Server] Connection error:", err);
    dg.close();
  });
});
