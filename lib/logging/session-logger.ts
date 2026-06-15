import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Session event types (FR-21)
// ---------------------------------------------------------------------------

export type SessionEventType =
  | "utterance"
  | "emotion"
  | "memory_write"
  | "retrieval"
  | "policy"
  | "guard"
  | "llm_reply"
  | "tool_invocation";

export interface SessionEvent {
  ts: number;
  sessionId: string;
  userId: string;
  clientId: string;
  type: SessionEventType;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// File-based JSONL logger
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), "data", "sessions");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sessionPath(sessionId: string): string {
  // Sanitize the session ID to prevent path traversal.
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(DATA_DIR, `${safe}.jsonl`);
}

/**
 * Appends a single session event as a JSON line to the session log file.
 */
export function logSessionEvent(event: SessionEvent): void {
  ensureDir();
  const line = JSON.stringify(event) + "\n";
  appendFileSync(sessionPath(event.sessionId), line, "utf-8");
}

/**
 * Reads and parses all events for a given session.
 * Returns an empty array if the session file doesn't exist.
 */
export function getSessionLog(sessionId: string): SessionEvent[] {
  const path = sessionPath(sessionId);
  if (!existsSync(path)) return [];

  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((l) => JSON.parse(l) as SessionEvent);
}

/**
 * Helper to create a session event with common fields pre-filled.
 */
export function makeEvent(
  base: { sessionId: string; userId: string; clientId: string },
  type: SessionEventType,
  payload: Record<string, unknown>,
): SessionEvent {
  return {
    ts: Date.now(),
    sessionId: base.sessionId,
    userId: base.userId,
    clientId: base.clientId,
    type,
    payload,
  };
}
