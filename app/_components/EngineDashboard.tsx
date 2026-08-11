"use client";

import { Radio, Zap, Mic2, Brain, Waves } from "lucide-react";

export type PipelineStage = "idle" | "recording" | "transcribing" | "thinking" | "synthesizing" | "speaking";

interface EngineDiagnostic {
  engine: "hf" | "lexicon" | "local_onnx" | "acoustic";
  available: boolean;
  label: string | null;
  confidence: number | null;
  intensity: number | null;
  vad: { v: number; a: number; d: number } | null;
  latencyMs: number;
  timedOut?: boolean;
  matchedKeywords?: string[];
  importance: number | null;
  memoryClassification: string | null;
  unavailableReason?: string;
}

export interface DiagnosticEmotionResult {
  text: string;
  hf: EngineDiagnostic;
  lexicon: EngineDiagnostic;
  localOnnx: EngineDiagnostic;
  acoustic: EngineDiagnostic | null;
  fusion: {
    textSelection: { engine: "hf" | "lexicon"; reason: string };
    final: { label: string; confidence: number; source: string };
  };
  totalLatencyMs: number;
}

export interface EmotionHistoryPoint {
  ts: number;
  label: string;
  intensity: number;
}

const STAGES: { key: PipelineStage; label: string; icon: React.ReactNode }[] = [
  { key: "recording", label: "Listening", icon: <Mic2 className="w-3.5 h-3.5" /> },
  { key: "transcribing", label: "Transcribing (Deepgram)", icon: <Waves className="w-3.5 h-3.5" /> },
  { key: "thinking", label: "Emotion Engines + LLM", icon: <Brain className="w-3.5 h-3.5" /> },
  { key: "synthesizing", label: "Synthesizing Voice", icon: <Radio className="w-3.5 h-3.5" /> },
  { key: "speaking", label: "Agent Speaking", icon: <Zap className="w-3.5 h-3.5" /> },
];

const STAGE_ORDER: PipelineStage[] = ["recording", "transcribing", "thinking", "synthesizing", "speaking"];

function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function PipelineTracker({ stage }: { stage: PipelineStage }) {
  const active = stageIndex(stage);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => {
        const isActive = stage === s.key;
        const isDone = active > i && stage !== "idle";
        return (
          <div
            key={s.key}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10.5px] font-mono font-semibold uppercase tracking-wide transition-all ${
              isActive
                ? "bg-[var(--color-accent-violet)]/15 text-[var(--color-accent-violet)] border border-[var(--color-accent-violet)]/40"
                : isDone
                  ? "bg-[var(--color-bg-base)] text-[var(--color-text-muted)] border border-transparent"
                  : "bg-transparent text-[var(--color-text-muted)]/50 border border-transparent"
            }`}
          >
            <span className={isActive ? "animate-pulse" : ""}>{s.icon}</span>
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

function engineColor(available: boolean, timedOut?: boolean) {
  if (!available) return "text-[var(--color-text-muted)] border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]";
  if (timedOut) return "text-amber-500 border-amber-500/30 bg-amber-500/5";
  return "text-[var(--color-accent-cyan)] border-[var(--color-accent-cyan)]/30 bg-[var(--color-accent-cyan)]/5";
}

function EngineCard({ title, d }: { title: string; d: EngineDiagnostic | null }) {
  if (!d) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] p-3 text-center">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{title}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">no acoustic input</div>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border p-3 ${engineColor(d.available, d.timedOut)}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">{title}</span>
        <span className="text-[9px] font-mono opacity-60">{d.latencyMs.toFixed(0)}ms</span>
      </div>
      {d.available ? (
        <>
          <div className="text-[14px] font-bold capitalize">{d.label}</div>
          <div className="text-[10.5px] opacity-80 mt-0.5">
            conf {(d.confidence ?? 0).toFixed(2)}
            {d.importance !== null ? ` · imp ${d.importance.toFixed(2)}` : ""}
            {d.memoryClassification ? ` · ${d.memoryClassification}` : ""}
          </div>
          {d.matchedKeywords && d.matchedKeywords.length > 0 && (
            <div className="text-[9.5px] opacity-60 mt-1 truncate">kw: {d.matchedKeywords.join(", ")}</div>
          )}
        </>
      ) : (
        <div className="text-[11px] opacity-70">{d.unavailableReason ?? "unavailable"}</div>
      )}
    </div>
  );
}

export function EngineDiagnosticPanel({ diagnostics }: { diagnostics: DiagnosticEmotionResult | null }) {
  if (!diagnostics) {
    return (
      <div className="text-[12px] text-[var(--color-text-muted)] italic px-1">
        Send a turn to see the HF / Lexicon / Local-ONNX / Acoustic engines compared live.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <EngineCard title="HuggingFace" d={diagnostics.hf} />
        <EngineCard title="Lexicon" d={diagnostics.lexicon} />
        <EngineCard title="Local ONNX" d={diagnostics.localOnnx} />
        <EngineCard title="Acoustic" d={diagnostics.acoustic} />
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] px-3 py-2.5">
        <span className="flex-none px-2 py-1 rounded-md bg-[var(--color-accent-violet)]/10 text-[var(--color-accent-violet)] font-mono text-[10.5px] font-bold uppercase">
          {diagnostics.fusion.textSelection.engine} selected
        </span>
        <span className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
          {diagnostics.fusion.textSelection.reason} · fused into <strong className="text-[var(--color-text-primary)] capitalize">{diagnostics.fusion.final.label}</strong>
        </span>
      </div>
    </div>
  );
}

const EMOTION_COLOR: Record<string, string> = {
  anger: "bg-red-500", frustration: "bg-red-400", distress: "bg-red-600",
  sadness: "bg-blue-400", disappointment: "bg-blue-300", fear: "bg-amber-500", confusion: "bg-amber-400",
  joy: "bg-emerald-500", gratitude: "bg-emerald-400", excitement: "bg-emerald-600",
  neutral: "bg-[var(--color-text-muted)]",
};

export function EmotionTimeline({ history }: { history: EmotionHistoryPoint[] }) {
  if (history.length === 0) {
    return <div className="text-[11px] text-[var(--color-text-muted)] italic">No turns yet this session.</div>;
  }
  return (
    <div className="flex items-end gap-[3px] h-12 bg-[var(--color-bg-base)] rounded-lg p-2 border border-[var(--color-border-subtle)]">
      {history.map((p, i) => (
        <div
          key={i}
          title={`${p.label} · ${(p.intensity * 100).toFixed(0)}%`}
          className={`flex-1 min-w-[4px] rounded-sm ${EMOTION_COLOR[p.label] ?? "bg-[var(--color-text-muted)]"}`}
          style={{ height: `${Math.max(8, p.intensity * 100)}%`, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}
