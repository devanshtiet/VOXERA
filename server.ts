import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import { DeepgramLiveWrapper } from "./lib/deepgram/live";
import { handleTurn } from "./lib/agent/orchestrator";
import { synthesize } from "./lib/deepgram/tts";
import { DEMO, ensureSeeded } from "./lib/bootstrap";
import { config } from "dotenv";

// Load environment variables since this is run via tsx directly
config({ path: ".env.local" });

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🚀 VOXERA Real-Time Audio Server starting on ws://localhost:${PORT}`);

wss.on("connection", async (ws: WebSocket) => {
  console.log("\n[Server] New client connected.");

  const sessionId = `browser-${nanoid(12)}`;
  let isBusy = false; // prevent overlapping turns while a reply is being generated

  await ensureSeeded();

  // Initialize Deepgram Live stream wrapper (16kHz — browser mic default)
  const dg = new DeepgramLiveWrapper((text, isFinal) => {
    ws.send(
      JSON.stringify({
        type: isFinal ? "transcript_final" : "transcript_interim",
        text,
      })
    );

    if (isFinal) {
      void onFinalTranscript(text);
    }
  }, { sampleRate: 16000 });

  async function onFinalTranscript(text: string) {
    if (!text.trim() || isBusy) return;
    isBusy = true;
    ws.send(JSON.stringify({ type: "turn_start" }));

    try {
      console.log(`[STT] User: "${text}"`);
      const output = await handleTurn({
        sessionId,
        userId: DEMO.userId,
        clientId: DEMO.clientId,
        transcript: text,
        sttConfidence: 0.9,
      });

      console.log(`[LLM] Reply: "${output.reply}"`);

      // Send the reply text (and emotion/engine trace for the dashboard)
      // immediately so the transcript feels instant, then synthesize audio.
      ws.send(
        JSON.stringify({
          type: "reply_text",
          text: output.reply,
          trace: output.trace,
        })
      );

      const audio = await synthesize(output.reply, {
        policy: output.trace.policy,
        emotion: output.trace.emotion.current.label,
      });

      ws.send(
        JSON.stringify({
          type: "reply_audio",
          audio: Buffer.from(audio).toString("base64"),
          mime: "audio/mpeg",
        })
      );
    } catch (err) {
      console.error("[Server] Turn error:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Something went wrong generating a reply. Please try again.",
        })
      );
    } finally {
      isBusy = false;
      ws.send(JSON.stringify({ type: "turn_end" }));
    }
  }

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
    console.log(`[Server] Client disconnected (session ${sessionId}).`);
    dg.close();
  });

  ws.on("error", (err) => {
    console.error("[Server] Connection error:", err);
    dg.close();
  });
});
