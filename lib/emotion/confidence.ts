import type { ConfidenceCategory } from "../types";

/**
 * Classifies a 0–1 confidence score into the SRD-specified categories (FR-7).
 *
 * Ranges:
 *  - High:   >= 0.80
 *  - Medium: >= 0.50 and < 0.80
 *  - Low:    < 0.50
 */
export function classifyConfidence(score: number): ConfidenceCategory {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}
