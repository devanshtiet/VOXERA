import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import { DeepgramLiveWrapper } from "./lib/deepgram/live";
import { handleTurn } from "./lib/agent/orchestrator";
import { synthesize } from "./lib/deepgram/tts";
import { extractAcousticFeatures } from "./lib/audio/acoustic";
import { DEMO, ensureSeeded } from "./lib/bootstrap";
import { config } from "dotenv";

// Belt-and-suspenders env loading: `npm run server` passes `--env-file=.env.local`
// to tsx/node directly, which is what actually matters — ES module imports are
// hoisted and run before any top-level statement in this file, so module-level
// singletons that read process.env at import time (e.g. lib/util/keys.ts's
// KeyRotator, imported transitively via handleTurn below) would otherwise
// permanently capture an empty env var if dotenv only loaded here.
config({ path: ".env.local" });

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🚀 VOXERA Real-Time Audio Server starting on ws://localhost:${PORT}`);

/**
 * The browser mic streams 16kHz linear16 PCM, but lib/audio/acoustic.ts's
 * feature extraction (pitch lag range, frame sizes) is tuned for Twilio's
 * 8kHz telephony audio — the same DSP real calls use. Downsample 2:1 rather
 * than re-parametrizing that module, so the acoustic engine itself stays
 * exactly what real calls exercise (and keeps its existing test suite valid).
 */
function downsample16kTo8k(pcm: Buffer): Buffer {
  const inSamples = Math.floor(pcm.length / 2);
  const outSamples = Math.floor(inSamples / 2);
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    out.writeInt16LE(pcm.readInt16LE(i * 4), i * 2);
  }
  return out;
}

wss.on("connection", async (ws: WebSocket) => {
  console.log("\n[Server] New client connected.");

  const sessionId = `browser-${nanoid(12)}`;
  let isBusy = false; // prevent overlapping turns while a reply is being generated

  // Bumped on every user-initiated barge-in. A reply that started synthesizing
  // before the bump is stale by the time it resolves — drop it instead of
  // playing audio over what the user is now saying.
  let generation = 0;
  let turnAudioChunks: Buffer[] = [];

  // Initialize Deepgram Live stream wrapper (16kHz — browser mic default)
  const dg = new DeepgramLiveWrapper((text, isFinal) => {
    // Diagnostic: log every transcript Deepgram produces, not just finals,
    // so we can tell "Deepgram is receiving audio but never finalizing" apart
    // from "no audio is reaching Deepgram at all."
    console.log(`[STT ${isFinal ? "FINAL" : "interim"}] "${text}"`);

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
    const myGeneration = generation;
    ws.send(JSON.stringify({ type: "turn_start" }));

    const turnPcm = Buffer.concat(turnAudioChunks);
    turnAudioChunks = [];

    try {
      console.log(`[STT] User: "${text}"`);

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const acousticFeatures = turnPcm.length > 0
        ? extractAcousticFeatures(downsample16kTo8k(turnPcm), wordCount)
        : undefined;

      const output = await handleTurn({
        sessionId,
        userId: DEMO.userId,
        clientId: DEMO.clientId,
        transcript: text,
        sttConfidence: 0.9,
        acousticFeatures,
        // Full per-engine breakdown (HF/Lexicon/Local ONNX/Acoustic) so the
        // live test drawer can show the same diagnostics the Text demo does,
        // not just the fused label.
        diagnostics: true,
      });

      if (myGeneration !== generation) {
        // A barge-in happened while this turn was being generated — the
        // user has already moved on, don't speak a stale reply.
        console.log(`[Server] Dropping stale reply (generation ${myGeneration} != ${generation}).`);
        return;
      }

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

      if (myGeneration !== generation) {
        console.log(`[Server] Dropping stale reply audio (generation ${myGeneration} != ${generation}).`);
        return;
      }

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

  // Diagnostic: confirm audio frames are actually arriving from the browser,
  // and that DeepgramLiveWrapper's internal state is "connected" when we try
  // to forward them (sendAudio silently drops frames otherwise).
  let audioChunkCount = 0;
  let audioByteCount = 0;

  // Start connecting to Deepgram immediately (not awaited yet) and register
  // every ws event handler in this same synchronous tick — before awaiting
  // anything. Node's EventEmitter drops events fired before a listener is
  // attached, and a real client starts sending audio the instant the socket
  // opens; if `ensureSeeded()`/`dg.connect()` were awaited first (as this used
  // to do), any audio sent during that window — a real network round trip to
  // Deepgram, not instant — was silently lost. DeepgramLiveWrapper.sendAudio()
  // already buffers audio while its state is "connecting" (used for its own
  // reconnect logic), so it's safe to start receiving before `connect()`
  // resolves — connect() sets state="connecting" synchronously as its very
  // first action, before this line yields to the event loop.
  const dgConnectPromise = dg.connect();

  // Handle incoming messages from the client (usually raw audio buffers)
  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      audioChunkCount++;
      audioByteCount += message.length;
      if (audioChunkCount === 1) {
        console.log(`[Server] First audio chunk received (${message.length} bytes, dg state=${dg.getState()}).`);
      } else if (audioChunkCount % 50 === 0) {
        console.log(`[Server] ${audioChunkCount} audio chunks received (${audioByteCount} bytes total, dg state=${dg.getState()}).`);
      }
      // It's raw binary audio -> pump to Deepgram, and accumulate for
      // turn-level acoustic feature extraction.
      try {
        dg.sendAudio(message);
      } catch (err) {
        console.error(`[Server] dg.sendAudio threw on chunk ${audioChunkCount}:`, err);
      }
      turnAudioChunks.push(message);
    } else {
      // Handle text control messages
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        } else if (payload.type === "barge_in") {
          // Client-side VAD detected the user talking over the agent's
          // reply — invalidate whatever's in flight and start a fresh turn.
          generation++;
          isBusy = false;
          turnAudioChunks = [];
          console.log(`[Server] Barge-in — generation now ${generation}.`);
        }
      } catch (e) {
        // ignore
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[Server] Client disconnected (session ${sessionId}), code=${code}, reason="${reason.toString()}", audioChunksReceived=${audioChunkCount}.`);
    dg.close();
  });

  ws.on("error", (err) => {
    console.error("[Server] Connection error:", err);
    dg.close();
  });

  // Now that every handler above is attached and Deepgram is already
  // connecting, it's safe to await the slower setup steps.
  try {
    await ensureSeeded();
    await dgConnectPromise;
    ws.send(JSON.stringify({ type: "system", message: "Connected to Deepgram STT engine" }));
  } catch (err) {
    console.error("[Server] Failed to connect to Deepgram:", err);
    ws.send(JSON.stringify({ type: "error", message: "Failed to initialize STT" }));
    ws.close();
  }
});
