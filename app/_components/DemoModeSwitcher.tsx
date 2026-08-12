"use client";

import { useState } from "react";
import { MessageSquare, AudioLines, PhoneCall, Radio, Phone } from "lucide-react";
import { VoiceAgent } from "./VoiceAgent";
import { AcousticDemo } from "./AcousticDemo";
import { PhoneCallDemo } from "./PhoneCallDemo";

type DemoMode = "text" | "live" | "acoustic" | "phone";

const MODES: { key: DemoMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "text", label: "Text", desc: "HF + Lexicon engines", icon: <MessageSquare className="w-[15px] h-[15px]" /> },
  { key: "live", label: "Live Call", desc: "WebSocket, real-time", icon: <Radio className="w-[15px] h-[15px]" /> },
  { key: "acoustic", label: "Acoustic", desc: "Microphone analysis", icon: <AudioLines className="w-[15px] h-[15px]" /> },
  { key: "phone", label: "Phone Call", desc: "Real call, live transcript", icon: <PhoneCall className="w-[15px] h-[15px]" /> },
];

function LiveCallPanel() {
  return (
    <div className="voxera-console flex flex-col items-center justify-center gap-4 rounded-2xl shadow-[0_20px_60px_-15px_rgba(10,12,20,0.5)] px-6 py-14 text-center">
      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--console-violet)]/15 text-[var(--console-violet)]">
        <Radio className="w-5 h-5" />
      </span>
      <div>
        <div className="text-[15px] font-bold text-[var(--console-text)]">Live Call now lives in the test drawer</div>
        <p className="text-[12.5px] text-[var(--console-text-dim)] max-w-[360px] mt-1.5 leading-relaxed">
          Continuous WebSocket streaming, real barge-in, and per-turn engine diagnostics attached to
          every line of the transcript — open it from the button in the corner of the screen, on
          any page.
        </p>
      </div>
      <button
        onClick={() => window.dispatchEvent(new Event("voxera:open-test-drawer"))}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--console-violet)] text-[#0A0C14] text-[13px] font-semibold hover:brightness-110 transition-all"
      >
        <Phone className="w-4 h-4" /> Talk to the agent
      </button>
    </div>
  );
}

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
      {mode === "live" && <LiveCallPanel />}
      {mode === "acoustic" && <AcousticDemo />}
      {mode === "phone" && <PhoneCallDemo />}
    </div>
  );
}
