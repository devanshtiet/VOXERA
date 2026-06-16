import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Workspace Created",
  description: "Your VOXERA AI agent is ready.",
};

export default function OnboardingSuccessPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-body p-6 text-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-accent-cyan)] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-lg">
        <div className="w-20 h-20 bg-emerald-950/30 border border-emerald-900/50 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        
        <h1 className="font-display font-extrabold text-4xl tracking-tighter text-gradient mb-4">
          Workspace Provisioned
        </h1>
        <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed mb-10">
          Your AI agent has been initialized with the requested knowledge parameters and business rules. A member of our deployment team will reach out shortly to finalize the phone routing.
        </p>

        <Link
          href="/"
          className="group flex items-center gap-2 px-6 py-3 rounded-full btn-gradient text-[14px] font-semibold text-white shadow-[0_0_15px_var(--color-accent-glow)] transition-all hover:scale-[1.03]"
        >
          Return to home <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </main>
  );
}
