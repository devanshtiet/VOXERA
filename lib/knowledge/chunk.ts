import { CONFIG } from "../config";

/**
 * Splits a long text into overlapping chunks for embedding and retrieval.
 * Attempts to break on sentence boundaries rather than mid-word.
 */
export function chunkText(
  text: string,
  opts?: { chunkSize?: number; overlap?: number },
): string[] {
  const chunkSize = opts?.chunkSize ?? CONFIG.knowledge.chunkSize;
  const overlap = opts?.overlap ?? CONFIG.knowledge.chunkOverlap;
  const clean = text.replace(/\r\n/g, "\n").trim();

  if (clean.length <= chunkSize) {
    return clean.length > 0 ? [clean] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    // If we are not at the very end, try to break at a sentence boundary.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastSentenceEnd = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf(".\n"),
        slice.lastIndexOf("!\n"),
        slice.lastIndexOf("?\n"),
      );

      // Only use sentence boundary if it's reasonably far into the chunk
      // (at least 40% in) to avoid tiny chunks.
      if (lastSentenceEnd > chunkSize * 0.4) {
        end = start + lastSentenceEnd + 1; // include the punctuation
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // If this chunk reached the end of the document, we're done.
    if (end >= clean.length) break;

    // Advance by (chunkSize - overlap), ensuring forward progress.
    start = end - overlap;
    if (start <= (end - chunkSize + overlap)) {
      // Safety: ensure we always move forward by at least 1 char.
      start = end - overlap + 1;
    }
  }

  return chunks;
}
