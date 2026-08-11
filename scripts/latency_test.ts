import { detectTextEmotion, detectTextEmotionLexicon } from '../lib/emotion/detect';

async function measureLatency() {
  const text = "I'm so incredibly frustrated with this terrible service! It's costing me money!";
  
  console.log("Warming up ML model (Initial boot)...");
  const bootStart = performance.now();
  await detectTextEmotion(text);
  const bootTime = performance.now() - bootStart;
  console.log(`ML Engine initial load time: ${bootTime.toFixed(2)}ms\n`);

  console.log("Running Latency Tests (100 iterations)...\n");

  // Test Lexicon (Free Tier)
  const lexStart = performance.now();
  for (let i = 0; i < 100; i++) {
    detectTextEmotionLexicon(text);
  }
  const lexTime = (performance.now() - lexStart) / 100;

  // Test ML (Premium Tier)
  const mlStart = performance.now();
  for (let i = 0; i < 100; i++) {
    await detectTextEmotion(text);
  }
  const mlTime = (performance.now() - mlStart) / 100;

  console.log("=== LATENCY RESULTS ===");
  console.log(`Lexicon Engine (Fallback/Free):  ${lexTime.toFixed(4)} ms per turn`);
  console.log(`Hybrid ML Engine (Priority/Pro): ${mlTime.toFixed(4)} ms per turn`);
  
  if (mlTime > lexTime) {
    const diff = mlTime / lexTime;
    console.log(`\nNote: The ML Engine is ${diff.toFixed(1)}x slower than the pure regex Lexicon, but provides dramatically higher semantic accuracy.`);
  }
}

measureLatency().catch(console.error);
