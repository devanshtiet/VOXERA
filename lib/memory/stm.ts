import { CONFIG } from "../config";
import type { Utterance } from "../types";

// Per-session ring buffer. In prod, back with Redis keyed by sessionId.
const sessions = new Map<string, Utterance[]>();

export const stm = {
  push(sessionId: string, u: Utterance) {
    const arr = sessions.get(sessionId) ?? [];
    arr.push(u);
    const max = CONFIG.memory.stmMaxTurns;
    if (arr.length > max) arr.splice(0, arr.length - max);
    sessions.set(sessionId, arr);
  },
  get(sessionId: string): Utterance[] {
    return sessions.get(sessionId) ?? [];
  },
  clear(sessionId: string) {
    sessions.delete(sessionId);
  },
};
