"use client";

import { useState } from "react";
import { MessageSquare, AudioLines, PhoneCall } from "lucide-react";
import { VoiceAgent } from "./VoiceAgent";
import { AcousticDemo } from "./AcousticDemo";
import { PhoneCallDemo } from "./PhoneCallDemo";

type DemoMode = "text" | "acoustic" | "phone";

const MODES: { key: DemoMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "text", label: "Text", desc: "HF + Lexicon engines", icon: <MessageSquare className="w-4 h-4" /> },
  { key: "acoustic", label: "Acoustic", desc: "Microphone + voice analysis", icon: <AudioLines className="w-4 h-4" /> },
  { key: "phone", label: "Phone Call", desc: "Real call, live transcript", icon: <PhoneCall className="w-4 h-4" /> },
];

export function DemoModeSwitcher() {
  const [mode, setMode] = useState<DemoMode>("text");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-4 text-center transition-all ${
              mode === m.key
                ? "bg-[var(--color-accent-violet)]/10 border-[var(--color-accent-violet)]/50 shadow-[0_0_20px_var(--color-accent-glow)]"
                : "bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-active)]"
            }`}
          >
            <span className={mode === m.key ? "text-[var(--color-accent-violet)]" : "text-[var(--color-text-secondary)]"}>{m.icon}</span>
            <span className={`text-[13px] font-bold ${mode === m.key ? "text-[var(--color-accent-violet)]" : "text-[var(--color-text-primary)]"}`}>
              {m.label}
            </span>
            <span className="text-[10.5px] text-[var(--color-text-muted)]">{m.desc}</span>
          </button>
        ))}
      </div>

      {mode === "text" && <VoiceAgent showExamples />}
      {mode === "acoustic" && <AcousticDemo />}
      {mode === "phone" && <PhoneCallDemo />}
    </div>
  );
}
