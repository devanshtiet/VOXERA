import { nanoid } from "nanoid";
import { CONFIG } from "../config";
import { seedClientMemory } from "../memory/writer";
import { embed } from "../util/embed";
import { vectorStore } from "../memory/store";
import { chunkText } from "./chunk";

export interface IngestResult {
  documentId: string;
  clientId: string;
  chunkCount: number;
  chunkIds: string[];
}

/**
 * Ingests a document into the LTM_client knowledge base.
 *
 * Workflow:
 *  1. Extracts raw text from the buffer (plain text or PDF).
 *  2. Splits the text into overlapping chunks.
 *  3. Embeds each chunk and stores it as an LTM_client memory record
 *     via seedClientMemory().
 *
 * The chunks become searchable by the existing RAG retrieval engine
 * immediately — no additional wiring needed.
 */
export async function ingestDocument(args: {
  clientId: string;
  filename: string;
  content: Buffer | Uint8Array;
  mimeType: string;
}): Promise<IngestResult> {
  const { clientId, filename, mimeType } = args;
  const documentId = nanoid(12);

  // Validate file size.
  if (args.content.byteLength > CONFIG.knowledge.maxFileSizeBytes) {
    throw new Error(
      `File too large: ${args.content.byteLength} bytes (max ${CONFIG.knowledge.maxFileSizeBytes})`,
    );
  }

  // Extract raw text based on mime type.
  let rawText: string;
  if (mimeType === "text/plain") {
    rawText = Buffer.from(args.content).toString("utf-8");
  } else if (mimeType === "application/pdf") {
    rawText = await extractPdfText(args.content);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  if (rawText.trim().length === 0) {
    throw new Error("Document contains no extractable text");
  }

  // Derive a topic from filename (strip extension, normalize).
  const topic = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim() || "knowledge";

  // Chunk the text.
  const chunks = chunkText(rawText);
  const chunkIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = await seedClientMemory({
      clientId,
      topic: `kb:${topic}`,
      text: chunks[i],
      importance: 0.85,
    });
    chunkIds.push(chunkId);
  }

  return { documentId, clientId, chunkCount: chunks.length, chunkIds };
}

/**
 * Queries the LTM_client knowledge base directly.
 * Returns top-K chunks ranked by semantic similarity.
 */
export async function queryKnowledgeBase(args: {
  clientId: string;
  query: string;
  topK?: number;
}): Promise<Array<{ text: string; topic: string; similarity: number; id: string }>> {
  const queryEmbedding = embed(args.query);
  const topK = args.topK ?? 5;
  const results = await vectorStore.search({
    tier: "LTM_client",
    userId: null,
    clientId: args.clientId,
    query: queryEmbedding,
    topK,
  });

  return results.map((r) => ({
    id: r.rec.id,
    text: r.rec.text,
    topic: r.rec.topic,
    similarity: Number(r.sim.toFixed(4)),
  }));
}

/**
 * PDF text extraction. Uses pdf-parse if available, otherwise falls back
 * to a basic text extraction attempt.
 */
async function extractPdfText(content: Buffer | Uint8Array): Promise<string> {
  try {
    // Dynamic import so the module is optional — the rest of the
    // knowledge base still works with plain text files if pdf-parse
    // is not installed.
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const result = await pdfParse(buf);
    return result.text;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") {
      throw new Error(
        "pdf-parse is not installed. Run: npm install pdf-parse",
      );
    }
    throw err;
  }
}
