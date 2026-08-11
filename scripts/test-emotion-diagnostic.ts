/**
 * Interactive/batch diagnostic CLI for comparing the HF, Lexicon, Local ONNX,
 * and Acoustic emotion engines side-by-side on the same input.
 *
 * Usage:
 *   npx tsx scripts/test-emotion-diagnostic.ts "some text to classify"
 *   npx tsx scripts/test-emotion-diagnostic.ts   (runs the built-in comparison set)
 */
import { runDiagnosticEmotion, type EngineDiagnostic } from "../lib/emotion/emotion-debug";
import type { AcousticFeatures } from "../lib/types";

const BUILT_IN_CASES: Array<{ text: string; acoustic?: AcousticFeatures; note?: string }> = [
  { text: "my pencil broke", note: "neutral/simple wording, no strong lexicon signal" },
  { text: "I am so incredibly frustrated with this terrible service!", note: "clear lexicon match" },
  { text: "oh great, another bug", note: "sarcasm — verify HF catches the negativity a naive lexicon might miss" },
  { text: "I can't believe this", note: "ambiguous — could be positive or negative depending on tone" },
  { text: "thank you so much, this made my day", note: "clear positive" },
  {
    text: "pencil lost",
    note: "Issue #28 validation scenario — neutral words, but the voice is crying",
    acoustic: {
      rmsEnergy: 3600, zeroCrossingRate: 0.1, pitchHz: 350, pitchVariation: 0.6,
      speakingRateWPM: 70, pauseDurationMs: 1200, pauseCount: 4, durationMs: 5000,
      energyModulationRate: 0.7, pitchContour: "unstable",
    },
  },
];

function fmt(d: EngineDiagnostic): string {
  if (!d.available) return `unavailable (${d.unavailableReason ?? "n/a"})`;
  const conf = d.confidence !== null ? d.confidence.toFixed(2) : "-";
  const imp = d.importance !== null ? d.importance.toFixed(2) : "-";
  return `${d.label}  conf=${conf}  imp=${imp}  tier=${d.memoryClassification}  (${d.latencyMs.toFixed(1)}ms)`;
}

async function runOne(text: string, acoustic?: AcousticFeatures, note?: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`TEXT: "${text}"`);
  if (note) console.log(`NOTE: ${note}`);
  console.log("=".repeat(80));

  const result = await runDiagnosticEmotion(text, acoustic);

  console.log(`  HF          ${fmt(result.hf)}`);
  console.log(`  Lexicon     ${fmt(result.lexicon)}${result.lexicon.matchedKeywords?.length ? `  keywords=[${result.lexicon.matchedKeywords.join(", ")}]` : ""}`);
  console.log(`  Local ONNX  ${fmt(result.localOnnx)}`);
  if (result.acoustic) {
    console.log(`  Acoustic    ${fmt(result.acoustic)}`);
  }
  console.log(`  --`);
  console.log(`  Production selection: ${result.fusion.textSelection.engine} (${result.fusion.textSelection.reason})`);
  console.log(`  Final fused: ${result.fusion.final.label}  conf=${result.fusion.final.confidence.toFixed(2)}  source=${result.fusion.final.source}`);
  console.log(`  Total diagnostic latency: ${result.totalLatencyMs.toFixed(1)}ms`);
}

async function main() {
  const argText = process.argv.slice(2).join(" ").trim();

  if (argText) {
    await runOne(argText);
    return;
  }

  console.log(`Running built-in comparison set (${BUILT_IN_CASES.length} cases)...`);
  for (const c of BUILT_IN_CASES) {
    await runOne(c.text, c.acoustic, c.note);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
