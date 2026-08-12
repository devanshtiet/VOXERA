"use client";

import { useState } from "react";
import { MessageSquare, AudioLines, PhoneCall, Radio } from "lucide-react";
import { VoiceAgent } from "./VoiceAgent";
import { AcousticDemo } from "./AcousticDemo";
import { PhoneCallDemo } from "./PhoneCallDemo";
import { RealtimeVoiceCall } from "./RealtimeVoiceCall";

type DemoMode = "text" | "live" | "acoustic" | "phone";

const MODES: { key: DemoMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "text", label: "Text", desc: "HF + Lexicon engines", icon: <MessageSquare className="w-[15px] h-[15px]" /> },
  { key: "live", label: "Live Call", desc: "WebSocket, real-time", icon: <Radio className="w-[15px] h-[15px]" /> },
  { key: "acoustic", label: "Acoustic", desc: "Microphone analysis", icon: <AudioLines className="w-[15px] h-[15px]" /> },
  { key: "phone", label: "Phone Call", desc: "Real call, live transcript", icon: <PhoneCall className="w-[15px] h-[15px]" /> },
];

export function DemoModeSwitcher() {
  const [mode, setMode] = useState<DemoMode>("text");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] p-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex sm:flex-col items-center justify-center gap-1.5 sm:gap-1 rounded-xl px-3 py-3 sm:py-3.5 text-center transition-all duration-200 ${
              mode === m.key
                ? "bg-[var(--color-bg-elevated)] shadow-[0_4px_16px_-4px_rgba(124,58,237,0.35)] border border-[var(--color-accent-violet)]/25"
                : "border border-transparent hover:bg-[var(--color-bg-elevated)]/50"
            }`}
          >
            <span className={mode === m.key ? "text-[var(--color-accent-violet)]" : "text-[var(--color-text-muted)]"}>{m.icon}</span>
            <span className="flex flex-col items-start sm:items-center leading-tight">
              <span className={`text-[12.5px] font-bold ${mode === m.key ? "text-[var(--color-accent-violet)]" : "text-[var(--color-text-secondary)]"}`}>
                {m.label}
              </span>
              <span className="text-[9.5px] font-mono uppercase tracking-wide text-[var(--color-text-muted)] hidden sm:inline">{m.desc}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === "text" && <VoiceAgent showExamples />}
      {mode === "live" && <RealtimeVoiceCall />}
      {mode === "acoustic" && <AcousticDemo />}
      {mode === "phone" && <PhoneCallDemo />}
    </div>
  );
}
