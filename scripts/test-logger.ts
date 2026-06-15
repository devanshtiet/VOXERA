import { config } from "dotenv";
config({ path: ".env.local" });

import { logSessionEvent, getSessionLog, makeEvent } from "../lib/logging/session-logger";

async function run() {
  console.log("=== Testing Supabase Session Logger ===");
  try {
    const ev = makeEvent(
      { sessionId: "test-session-123", userId: "test-user", clientId: "test-client" },
      "emotion",
      { label: "happy", confidence: 0.95 }
    );
    
    console.log("Inserting event...");
    await logSessionEvent(ev);

    console.log("Reading events...");
    const logs = await getSessionLog("test-session-123");
    console.log(`Found ${logs.length} logs for session.`);
    console.log(logs);

    console.log("\n✅ Supabase Logging works perfectly!");
  } catch (err) {
    console.error("❌ Test Failed:", err);
  }
}

run();
