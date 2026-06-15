import type { ConfidenceCategory } from "../types";

/**
 * Classifies a 0–1 confidence score into the SRD-specified categories (FR-7).
 *
 * Ranges:
 *  - High:   >= 0.80
 *  - Medium: >= 0.50 and < 0.80
 *  - Low:    < 0.50
 */
export function classifyConfidence(confidence: number, params?: { 
  lexiconMatch?: boolean, 
  acousticEnergy?: number 
}): ConfidenceCategory {
  let explanation = "Standard confidence threshold calculation.";
  
  if (params?.lexiconMatch && params?.acousticEnergy && params.acousticEnergy > 0.8) {
    explanation = "High confidence due to strong lexicon match and high vocal energy.";
  } else if (!params?.lexiconMatch && confidence < 0.5) {
    explanation = "Low confidence: weak lexicon match and ambiguous signal.";
  }

  if (confidence >= 0.8) return { level: "high", explanation };
  if (confidence >= 0.5) return { level: "medium", explanation };
  return { level: "low", explanation };
}
