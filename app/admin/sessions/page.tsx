"use client";

import { useEffect, useState } from "react";

interface SessionSummary {
  sessionId: string;
  eventCount: number;
  lastTs: number;
  dominantEmotion: string;
}

interface SessionEvent {
  type: string;
  ts: number;
  sessionId: string;
  userId: string;
  payload: Record<string, unknown>;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.recentSessions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadSession = async (sessionId: string) => {
    setSelectedSession(sessionId);
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/session/${sessionId}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 font-body min-h-screen">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">Session History</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mt-2">
          Browse past conversations and inspect the full event timeline.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Session List */}
        <div className="w-full md:w-[320px] flex-none">
          <h2 className="text-[11px] font-mono font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-4">Sessions</h2>
          {loading ? (
            <p className="text-[var(--color-text-muted)] text-[13px] animate-pulse">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-[13px] italic">No sessions found.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => loadSession(s.sessionId)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedSession === s.sessionId
                      ? "border-[var(--color-border-active)] bg-[var(--color-bg-surface)] shadow-[0_0_15px_var(--color-accent-glow)]"
                      : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-active)]"
                  }`}
                >
                  <div className="font-mono text-[12px] font-medium text-[var(--color-text-primary)] truncate mb-2">{s.sessionId}</div>
                  <div className="flex gap-2 text-[10px] font-mono font-bold uppercase tracking-widest">
                    <span className="px-2 py-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-accent-cyan)] rounded-md">{s.eventCount} events</span>
                    <span className="px-2 py-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-accent-violet)] rounded-md capitalize">{s.dominantEmotion}</span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-3">{new Date(s.lastTs).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Event Timeline */}
        <div className="flex-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl p-6 lg:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {!selectedSession ? (
            <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-[14px]">
              Select a session to view its event timeline
            </div>
          ) : eventsLoading ? (
            <div className="text-[var(--color-text-muted)] text-[14px] animate-pulse">Loading events...</div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-[11px] font-mono font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-6">
                Timeline — <span className="text-[var(--color-accent-cyan)]">{selectedSession.slice(0, 12)}...</span> ({events.length} events)
              </h2>
              {events.map((ev, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                  <div className="flex-none pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-cyan)] shadow-[0_0_8px_var(--color-accent-cyan)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-[var(--color-text-primary)] capitalize text-[14px]">{ev.type.replace(/_/g, " ")}</span>
                      <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{new Date(ev.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-[12px] text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono break-all bg-[var(--color-bg-base)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
