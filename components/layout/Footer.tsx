import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[var(--color-bg-base)] border-t border-[var(--color-border-subtle)] py-16 px-6 md:px-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="font-display font-bold text-2xl tracking-tighter text-gradient mb-4 inline-block">
              VOXERA
            </Link>
            <p className="text-[var(--color-text-muted)] text-[15px] max-w-sm">
              Next-generation AI phone workforce for businesses that depend on human connection and flawless execution.
            </p>
            <p className="text-[var(--color-text-muted)] text-[13px] mt-6">
              © 2026 VOXERA Inc. All rights reserved.
            </p>
          </div>
          
          <div>
            <h4 className="text-[13px] font-mono font-semibold tracking-widest text-[var(--color-text-primary)] uppercase mb-6">Product</h4>
            <ul className="flex flex-col gap-4 text-[14px] text-[var(--color-text-secondary)]">
              <li><Link href="#features" className="hover:text-[var(--color-text-primary)] transition-colors">Features</Link></li>
              <li><Link href="#use-cases" className="hover:text-[var(--color-text-primary)] transition-colors">Use Cases</Link></li>
              <li><Link href="#pricing" className="hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link></li>
              <li><Link href="/demo" className="hover:text-[var(--color-text-primary)] transition-colors">Live Demo</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-[13px] font-mono font-semibold tracking-widest text-[var(--color-text-primary)] uppercase mb-6">Company</h4>
            <ul className="flex flex-col gap-4 text-[14px] text-[var(--color-text-secondary)]">
              <li><Link href="#" className="hover:text-[var(--color-text-primary)] transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Security</Link></li>
              <li><Link href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-[var(--color-border-subtle)] pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[13px] text-[var(--color-text-muted)]">
          <p>Built with Deepgram · Supabase · Next.js</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
