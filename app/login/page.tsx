import { login } from "./actions";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-base)] font-body text-[var(--color-text-primary)]">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-accent-violet)] rounded-full blur-[120px] opacity-10 pointer-events-none" />

      <div className="relative w-full max-w-md p-8 sm:p-10 space-y-8 bg-[var(--color-bg-elevated)] rounded-2xl shadow-[0_0_40px_var(--color-accent-glow)] border border-[var(--color-border-subtle)]">
        <div className="text-center">
          <Link href="/" className="inline-block font-display font-extrabold text-3xl tracking-tighter text-gradient">
            VOXERA
          </Link>
          <p className="mt-3 text-[14px] text-[var(--color-text-secondary)]">Sign in to your dashboard</p>
        </div>

        {searchParams?.error && (
          <div className="p-4 text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl">
            {searchParams.error}
          </div>
        )}

        <form className="mt-8 space-y-6" action={login}>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono font-bold tracking-widest text-[var(--color-text-secondary)] uppercase mb-2">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[14px] text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)]"
                placeholder="admin@voxera.ai"
              />
            </div>
            <div>
              <label className="block text-[12px] font-mono font-bold tracking-widest text-[var(--color-text-secondary)] uppercase mb-2">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[14px] text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="group flex items-center justify-center gap-2 w-full px-4 py-3 text-[14px] font-semibold text-white btn-gradient rounded-xl transition-all hover:scale-[1.02] shadow-[0_0_15px_var(--color-accent-glow)]"
          >
            Sign in
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
