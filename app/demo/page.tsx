import { DemoModeSwitcher } from "../_components/DemoModeSwitcher";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "VOXERA Voice Demo",
  description: "Test the VOXERA emotion-aware voice agent in the browser.",
};

export default function DemoPage() {
  return (
    <main className="voxera-demo-dark flex min-h-screen flex-col bg-[var(--color-bg-base)] font-body text-[var(--color-text-primary)]">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--color-accent-violet)] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute top-40 left-0 w-[600px] h-[600px] bg-[var(--color-accent-cyan)] rounded-full blur-[150px] opacity-[0.06] pointer-events-none" />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 relative z-10">
        <header className="flex flex-col gap-3 mb-4 border-b border-[var(--color-border-subtle)] pb-7">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-2 w-fit">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <span className="inline-flex items-center gap-1.5 w-fit font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-violet)] bg-[var(--color-accent-violet)]/[0.08] border border-[var(--color-accent-violet)]/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-cyan)] animate-pulse" />
            Live browser demo
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-[42px] leading-[1.05] tracking-tight text-gradient max-w-xl">
            Emotion-adaptive voice agent
          </h1>
          <p className="text-[14.5px] text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            Deepgram STT and TTS with hierarchical memory, policy routing, CAI, and emotion-aware retrieval —
            pick a mode below and watch the engine reason about every turn in real time.
          </p>
        </header>
        <DemoModeSwitcher />
      </div>
    </main>
  );
}
