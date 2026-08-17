"use client";

import { useState } from "react";
import { Wand2, PenLine, Sparkles, Loader2, ArrowLeft, X, AlertCircle } from "lucide-react";
import type { GeneratedAgentDraft } from "./types";

interface CreateAgentDialogProps {
  onClose: () => void;
  onManual: () => void;
  onGenerated: (draft: GeneratedAgentDraft) => void;
}

type Mode = "choose" | "ai";

export function CreateAgentDialog({ onClose, onManual, onGenerated }: CreateAgentDialogProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate an agent.");
      onGenerated(data.agent as GeneratedAgentDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            {mode === "ai" && (
              <button
                onClick={() => setMode("choose")}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display font-bold text-[17px] text-[var(--color-text-primary)]">
              New Agent
            </h2>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {mode === "choose" && (
          <div className="p-6 flex flex-col gap-3">
            <button
              onClick={() => setMode("ai")}
              className="flex items-start gap-3.5 p-4 rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-violet)]/50 hover:bg-[var(--color-bg-base)] text-left transition-all group"
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-accent-violet)]/10 text-[var(--color-accent-violet)] flex-none group-hover:scale-105 transition-transform">
                <Wand2 className="w-5 h-5" />
              </span>
              <span>
                <div className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">Describe it — I'll build it</div>
                <div className="text-[12.5px] text-[var(--color-text-secondary)] mt-0.5">
                  Tell me about your business and what the agent should handle. I'll draft the name,
                  personality, prompt, and greeting for you to review.
                </div>
              </span>
            </button>

            <button
              onClick={onManual}
              className="flex items-start gap-3.5 p-4 rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-cyan)]/50 hover:bg-[var(--color-bg-base)] text-left transition-all group"
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)] flex-none group-hover:scale-105 transition-transform">
                <PenLine className="w-5 h-5" />
              </span>
              <span>
                <div className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">Start from scratch</div>
                <div className="text-[12.5px] text-[var(--color-text-secondary)] mt-0.5">
                  Write the name, prompt, and everything else yourself, from a blank agent.
                </div>
              </span>
            </button>
          </div>
        )}

        {mode === "ai" && (
          <div className="p-6 flex flex-col gap-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                Describe your business and this agent's job
              </label>
              <textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="e.g. We're a dental clinic called Acme Dental. This agent should answer calls, help patients book or reschedule appointments, answer basic questions about our services and hours, and offer to connect a caller to the front desk for anything urgent."
                className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-violet)] focus:border-[var(--color-accent-violet)] text-[13.5px] text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)] resize-none"
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-500 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-none" /> {error}
              </p>
            )}

            <button
              onClick={generate}
              disabled={generating || !description.trim()}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl btn-gradient text-white text-[13.5px] font-semibold shadow-[0_0_15px_var(--color-accent-glow)] transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Building your agent…" : "Generate Agent"}
            </button>
            <p className="text-[11.5px] text-[var(--color-text-muted)] text-center -mt-1">
              You'll get to review and edit everything before it's saved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
