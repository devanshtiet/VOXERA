"use client";

export function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="group relative bg-[var(--color-bg-elevated)] rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_40px_-10px_var(--color-accent-glow)] border border-[var(--color-border-subtle)] overflow-hidden">
      {/* Top subtle border gradient glow on hover */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-accent-cyan)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="icon-orb mb-6">
        <Icon className="w-6 h-6" />
      </div>
      
      <h3 className="text-[1.25rem] font-semibold text-[var(--color-text-primary)] mb-3">{title}</h3>
      <p className="text-[1rem] leading-[1.7] text-[var(--color-text-secondary)] mb-6">{description}</p>
      
      <div className="mt-auto flex items-center text-[14px] font-semibold text-[var(--color-accent-violet)] group-hover:text-[var(--color-accent-cyan)] transition-colors">
        Learn more <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
      </div>
    </div>
  );
}
