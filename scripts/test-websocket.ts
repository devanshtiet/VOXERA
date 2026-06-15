import { WebSocket } from "ws";
import * as fs from "node:fs";

// To test this script, first run the server:
// npm run server

const WS_URL = "ws://localhost:3001";
console.log(`Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Connected to server.");
  
  // Create a dummy buffer simulating 1 second of silent 16kHz linear16 audio
  // 16000 samples * 2 bytes/sample = 32000 bytes
  const dummyAudio = Buffer.alloc(32000);
  
  // Deepgram needs some actual audio signal to trigger a transcript,
  // pure silence might not emit a transcript depending on settings. 
  // We'll just stream it up to test the connection.
  console.log("Sending dummy audio buffer...");
  ws.send(dummyAudio);

  setTimeout(() => {
    console.log("Closing connection after 3 seconds...");
    ws.close();
  }, 3000);
});

ws.on("message", (data) => {
  console.log("Received from server:", data.toString());
});

ws.on("close", () => {
  console.log("Connection closed.");
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err);
});
