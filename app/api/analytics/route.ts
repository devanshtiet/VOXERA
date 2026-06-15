import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SessionEvent } from "../../../lib/logging/session-logger";

export async function GET() {
  const sessionsPath = join(process.cwd(), "data", "sessions");
  const reservationsPath = join(process.cwd(), "data", "reservations.json");
  
  // 1. Process Sessions
  const events: SessionEvent[] = [];
  if (existsSync(sessionsPath)) {
    // In a real app we'd read all files, for this we just read the local session mock
    const localPath = join(sessionsPath, "session_local.jsonl");
    if (existsSync(localPath)) {
      const lines = readFileSync(localPath, "utf-8").split("\n");
      for (const line of lines) {
        if (line.trim()) {
          try {
            const ev = JSON.parse(line) as SessionEvent;
            events.push(ev);
          } catch {}
        }
      }
    }
  }

  // Calculate Metrics from events
  const totalCalls = new Set(events.map(e => e.sessionId)).size;
  
  const emotionEvents = events.filter(e => e.type === "emotion");
  const emotionCounts: Record<string, number> = {};
  emotionEvents.forEach(e => {
    const payload = e.payload as any;
    const label = payload.label || "neutral";
    emotionCounts[label] = (emotionCounts[label] || 0) + 1;
  });

  const toolEvents = events.filter(e => e.type === "tool_invocation");

  // 2. Process Bookings
  let bookings = [];
  if (existsSync(reservationsPath)) {
    try {
      bookings = JSON.parse(readFileSync(reservationsPath, "utf-8"));
    } catch {}
  }
  
  const activeBookings = bookings.filter((b: any) => b.status === "confirmed").length;
  const cancelledBookings = bookings.filter((b: any) => b.status === "cancelled").length;

  return NextResponse.json({
    metrics: {
      totalCalls,
      totalToolInvocations: toolEvents.length,
      activeBookings,
      cancelledBookings,
    },
    emotions: emotionCounts,
    recentEvents: events.slice(-50).reverse() // send last 50 events for timeline
  });
}
