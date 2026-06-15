import { handleTurn } from "../lib/agent/orchestrator";
import { DEMO, ensureSeeded } from "../lib/bootstrap";

async function main() {
  await ensureSeeded();

  const turns = [
    "Hi, I think there might be an issue with my signal again.",
    "This is the second time I'm calling about dropped calls — I'm losing work because of this!",
    "THIS IS THE THIRD TIME — I'm furious, nothing ever gets fixed!",
    "Thanks, I appreciate you escalating this.",
  ];

  for (const t of turns) {
    const out = await handleTurn({
      sessionId: DEMO.sessionId,
      userId: DEMO.userId,
      clientId: DEMO.clientId,
      transcript: t,
      sttConfidence: 0.93,
    });
    console.log("\n---\nUSER:", t);
    console.log("AGENT:", out.reply);
    console.log("emotion:", out.trace.emotion.current.label, "intensity:", out.trace.emotion.current.intensity.toFixed(2), "flags:", Object.entries(out.trace.emotion.flags).filter(([, v]) => v).map(([k]) => k));
    console.log("importance:", out.trace.importance.toFixed(2), "write:", out.trace.memoryWrite);
    console.log("policy:", out.trace.policy);
    console.log("retrieved:", out.trace.retrieved);
    if (out.trace.guardReasons.length) console.log("guard:", out.trace.guardReasons);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
