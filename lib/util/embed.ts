// Deterministic hashing embedder. Not semantically strong, but allows the
// memory + retrieval pipeline to work without an external embedding service.
// Swap for a real embedder by implementing the same signature.

const DIM = 256;

function hashStr(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function embed(text: string, dim: number = DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  for (const tok of tokens) {
    const i1 = hashStr(tok, 0x9e3779b1) % dim;
    const i2 = hashStr(tok, 0x85ebca6b) % dim;
    const s1 = (hashStr(tok, 0xc2b2ae35) & 1) === 0 ? 1 : -1;
    const s2 = (hashStr(tok, 0x27d4eb2f) & 1) === 0 ? 1 : -1;
    v[i1] += s1;
    v[i2] += s2;
  }
  // L2 normalize
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n);
  if (n === 0) return v;
  for (let i = 0; i < dim; i++) v[i] /= n;
  return v;
}

export const EMBED_DIM = DIM;
