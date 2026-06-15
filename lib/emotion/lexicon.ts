import type { EmotionLabel, VAD } from "../types";

// Compact lexicon mapping keywords to (label, VAD offset, weight).
// Used by the text emotion detector. Keeps the demo dependency-free.
// VAD in [-1, 1]^3.
export const LEXICON: Array<{
  kw: RegExp;
  label: EmotionLabel;
  vad: VAD;
  w: number;
}> = [
  { kw: /\b(furious|outrag|raging|pissed)/i, label: "anger", vad: { v: -0.8, a: 0.9, d: 0.5 }, w: 1.0 },
  { kw: /\b(angry|mad|annoyed)/i, label: "anger", vad: { v: -0.6, a: 0.7, d: 0.3 }, w: 0.8 },
  { kw: /\b(frustrat|fed up|tired of|again|third time|second time|still)/i, label: "frustration", vad: { v: -0.6, a: 0.6, d: 0.2 }, w: 0.9 },
  { kw: /\b(losing (work|money|business)|can\'t work|costing me)/i, label: "frustration", vad: { v: -0.7, a: 0.7, d: 0.3 }, w: 1.0 },
  { kw: /\b(desperate|help me|emergency|urgent|scared|afraid)/i, label: "distress", vad: { v: -0.8, a: 0.8, d: -0.3 }, w: 1.0 },
  { kw: /\b(suicid|harm myself|end it)/i, label: "distress", vad: { v: -0.95, a: 0.9, d: -0.6 }, w: 1.5 },
  { kw: /\b(sad|down|depressed|miserable|unhappy)/i, label: "sadness", vad: { v: -0.7, a: -0.3, d: -0.2 }, w: 0.8 },
  { kw: /\b(confus|don\'?t understand|not sure|unclear|what do you mean)/i, label: "confusion", vad: { v: -0.2, a: 0.1, d: -0.2 }, w: 0.7 },
  { kw: /\b(thank(s| you)|appreciate|grateful)/i, label: "gratitude", vad: { v: 0.7, a: 0.2, d: 0.1 }, w: 0.8 },
  { kw: /\b(great|amazing|happy|glad|perfect|love it)/i, label: "joy", vad: { v: 0.8, a: 0.5, d: 0.2 }, w: 0.8 },
  { kw: /\b(worried|anxious|nervous)/i, label: "fear", vad: { v: -0.5, a: 0.5, d: -0.3 }, w: 0.7 },
  { kw: /!{2,}/, label: "frustration", vad: { v: -0.3, a: 0.5, d: 0.1 }, w: 0.3 },
];
