/**
 * Commitment Acoustic Index (CAI) Calculator - FR-20
 * 
 * Computes user engagement on a 0-100 scale.
 * 
 * Inputs (Simulated based on SRD):
 * - pitchVariation (0.0 to 1.0): How dynamic the speaker's tone is.
 * - speakingRate (words per minute): 130-150 is normal, <100 is slow, >160 is fast.
 * - interruptions (count): How many times the user interrupted the AI.
 * - pauseDurationMs (ms): Total length of pauses in the turn.
 * - responseLength (words): How long the user's response was.
 */

export interface CAIMetrics {
  pitchVariation: number;   // 0.0 to 1.0
  speakingRate: number;     // WPM (0 to 300+)
  interruptions: number;    // count
  pauseDurationMs: number;  // ms
  responseLength: number;   // words
}

export interface CAIResult {
  score: number;            // 0-100
  category: "Low Engagement" | "Moderate Engagement" | "High Engagement";
  explanation: string;
}

export function calculateCAI(metrics: CAIMetrics): CAIResult {
  let score = 50; // Base baseline score
  const reasons: string[] = [];

  // 1. Pitch Variation (Highly correlated with engagement)
  // High pitch variation adds up to +20, low subtracts up to -20
  if (metrics.pitchVariation > 0.7) {
    score += 15;
    reasons.push("high pitch dynamism");
  } else if (metrics.pitchVariation < 0.3) {
    score -= 15;
    reasons.push("monotone pitch");
  }

  // 2. Speaking Rate (130-160 WPM is engaged/normal, too slow is disengaged)
  if (metrics.speakingRate >= 130 && metrics.speakingRate <= 170) {
    score += 10;
  } else if (metrics.speakingRate < 100) {
    score -= 15;
    reasons.push("slow speaking rate");
  } else if (metrics.speakingRate > 200) {
    score += 5; // Fast speaking can be high emotion/engagement
    reasons.push("rapid speaking rate");
  }

  // 3. Interruptions (High engagement/urgency, but could be negative emotion)
  // For CAI (engagement), interruptions mean they care enough to interrupt.
  if (metrics.interruptions > 0) {
    score += Math.min(metrics.interruptions * 5, 15);
    reasons.push(`${metrics.interruptions} interruptions`);
  }

  // 4. Pause Duration (Long pauses = disengagement or thinking)
  if (metrics.pauseDurationMs > 3000) {
    score -= 10;
    reasons.push("long conversational pauses");
  }

  // 5. Response Length (Short answers "yes", "no" = lower engagement)
  if (metrics.responseLength > 20) {
    score += 15;
    reasons.push("detailed responses");
  } else if (metrics.responseLength < 3) {
    score -= 15;
    reasons.push("minimal response length");
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  let category: CAIResult["category"] = "Moderate Engagement";
  if (score < 30) category = "Low Engagement";
  else if (score >= 70) category = "High Engagement";

  const explanation = reasons.length > 0 
    ? `Score affected by: ${reasons.join(", ")}.`
    : "Average conversational metrics.";

  return { score, category, explanation };
}
