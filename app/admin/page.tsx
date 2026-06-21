"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface AnalyticsData {
  metrics: {
    totalCalls: number;
    totalToolInvocations: number;
    activeBookings: number;
    cancelledBookings: number;
    escalations: number;
    avgCai: number;
    // Telephony (Sprint 1)
    totalPhoneCalls: number;
    activeCalls: number;
    callQueueLength: number;
    avgCallDurationMs: number;
  };
  emotions: Record<string, number>;
  recentEvents: Array<{
    type: string;
    ts: number;
    sessionId: string;
    payload: Record<string, unknown>;
  }>;
  recentSessions: Array<{
    sessionId: string;
    eventCount: number;
    lastTs: number;
    dominantEmotion: string;
  }>;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return (
    <div className="p-8 md:p-10 font-body">
      <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-6 rounded-2xl">
        <h2 className="font-bold mb-2">Failed to load analytics</h2>
        <p className="text-[14px]">{error}</p>
        <p className="mt-4 text-[13px] text-red-500/70">Tip: Make sure the SQL migration has been run in your Supabase SQL Editor.</p>
      </div>
    </div>
  );

  if (!data) return <div className="p-8 md:p-10 font-body text-[var(--color-text-muted)] animate-pulse">Loading Analytics...</div>;

  const m = data.metrics;
  const emotions = data.emotions ?? {};
  const recentEvents = data.recentEvents ?? [];
  const recentSessions = data.recentSessions ?? [];

  return (
    <div className="min-h-screen p-6 md:p-10 font-body">
      <header className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)] tracking-tight">VOXERA Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] mt-2 text-[15px]">Real-time Analytics & Session Monitoring</p>
      </header>

      {/* Setup Checklist (For new users) */}
      {m.totalCalls === 0 && (
        <div className="bg-[var(--color-bg-elevated)] rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] border border-[var(--color-border-active)] p-6 md:p-8 mb-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[var(--color-accent-violet)] to-[var(--color-accent-cyan)]" />
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Welcome to your workspace</h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mb-8">Complete these steps to deploy your AI agent.</p>
          <div className="grid sm:grid-cols-3 gap-6">
            <ChecklistItem title="Create Business Profile" desc="Completed during onboarding" done={true} />
            <ChecklistItem title="Upload Knowledge" desc="Add FAQs and policies" done={false} href="/admin/knowledge" />
            <ChecklistItem title="Configure Phone Routing" desc="Connect Twilio number" done={false} href="/admin/settings" />
          </div>
        </div>
      )}

      {/* KPI Cards — Core */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Total Sessions" value={m.totalCalls} color="text-[var(--color-accent-cyan)]" />
        <KpiCard label="Tool Calls" value={m.totalToolInvocations} color="text-[var(--color-accent-violet)]" />
        <KpiCard label="Escalations" value={m.escalations} color="text-amber-400" />
        <KpiCard label="Active Bookings" value={m.activeBookings} color="text-emerald-400" />
        <KpiCard label="Cancelled" value={m.cancelledBookings} color="text-red-400" />
        <KpiCard label="Avg CAI" value={m.avgCai} color="text-[var(--color-text-primary)]" suffix="/100" />
      </div>

      {/* Telephony KPI Cards — Sprint 1 */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-[12px] font-mono font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Live Telephony</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Phone Calls"
            value={m.totalPhoneCalls ?? 0}
            color="text-[var(--color-accent-cyan)]"
          />
          <KpiCard
            label="Active Calls"
            value={m.activeCalls ?? 0}
            color="text-emerald-400"
            live
          />
          <KpiCard
            label="Queue Length"
            value={m.callQueueLength ?? 0}
            color="text-amber-400"
            live
          />
          <KpiCard
            label="Avg Duration"
            value={m.avgCallDurationMs ? Math.round((m.avgCallDurationMs ?? 0) / 1000) : 0}
            color="text-[var(--color-accent-violet)]"
            suffix="s"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Emotion Distribution */}
        <div className="bg-[var(--color-bg-elevated)] rounded-2xl border border-[var(--color-border-subtle)] p-6 lg:p-8">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-6">Emotion Distribution</h2>
          <div className="space-y-4">
            {Object.entries(emotions).length > 0 ? (
              Object.entries(emotions)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([emotion, count]) => {
                  const total = Object.values(emotions).reduce((s, c) => s + (c as number), 0);
                  const pct = total > 0 ? Math.round(((count as number) / total) * 100) : 0;
                  return (
                    <div key={emotion}>
                      <div className="flex justify-between text-[13px] mb-2 font-medium">
                        <span className="capitalize text-[var(--color-text-primary)]">{emotion}</span>
                        <span className="text-[var(--color-text-secondary)]">{String(count)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-[var(--color-bg-base)] rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-[var(--color-accent-violet)] to-[var(--color-accent-cyan)] h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-[var(--color-text-muted)] text-[13px] italic">No emotion data yet.</p>
            )}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-[var(--color-bg-elevated)] rounded-2xl border border-[var(--color-border-subtle)] p-6 lg:p-8">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-6">Recent Sessions</h2>
          <div className="space-y-3">
            {recentSessions.length > 0 ? (
              recentSessions.map((s) => (
                <Link href="/admin/sessions" key={s.sessionId} className="block p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-border-active)] transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-[12px] text-[var(--color-text-primary)] truncate max-w-[140px]">{s.sessionId}</span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">{new Date(s.lastTs).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] font-mono uppercase tracking-widest font-bold">
                    <span className="px-2 py-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-accent-cyan)] rounded-md">{s.eventCount} events</span>
                    <span className="px-2 py-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-accent-violet)] rounded-md capitalize">{s.dominantEmotion}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-[var(--color-text-muted)] text-[13px] italic">No sessions recorded yet.</p>
            )}
          </div>
        </div>

        {/* Event Timeline */}
        <div className="bg-[var(--color-bg-elevated)] rounded-2xl border border-[var(--color-border-subtle)] p-6 lg:p-8">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-6">Recent Events</h2>
          <div className="overflow-y-auto h-[400px] pr-2 space-y-3 hide-scrollbar">
            {recentEvents.length > 0 ? (
              recentEvents.map((ev, i) => (
                <div key={i} className="flex gap-3 p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                  <div className="flex-none">
                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-[10px] font-bold ${eventColor(ev.type)}`}>
                      {ev.type.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold text-[var(--color-text-primary)] capitalize text-[13px]">{ev.type.replace(/_/g, " ")}</span>
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{new Date(ev.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-[11px] text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono break-all bg-[var(--color-bg-base)] p-2.5 rounded-lg border border-[var(--color-border-subtle)] max-h-24 overflow-hidden">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[var(--color-text-muted)] text-[13px] italic">No recent events.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, suffix, live }: { label: string; value: number; color: string; suffix?: string; live?: boolean }) {
  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-2xl border border-[var(--color-border-subtle)] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
      {live && (
        <span className="absolute top-3 right-3 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Live</span>
        </span>
      )}
      <h3 className="text-[11px] font-mono font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-3">{label}</h3>
      <p className={`font-display text-4xl font-extrabold ${color}`}>
        {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}
        {suffix && <span className="text-[16px] font-medium text-[var(--color-text-muted)] ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function ChecklistItem({ title, desc, done, href }: { title: string, desc: string, done: boolean, href?: string }) {
  return (
    <div className={`p-5 rounded-xl border ${done ? "bg-[var(--color-bg-base)] border-[var(--color-border-subtle)]" : "bg-[var(--color-bg-surface)] border-[var(--color-border-active)] shadow-[0_0_15px_var(--color-accent-glow)]"}`}>
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" /> : <Circle className="w-5 h-5 text-[var(--color-accent-cyan)] mt-0.5" />}
        <div>
          <h4 className={`text-[14px] font-semibold ${done ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"}`}>{title}</h4>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-1">{desc}</p>
          {!done && href && (
            <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-accent-cyan)] mt-3 hover:text-white transition-colors">
              Start <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function eventColor(type: string): string {
  switch (type) {
    case "utterance": return "bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)]";
    case "emotion": return "bg-[var(--color-accent-violet)]/10 text-[var(--color-accent-violet)]";
    case "memory_write": return "bg-emerald-500/10 text-emerald-400";
    case "retrieval": return "bg-amber-500/10 text-amber-400";
    case "policy": return "bg-orange-500/10 text-orange-400";
    case "escalation": return "bg-red-500/10 text-red-400";
    case "cai": return "bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)]";
    case "tool_invocation": return "bg-teal-500/10 text-teal-400";
    case "guard": return "bg-[var(--color-bg-base)] text-[var(--color-text-secondary)]";
    case "llm_reply": return "bg-[var(--color-accent-violet)]/10 text-[var(--color-accent-violet)]";
    default: return "bg-[var(--color-bg-base)] text-[var(--color-text-secondary)]";
  }
}
