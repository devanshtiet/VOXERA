import { callQueue } from "../lib/queue/manager";
import { calculateCAI } from "../lib/emotion/cai";
import { classifyConfidence } from "../lib/emotion/confidence";

function main() {
  console.log("=== Offline Features Verification ===\n");

  // 1. Queue Manager Test
  console.log("--- 1. Call Queue Manager ---");
  for (let i = 0; i < 5; i++) {
    callQueue.markCallStarted(); // 5 active calls (out of 10 capacity)
  }
  
  callQueue.enqueueCaller("C-101", "555-0001");
  callQueue.enqueueCaller("C-102", "555-0002");
  
  const wait1 = callQueue.getEstimatedWaitTimeMs("C-101");
  const wait2 = callQueue.getEstimatedWaitTimeMs("C-102");
  
  console.log(`Active Calls: ${callQueue.getActiveCallCount()}`);
  console.log(`C-101 Wait Time (ms): ${wait1} (Expected: 0 ms because we have 5 free slots)`);
  
  // Fill all slots
  for (let i = 0; i < 5; i++) {
    callQueue.markCallStarted(); // Now 10 active calls
  }
  
  callQueue.enqueueCaller("C-103", "555-0003");
  const wait3 = callQueue.getEstimatedWaitTimeMs("C-103");
  console.log(`C-103 Wait Time (ms): ${wait3} (Expected: 180000 ms = 3 mins, because 1st in queue but 0 free slots)`);

  // 2. CAI Calculator Test
  console.log("\n--- 2. CAI Scoring ---");
  const engaged = calculateCAI({
    pitchVariation: 0.85,
    speakingRate: 150,
    interruptions: 2,
    pauseDurationMs: 500,
    responseLength: 35
  });
  console.log(`Highly Engaged Caller: Score ${engaged.score} - ${engaged.category}`);
  console.log(`Explanation: ${engaged.explanation}`);

  const disengaged = calculateCAI({
    pitchVariation: 0.1,
    speakingRate: 90,
    interruptions: 0,
    pauseDurationMs: 4000,
    responseLength: 2
  });
  console.log(`Disengaged Caller: Score ${disengaged.score} - ${disengaged.category}`);
  console.log(`Explanation: ${disengaged.explanation}`);

  // 3. Explainability Module Test
  console.log("\n--- 3. Explainability Module ---");
  const conf1 = classifyConfidence(0.92, { lexiconMatch: true, acousticEnergy: 0.85 });
  console.log(`0.92 Confidence: ${conf1.level} -> ${conf1.explanation}`);
  
  const conf2 = classifyConfidence(0.40, { lexiconMatch: false });
  console.log(`0.40 Confidence: ${conf2.level} -> ${conf2.explanation}`);

  console.log("\n✅ Verification complete.");
}

main();
