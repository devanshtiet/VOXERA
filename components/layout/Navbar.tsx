"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "nav-blur shadow-[0_4px_30px_var(--color-accent-glow)] py-3" : "bg-transparent py-5 border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 md:px-12">
          {/* Left: Wordmark */}
          <Link href="/" className="font-display font-bold text-2xl tracking-tighter text-gradient">
            VOXERA
          </Link>

          {/* Center: Desktop Links */}
          <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[var(--color-text-secondary)]">
            <Link href="#features" className="hover:text-[var(--color-text-primary)] transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-[var(--color-text-primary)] transition-colors">How it Works</Link>
            <Link href="#use-cases" className="hover:text-[var(--color-text-primary)] transition-colors">Use Cases</Link>
            <Link href="#pricing" className="hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link>
          </nav>
          {/* Right: Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/onboarding"
              className="relative overflow-hidden rounded-full btn-gradient px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_0_15px_var(--color-accent-glow)] transition-all hover:scale-[1.03] hover:shadow-[0_0_25px_var(--color-accent-glow)] group"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start building <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-[var(--color-text-primary)]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-[var(--color-bg-elevated)] pt-24 px-6 pb-6 flex flex-col md:hidden"
          >
            <nav className="flex flex-col gap-6 text-lg font-medium text-[var(--color-text-primary)] mb-8">
              <Link href="#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <Link href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</Link>
              <Link href="#use-cases" onClick={() => setMobileMenuOpen(false)}>Use Cases</Link>
              <Link href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            </nav>
            <div className="mt-auto flex flex-col gap-4">
              <Link href="/onboarding" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-3 rounded-xl btn-gradient text-white font-semibold">
                Start building
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
