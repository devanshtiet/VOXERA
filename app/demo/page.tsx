import { VoiceAgent } from "../_components/VoiceAgent";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "VOXERA Voice Demo",
  description: "Test the VOXERA emotion-aware voice agent in the browser.",
};

export default function DemoPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--color-bg-base)] font-body text-[var(--color-text-primary)]">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--color-accent-cyan)] rounded-full blur-[150px] opacity-5 pointer-events-none" />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 relative z-10">
        <header className="flex flex-col gap-2 mb-4 border-b border-[var(--color-border-subtle)] pb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <p className="font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-cyan)]">
            Live browser demo
          </p>
          <h1 className="font-display font-extrabold text-3xl tracking-tight text-gradient">
            Emotion-adaptive voice agent
          </h1>
          <p className="text-[14px] text-[var(--color-text-secondary)]">
            Deepgram STT and TTS with hierarchical memory, policy routing, CAI, and emotion-aware retrieval.
          </p>
        </header>
        <VoiceAgent />
      </div>
    </main>
  );
}
