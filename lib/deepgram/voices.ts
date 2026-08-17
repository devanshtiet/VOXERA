/**
 * Deepgram Aura voice catalog — fetched live from `GET /v1/models` and
 * flattened into a static list (Deepgram's voice lineup changes rarely
 * enough that shipping it statically beats a network round-trip on every
 * page load; re-fetch and diff this file if voices are ever added/removed).
 *
 * Aura-2 is the current generation (40 English voices, richer prosody).
 * Aura-1 is kept for backward compatibility with the original 4
 * `CONFIG.deepgram.voicePersonas` keys, which map into this list below.
 */
export interface DeepgramVoice {
  id: string; // full Deepgram model id, e.g. "aura-2-luna-en"
  name: string; // display name, e.g. "Luna"
  generation: "aura-2" | "aura-1";
  accent: string;
  gender: "feminine" | "masculine";
  tags: string[];
}

export const DEEPGRAM_VOICES: DeepgramVoice[] = [
  // Aura-2 (current generation)
  { id: "aura-2-amalthea-en", name: "Amalthea", generation: "aura-2", accent: "Filipino", gender: "feminine", tags: ["engaging", "natural", "cheerful"] },
  { id: "aura-2-andromeda-en", name: "Andromeda", generation: "aura-2", accent: "American", gender: "feminine", tags: ["casual", "expressive", "comfortable"] },
  { id: "aura-2-apollo-en", name: "Apollo", generation: "aura-2", accent: "American", gender: "masculine", tags: ["confident", "comfortable", "casual"] },
  { id: "aura-2-arcas-en", name: "Arcas", generation: "aura-2", accent: "American", gender: "masculine", tags: ["natural", "smooth", "clear", "comfortable"] },
  { id: "aura-2-aries-en", name: "Aries", generation: "aura-2", accent: "American", gender: "masculine", tags: ["warm", "energetic", "caring"] },
  { id: "aura-2-asteria-en", name: "Asteria", generation: "aura-2", accent: "American", gender: "feminine", tags: ["clear", "confident", "knowledgeable", "energetic"] },
  { id: "aura-2-athena-en", name: "Athena", generation: "aura-2", accent: "American", gender: "feminine", tags: ["calm", "smooth", "professional"] },
  { id: "aura-2-atlas-en", name: "Atlas", generation: "aura-2", accent: "American", gender: "masculine", tags: ["enthusiastic", "confident", "approachable", "friendly"] },
  { id: "aura-2-aurora-en", name: "Aurora", generation: "aura-2", accent: "American", gender: "feminine", tags: ["cheerful", "expressive", "energetic"] },
  { id: "aura-2-callista-en", name: "Callista", generation: "aura-2", accent: "American", gender: "feminine", tags: ["clear", "energetic", "professional", "smooth"] },
  { id: "aura-2-cora-en", name: "Cora", generation: "aura-2", accent: "American", gender: "feminine", tags: ["smooth", "melodic", "caring"] },
  { id: "aura-2-cordelia-en", name: "Cordelia", generation: "aura-2", accent: "American", gender: "feminine", tags: ["approachable", "warm", "polite"] },
  { id: "aura-2-delia-en", name: "Delia", generation: "aura-2", accent: "American", gender: "feminine", tags: ["casual", "friendly", "cheerful", "breathy"] },
  { id: "aura-2-draco-en", name: "Draco", generation: "aura-2", accent: "British", gender: "masculine", tags: ["warm", "approachable", "trustworthy", "baritone"] },
  { id: "aura-2-electra-en", name: "Electra", generation: "aura-2", accent: "American", gender: "feminine", tags: ["professional", "engaging", "knowledgeable"] },
  { id: "aura-2-harmonia-en", name: "Harmonia", generation: "aura-2", accent: "American", gender: "feminine", tags: ["empathetic", "clear", "calm", "confident"] },
  { id: "aura-2-helena-en", name: "Helena", generation: "aura-2", accent: "American", gender: "feminine", tags: ["caring", "natural", "positive", "friendly", "raspy"] },
  { id: "aura-2-hera-en", name: "Hera", generation: "aura-2", accent: "American", gender: "feminine", tags: ["smooth", "warm", "professional"] },
  { id: "aura-2-hermes-en", name: "Hermes", generation: "aura-2", accent: "American", gender: "masculine", tags: ["expressive", "engaging", "professional"] },
  { id: "aura-2-hyperion-en", name: "Hyperion", generation: "aura-2", accent: "Australian", gender: "masculine", tags: ["caring", "warm", "empathetic"] },
  { id: "aura-2-iris-en", name: "Iris", generation: "aura-2", accent: "American", gender: "feminine", tags: ["cheerful", "positive", "approachable"] },
  { id: "aura-2-janus-en", name: "Janus", generation: "aura-2", accent: "American", gender: "feminine", tags: ["southern", "smooth", "trustworthy"] },
  { id: "aura-2-juno-en", name: "Juno", generation: "aura-2", accent: "American", gender: "feminine", tags: ["natural", "engaging", "melodic", "breathy"] },
  { id: "aura-2-jupiter-en", name: "Jupiter", generation: "aura-2", accent: "American", gender: "masculine", tags: ["expressive", "knowledgeable", "baritone"] },
  { id: "aura-2-luna-en", name: "Luna", generation: "aura-2", accent: "American", gender: "feminine", tags: ["friendly", "natural", "engaging"] },
  { id: "aura-2-mars-en", name: "Mars", generation: "aura-2", accent: "American", gender: "masculine", tags: ["smooth", "patient", "trustworthy", "baritone"] },
  { id: "aura-2-minerva-en", name: "Minerva", generation: "aura-2", accent: "American", gender: "feminine", tags: ["positive", "friendly", "natural"] },
  { id: "aura-2-neptune-en", name: "Neptune", generation: "aura-2", accent: "American", gender: "masculine", tags: ["professional", "patient", "polite"] },
  { id: "aura-2-odysseus-en", name: "Odysseus", generation: "aura-2", accent: "American", gender: "masculine", tags: ["calm", "smooth", "comfortable", "professional"] },
  { id: "aura-2-ophelia-en", name: "Ophelia", generation: "aura-2", accent: "American", gender: "feminine", tags: ["expressive", "enthusiastic", "cheerful"] },
  { id: "aura-2-orion-en", name: "Orion", generation: "aura-2", accent: "American", gender: "masculine", tags: ["approachable", "comfortable", "calm", "polite"] },
  { id: "aura-2-orpheus-en", name: "Orpheus", generation: "aura-2", accent: "American", gender: "masculine", tags: ["professional", "clear", "confident", "trustworthy"] },
  { id: "aura-2-pandora-en", name: "Pandora", generation: "aura-2", accent: "British", gender: "feminine", tags: ["smooth", "calm", "melodic", "breathy"] },
  { id: "aura-2-phoebe-en", name: "Phoebe", generation: "aura-2", accent: "American", gender: "feminine", tags: ["energetic", "warm", "casual"] },
  { id: "aura-2-pluto-en", name: "Pluto", generation: "aura-2", accent: "American", gender: "masculine", tags: ["smooth", "calm", "empathetic", "baritone"] },
  { id: "aura-2-saturn-en", name: "Saturn", generation: "aura-2", accent: "American", gender: "masculine", tags: ["knowledgeable", "confident", "baritone"] },
  { id: "aura-2-selene-en", name: "Selene", generation: "aura-2", accent: "American", gender: "feminine", tags: ["expressive", "engaging", "energetic"] },
  { id: "aura-2-thalia-en", name: "Thalia", generation: "aura-2", accent: "American", gender: "feminine", tags: ["clear", "confident", "energetic", "enthusiastic"] },
  { id: "aura-2-theia-en", name: "Theia", generation: "aura-2", accent: "Australian", gender: "feminine", tags: ["expressive", "polite", "sincere"] },
  { id: "aura-2-vesta-en", name: "Vesta", generation: "aura-2", accent: "American", gender: "feminine", tags: ["natural", "expressive", "patient", "empathetic"] },
  { id: "aura-2-zeus-en", name: "Zeus", generation: "aura-2", accent: "American", gender: "masculine", tags: ["deep", "trustworthy", "smooth"] },
  // Aura-1 (legacy generation, kept for the original 4 curated personas)
  { id: "aura-angus-en", name: "Angus", generation: "aura-1", accent: "Irish", gender: "masculine", tags: ["casual", "friendly", "patient"] },
  { id: "aura-arcas-en", name: "Arcas", generation: "aura-1", accent: "American", gender: "masculine", tags: ["natural", "smooth", "clear"] },
  { id: "aura-asteria-en", name: "Asteria", generation: "aura-1", accent: "American", gender: "feminine", tags: ["clear", "confident", "knowledgeable"] },
  { id: "aura-athena-en", name: "Athena", generation: "aura-1", accent: "British", gender: "feminine", tags: ["smooth", "calm", "professional"] },
  { id: "aura-helios-en", name: "Helios", generation: "aura-1", accent: "British", gender: "masculine", tags: ["positive", "comfortable", "polite"] },
  { id: "aura-hera-en", name: "Hera", generation: "aura-1", accent: "American", gender: "feminine", tags: ["deep", "smooth", "warm"] },
  { id: "aura-luna-en", name: "Luna", generation: "aura-1", accent: "American", gender: "feminine", tags: ["friendly", "natural", "engaging"] },
  { id: "aura-orion-en", name: "Orion", generation: "aura-1", accent: "American", gender: "masculine", tags: ["approachable", "comfortable", "calm"] },
  { id: "aura-orpheus-en", name: "Orpheus", generation: "aura-1", accent: "American", gender: "masculine", tags: ["clear", "trustworthy", "professional"] },
  { id: "aura-perseus-en", name: "Perseus", generation: "aura-1", accent: "American", gender: "masculine", tags: ["expressive", "melodic", "charismatic"] },
  { id: "aura-stella-en", name: "Stella", generation: "aura-1", accent: "American", gender: "feminine", tags: ["raspy", "engaging", "cheerful"] },
  { id: "aura-zeus-en", name: "Zeus", generation: "aura-1", accent: "American", gender: "masculine", tags: ["deep", "trustworthy", "smooth"] },
];

export function findVoice(id: string): DeepgramVoice | undefined {
  return DEEPGRAM_VOICES.find((v) => v.id === id);
}

/** Deepgram model ids all start with "aura-" — distinguishes a direct model id from a legacy short key like "female-friendly". */
export function isDeepgramModelId(persona: string): boolean {
  return persona.startsWith("aura-");
}
