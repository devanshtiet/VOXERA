"use client";

import { Cloud, BookOpen, Cpu, AudioLines, Check, Sparkles } from "lucide-react";

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
    final: { label: string; confidence: number; source: string; vad: { v: number; a: number; d: number } };
  };
  totalLatencyMs: number;
}

export interface EmotionHistoryPoint {
  ts: number;
  label: string;
  intensity: number;
}

const STAGES: { key: PipelineStage; label: string; short: string }[] = [
  { key: "recording", label: "Listening", short: "Listen" },
  { key: "transcribing", label: "Transcribing", short: "Transcribe" },
  { key: "thinking", label: "Emotion Engines + LLM", short: "Analyze" },
  { key: "synthesizing", label: "Synthesizing Voice", short: "Synthesize" },
  { key: "speaking", label: "Agent Speaking", short: "Speak" },
];

const STAGE_ORDER: PipelineStage[] = ["recording", "transcribing", "thinking", "synthesizing", "speaking"];

function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function PipelineTracker({ stage }: { stage: PipelineStage }) {
  const active = stageIndex(stage);
  return (
    <div className="flex items-center w-full">
      {STAGES.map((s, i) => {
        const isActive = stage === s.key;
        const isDone = active > i && stage !== "idle";
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none group">
            <div className="flex flex-col items-center gap-1.5 flex-none">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold font-mono transition-all duration-300 ${
                  isActive
                    ? "bg-[var(--console-violet)] text-[#0A0C14] shadow-[0_0_0_4px_rgba(167,139,250,0.2)] scale-110"
                    : isDone
                      ? "bg-[var(--console-cyan)]/15 text-[var(--console-cyan)] border border-[var(--console-cyan)]/40"
                      : "bg-[var(--console-surface)] text-[var(--console-text-dim)] border border-[var(--console-border)]"
                }`}
              >
                {isDone ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className={`text-[9px] font-mono uppercase tracking-wide whitespace-nowrap transition-colors ${
                  isActive ? "text-[var(--console-violet)] font-bold" : isDone ? "text-[var(--console-text)]" : "text-[var(--console-text-dim)]"
                }`}
              >
                {s.short}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-px flex-1 mx-1.5 -mt-4 transition-colors duration-300 ${isDone ? "bg-[var(--console-cyan)]/40" : "bg-[var(--console-border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const ENGINE_META: Record<string, { title: string; icon: React.ReactNode }> = {
  hf: { title: "HuggingFace", icon: <Cloud className="w-3.5 h-3.5" /> },
  lexicon: { title: "Lexicon", icon: <BookOpen className="w-3.5 h-3.5" /> },
  local_onnx: { title: "Local ONNX", icon: <Cpu className="w-3.5 h-3.5" /> },
  acoustic: { title: "Acoustic", icon: <AudioLines className="w-3.5 h-3.5" /> },
};

function engineColor(available: boolean, timedOut?: boolean) {
  if (!available) return "border-[var(--console-border)] bg-[var(--console-surface)]";
  if (timedOut) return "border-amber-500/30 bg-amber-500/[0.06]";
  return "border-[var(--console-cyan)]/30 bg-[var(--console-cyan)]/[0.06]";
}

function EngineCard({ engineKey, d }: { engineKey: keyof typeof ENGINE_META; d: EngineDiagnostic | null }) {
  const meta = ENGINE_META[engineKey];
  if (!d) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--console-border)] p-3.5 flex flex-col items-center justify-center text-center gap-1.5 min-h-[92px]">
        <span className="text-[var(--console-text-dim)]">{meta.icon}</span>
        <div className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--console-text-dim)]">{meta.title}</div>
        <div className="text-[10px] text-[var(--console-text-dim)]">
          {engineKey === "acoustic" ? "no audio input" : "awaiting turn"}
        </div>
      </div>
    );
  }
  const statusColor = !d.available ? "bg-[var(--console-text-dim)]" : d.timedOut ? "bg-amber-500" : "bg-[var(--console-cyan)]";
  return (
    <div className={`rounded-xl border p-3.5 transition-colors ${engineColor(d.available, d.timedOut)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[var(--console-text-dim)]">
          {meta.icon}
          <span className="text-[9.5px] font-mono uppercase tracking-widest">{meta.title}</span>
        </div>
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${d.available && !d.timedOut ? "animate-pulse" : ""}`} />
      </div>
      {d.available ? (
        <>
          <div className="text-[15px] font-bold capitalize text-[var(--console-text)] leading-tight">{d.label}</div>
          <div className="text-[10.5px] text-[var(--console-text-dim)] mt-1">
            {d.confidence !== null ? `${(d.confidence * 100).toFixed(0)}% conf` : ""}
            {d.importance !== null ? ` · ${d.importance.toFixed(2)} imp` : ""}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            {d.memoryClassification && (
              <span className="text-[9px] font-mono uppercase tracking-wide text-[var(--console-text-dim)] px-1.5 py-0.5 rounded bg-[var(--console-surface-raised)] border border-[var(--console-border)]">
                {d.memoryClassification}
              </span>
            )}
            <span className="text-[9px] font-mono text-[var(--console-text-dim)] ml-auto">{d.latencyMs.toFixed(0)}ms</span>
          </div>
          {d.matchedKeywords && d.matchedKeywords.length > 0 && (
            <div className="text-[9px] text-[var(--console-text-dim)] mt-1.5 truncate italic">"{d.matchedKeywords.join(", ")}"</div>
          )}
        </>
      ) : (
        <div className="text-[11px] text-[var(--console-text-dim)] leading-snug">{d.unavailableReason ?? "unavailable"}</div>
      )}
    </div>
  );
}

export function EngineDiagnosticPanel({ diagnostics }: { diagnostics: DiagnosticEmotionResult | null }) {
  if (!diagnostics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <EngineCard engineKey="hf" d={null} />
        <EngineCard engineKey="lexicon" d={null} />
        <EngineCard engineKey="local_onnx" d={null} />
        <EngineCard engineKey="acoustic" d={null} />
      </div>
    );
  }
  const { fusion } = diagnostics;
  return (
    <div className="flex flex-col gap-4">
      {/* Both HF and Lexicon (plus Local ONNX and Acoustic) stay visible here
          regardless of which one was selected below — comparing engines is
          the point of this panel, not just showing the winner. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <EngineCard engineKey="hf" d={diagnostics.hf} />
        <EngineCard engineKey="lexicon" d={diagnostics.lexicon} />
        <EngineCard engineKey="local_onnx" d={diagnostics.localOnnx} />
        <EngineCard engineKey="acoustic" d={diagnostics.acoustic} />
      </div>

      <div>
        <div className="voxera-console-label text-[10px] font-bold mb-2">Final Result</div>
        <div className="flex items-center gap-3 rounded-xl bg-[var(--console-violet)]/[0.08] border border-[var(--console-violet)]/25 px-4 py-3.5">
          <Sparkles className="w-4 h-4 text-[var(--console-violet)] flex-none" />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono uppercase text-[10px] tracking-wide px-1.5 py-0.5 rounded bg-[var(--console-violet)]/20 text-[var(--console-violet)] font-bold">
                {fusion.textSelection.engine} selected
              </span>
              <span className="text-[15px] font-bold capitalize text-[var(--console-text)]">{fusion.final.label}</span>
              <span className="text-[10.5px] text-[var(--console-text-dim)]">
                {(fusion.final.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="text-[11px] text-[var(--console-text-dim)] leading-snug">{fusion.textSelection.reason}</div>
            <div className="text-[9.5px] font-mono text-[var(--console-text-dim)]">
              VAD {fusion.final.vad.v.toFixed(2)} / {fusion.final.vad.a.toFixed(2)} / {fusion.final.vad.d.toFixed(2)}
            </div>
          </div>
        </div>
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
    return (
      <div className="flex items-center justify-center h-12 rounded-lg bg-[var(--console-surface)] border border-dashed border-[var(--console-border)]">
        <span className="text-[10.5px] text-[var(--console-text-dim)]">Emotion trajectory will appear here turn by turn</span>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-[3px] h-12 bg-[var(--console-surface)] rounded-lg p-2 border border-[var(--console-border)]">
      {history.map((p, i) => (
        <div
          key={i}
          title={`${p.label} · ${(p.intensity * 100).toFixed(0)}%`}
          className={`flex-1 min-w-[4px] rounded-sm ${EMOTION_COLOR[p.label] ?? "bg-[var(--console-text-dim)]"}`}
          style={{ height: `${Math.max(8, p.intensity * 100)}%`, opacity: 0.9 }}
        />
      ))}
    </div>
  );
}
