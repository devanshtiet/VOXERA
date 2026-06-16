import Link from "next/link";
import { OnboardingPlanner } from "./planner";

export const metadata = {
  title: "Start VOXERA Setup",
  description: "Describe your business and map the first AI phone agent workflow.",
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-body">
      <header className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display font-bold text-lg tracking-tighter text-gradient">VOXERA</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/demo" className="text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              Demo
            </Link>
          </div>
        </div>
      </header>
      
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="max-w-2xl mb-10">
          <h1 className="font-display font-bold text-[clamp(2rem,4vw,3rem)] tracking-tight text-[var(--color-text-primary)] mb-4 leading-tight">
            Map your first AI workflow.
          </h1>
          <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed">
            Capture your business context, goals, and escalation rules. We'll use this to draft your first voice agent workspace.
          </p>
        </div>
        
        <OnboardingPlanner />
      </section>
    </main>
  );
}
