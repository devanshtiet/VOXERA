"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Brain, CalendarCheck, Activity, ShieldCheck, BarChart3, Lock, BookOpen, Settings2, PhoneCall, Check } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Waveform } from "@/components/ui/Waveform";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { CAIGauge } from "@/components/ui/CAIGauge";
import { UseCaseTabs } from "@/components/ui/UseCaseTabs";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

export default function MarketingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-body overflow-x-hidden pt-[60px]">
        
        {/* 2. HERO SECTION */}
        <section className="relative min-h-[90vh] flex flex-col justify-center items-center text-center px-6 pt-24 overflow-hidden">
          <motion.div 
            initial="hidden" animate="visible" variants={staggerContainer}
            className="z-10 flex flex-col items-center max-w-[900px] w-full"
          >
            {/* Eyebrow */}
            <motion.div variants={fadeUp} className="mb-8 inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-[var(--color-border-active)] bg-[var(--color-bg-elevated)] shadow-[0_0_15px_var(--color-accent-glow)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent-cyan)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent-cyan)]"></span>
              </span>
              <span className="font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-primary)]">
                Next-Gen AI Phone Workforce
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1 variants={fadeUp} className="font-display font-[800] text-[clamp(3.5rem,7vw,6.5rem)] leading-[1.05] tracking-[-0.03em] mb-8 text-gradient">
              Phone agents that<br className="hidden md:block"/> actually work.
            </motion.h1>

            {/* Subheading */}
            <motion.p variants={fadeUp} className="text-[1.125rem] md:text-[1.25rem] leading-[1.7] text-[var(--color-text-secondary)] max-w-2xl mb-10">
              Train VOXERA on your business knowledge. It answers calls, books appointments, detects caller emotion, and escalates intelligently — 24/7.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 mb-16 w-full sm:w-auto">
              <Link href="/onboarding" className="w-full sm:w-auto text-center rounded-full btn-gradient px-8 py-4 text-[16px] font-semibold text-white shadow-[0_0_20px_var(--color-accent-glow)] transition-transform hover:scale-[1.03]">
                Start building →
              </Link>
              <Link href="/demo" className="w-full sm:w-auto text-center rounded-full border border-[var(--color-border-active)] bg-transparent px-8 py-4 text-[16px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border-subtle)]">
                Watch live demo
              </Link>
            </motion.div>

            {/* Trust Row */}
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center items-center gap-3 text-[12px] font-mono text-[var(--color-text-muted)] tracking-wider uppercase">
              <span>Powered by Deepgram</span>
              <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] hidden sm:block" />
              <span>Built on Supabase</span>
              <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] hidden sm:block" />
              <span>Deployable in &lt;1 hour</span>
            </motion.div>
          </motion.div>

          {/* Waveform Horizon */}
          <div className="absolute bottom-0 left-0 right-0 w-full z-0">
            <Waveform />
          </div>
        </section>

        {/* 3. SOCIAL PROOF BAR */}
        <section className="py-12 bg-[var(--color-bg-surface)] border-y border-[var(--color-border-subtle)] overflow-hidden flex items-center">
          <div className="flex gap-12 animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            {/* Duplicated for smooth loop */}
            {[...Array(2)].map((_, idx) => (
              <div key={idx} className="flex items-center gap-12 font-mono text-[14px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> Clinics</span><span className="text-[var(--color-accent-violet)]">·</span>
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> Restaurants</span><span className="text-[var(--color-accent-violet)]">·</span>
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> Law Firms</span><span className="text-[var(--color-accent-violet)]">·</span>
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> Salons</span><span className="text-[var(--color-accent-violet)]">·</span>
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> Real Estate</span><span className="text-[var(--color-accent-violet)]">·</span>
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> Gyms</span><span className="text-[var(--color-accent-violet)]">·</span>
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--color-accent-cyan)]"/> CA Firms</span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. HOW IT WORKS */}
        <section id="how-it-works" className="py-24 md:py-36 px-6 max-w-[1200px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">THREE STEPS</span>
              <h2 className="font-display font-[700] text-[clamp(2rem,4vw,3.5rem)] mt-4">From upload to live calls in minutes.</h2>
            </motion.div>

            <div className="relative flex flex-col lg:flex-row gap-8">
              {/* Connecting Dashed Line (Desktop) */}
              <div className="hidden lg:block absolute top-[48px] left-[10%] right-[10%] h-[2px] border-t-2 border-dashed border-[var(--color-border-active)] opacity-30 z-0" />

              <StepCard 
                num="01" icon={BookOpen} title="Upload Knowledge" 
                desc="Drop in your PDFs, menus, FAQs, price lists. VOXERA reads them so your agent answers with your exact policies." 
              />
              <StepCard 
                num="02" icon={Settings2} title="Configure Your Agent" 
                desc="Set your voice persona, business hours, escalation rules, and booking preferences. No code required." 
              />
              <StepCard 
                num="03" icon={PhoneCall} title="Go Live" 
                desc="Forward your number. Every call is answered, logged, and auditable. Watch the dashboard fill in real time." 
              />
            </div>
          </motion.div>
        </section>

        {/* 5. FEATURES GRID */}
        <section id="features" className="py-24 md:py-36 px-6 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)]">
          <div className="max-w-[1200px] mx-auto">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-16">
              <motion.span variants={fadeUp} className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">WHAT VOXERA DOES</motion.span>
              <motion.h2 variants={fadeUp} className="font-display font-[700] text-[clamp(2rem,4vw,3.5rem)] mt-4 max-w-2xl leading-[1.1]">Everything your receptionist does. Nothing they forget.</motion.h2>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              <FeatureCard icon={Brain} title="Trainable Knowledge" description="Ingest PDFs, menus, SOPs. The agent cites your exact data, not hallucinated guesses." />
              <FeatureCard icon={CalendarCheck} title="Smart Booking" description="Checks your real-time calendar availability and books appointments end-to-end without human touch." />
              <FeatureCard icon={Activity} title="Emotion Intelligence" description="The Commitment Acoustic Index (CAI) tracks caller sentiment in real time — pitch, pauses, energy, interruptions." />
              <FeatureCard icon={ShieldCheck} title="Safe Escalation" description="When frustration or complexity exceeds thresholds, VOXERA transfers instantly to a human with full context." />
              <FeatureCard icon={BarChart3} title="Live Analytics" description="Per-call logs, confidence distribution, conversion rates, peak hour trends — one dashboard, all tenants." />
              <FeatureCard icon={Lock} title="Multi-Tenant Secure" description="Every business is fully isolated. RLS policies, server-side tenant resolution, auditable tool invocation logs." />
            </motion.div>
          </div>
        </section>

        {/* 6. CAI SHOWCASE */}
        <section className="py-24 md:py-36 px-6 bg-[var(--color-bg-elevated)] border-y border-[var(--color-border-subtle)]">
          <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-16">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="flex-1">
              <motion.span variants={fadeUp} className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-accent-cyan)]">COMMITMENT ACOUSTIC INDEX</motion.span>
              <motion.h2 variants={fadeUp} className="font-display font-[700] text-[clamp(2rem,4vw,3.5rem)] mt-4 mb-6 leading-[1.1]">We don't just hear words.<br/>We read the room.</motion.h2>
              <motion.p variants={fadeUp} className="text-[1.125rem] text-[var(--color-text-secondary)] leading-relaxed mb-10">
                CAI is VOXERA's proprietary acoustic model. Every turn of a call is scored across speaking rate, pause duration, pitch variation, and interruption patterns. When the score drops, the agent shifts strategy — clarify, empathize, or escalate.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col gap-4">
                <CaiPill label="Pitch Variation" status="Measured" />
                <CaiPill label="Pause Duration" status="Tracked" />
                <CaiPill label="Interruptions" status="Detected" />
              </motion.div>
            </motion.div>

            <div className="flex-1 w-full flex justify-center">
              <CAIGauge />
            </div>
          </div>
        </section>

        {/* 7. USE CASES TABS */}
        <section id="use-cases" className="py-24 md:py-36 px-6 max-w-[1200px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-16">
            <motion.h2 variants={fadeUp} className="font-display font-[700] text-[clamp(2rem,4vw,3.5rem)] mb-4">One platform. Any workflow.</motion.h2>
            <motion.p variants={fadeUp} className="text-[1.125rem] text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
              Whether you run a clinic, a restaurant, or a local service business, VOXERA adapts to your operations.
            </motion.p>
          </motion.div>
          <UseCaseTabs />
        </section>

        {/* 8. TESTIMONIALS */}
        <section className="py-24 px-6 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)]">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <TestimonialCard 
              quote="Finally — a receptionist that never puts anyone on hold. Our booking rate jumped 18% in week one."
              name="Sarah Jenkins" role="Clinic Admin" company="Apollo Partner Clinic, Bangalore"
            />
            <TestimonialCard 
              quote="Friday night rush used to mean missed calls. Now VOXERA handles the waitlist while we cook."
              name="Rahul Patel" role="Owner" company="Spice Route Dining"
            />
            <TestimonialCard 
              quote="The emotional detection is unreal. It actually handed off an angry client to me before they blew up."
              name="Marcus T." role="Managing Partner" company="T & Associates Law"
            />
          </div>
        </section>

        {/* 9. PRICING TEASER */}
        <section id="pricing" className="py-24 md:py-36 px-6 max-w-[1200px] mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-16">
            <motion.span variants={fadeUp} className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">SIMPLE PRICING</motion.span>
            <motion.h2 variants={fadeUp} className="font-display font-[700] text-[clamp(2rem,4vw,3.5rem)] mt-4">Start free. Scale as you grow.</motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center max-w-5xl mx-auto text-left">
            <PricingCard title="Starter" price="Free" features={["1 Active Agent", "100 AI Minutes / mo", "Basic Knowledge Base", "Email Support"]} cta="Start free" />
            <PricingCard title="Growth" price="₹4,999/mo" features={["5 Active Agents", "Unlimited AI Minutes", "CAI Emotion Detection", "Calendar Integration", "Priority Support"]} cta="Start trial" highlight={true} />
            <PricingCard title="Enterprise" price="Custom" features={["Unlimited Agents", "Custom LLM Fine-tuning", "Dedicated Hardware", "White-glove Onboarding"]} cta="Contact sales" />
          </div>
        </section>

        {/* 10. FINAL CTA BANNER */}
        <section className="relative py-32 px-6 border-t border-[var(--color-border-subtle)] overflow-hidden flex justify-center text-center">
          <div className="absolute inset-0 btn-gradient opacity-20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white rounded-full blur-[150px] opacity-10 pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-display font-[800] text-4xl md:text-5xl text-white mb-6 leading-tight">Your first AI call agent.<br/>Ready in under an hour.</h2>
            <p className="text-[1.125rem] text-[var(--color-text-secondary)] mb-10 leading-relaxed">No telephony expertise needed. Just upload, configure, and forward your number.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/onboarding" className="rounded-full bg-white text-black px-8 py-4 text-[16px] font-semibold transition-transform hover:scale-[1.03]">
                Start building free
              </Link>
              <Link href="/demo" className="rounded-full border border-white/30 px-8 py-4 text-[16px] font-semibold text-white transition-colors hover:bg-white/10">
                Book a demo
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}

/* Helper Components */

function StepCard({ num, icon: Icon, title, desc }: { num: string, icon: any, title: string, desc: string }) {
  return (
    <div className="relative flex-1 bg-[var(--color-bg-elevated)] p-8 rounded-2xl border border-[var(--color-border-subtle)] transition-all hover:-translate-y-2 hover:shadow-[0_10px_30px_var(--color-accent-glow)] z-10">
      <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-[var(--color-bg-base)] border-2 border-[var(--color-border-active)] flex items-center justify-center font-mono font-bold text-[14px]">
        {num}
      </div>
      <div className="icon-orb mb-6 mt-2">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-xl mb-3">{title}</h3>
      <p className="text-[var(--color-text-secondary)] leading-relaxed">{desc}</p>
    </div>
  );
}

function CaiPill({ label, status }: { label: string, status: string }) {
  return (
    <div className="flex justify-between items-center bg-[var(--color-bg-surface)] px-5 py-3 rounded-xl border border-[var(--color-border-subtle)] font-mono text-[13px]">
      <span className="text-[var(--color-text-primary)]">{label}</span>
      <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-cyan)] shadow-[0_0_8px_var(--color-accent-cyan)]" />
        {status}
      </span>
    </div>
  );
}

function TestimonialCard({ quote, name, role, company }: { quote: string, name: string, role: string, company: string }) {
  const initials = name.split(" ").map(n => n[0]).join("");
  return (
    <div className="bg-[var(--color-bg-elevated)] p-8 rounded-2xl border border-[var(--color-border-subtle)] transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_var(--color-accent-glow)] hover:border-[var(--color-border-active)]">
      <div className="text-4xl text-[var(--color-accent-violet)] opacity-50 mb-4 font-display">"</div>
      <p className="text-[16px] italic text-[var(--color-text-secondary)] leading-relaxed mb-8">"{quote}"</p>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full btn-gradient flex items-center justify-center text-[12px] font-bold text-white shadow-[0_0_10px_var(--color-accent-glow)]">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-[14px]">{name}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">{role}, {company}</p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ title, price, features, cta, highlight = false }: { title: string, price: string, features: string[], cta: string, highlight?: boolean }) {
  return (
    <div className={`relative bg-[var(--color-bg-elevated)] p-8 rounded-2xl border ${highlight ? 'border-[var(--color-border-active)] shadow-[0_0_30px_var(--color-accent-glow)] transform lg:scale-105 z-10' : 'border-[var(--color-border-subtle)]'} transition-all hover:-translate-y-1 hover:shadow-[0_10px_40px_var(--color-accent-glow)]`}>
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-accent-cyan)] text-[var(--color-bg-base)] text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full">
          POPULAR
        </span>
      )}
      <h3 className="font-semibold text-xl mb-2">{title}</h3>
      <div className="font-display font-[800] text-4xl mb-8">{price}</div>
      <ul className="space-y-4 mb-8">
        {features.map((feat, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-[var(--color-accent-cyan)] shrink-0" />
            <span className="text-[14px] text-[var(--color-text-secondary)]">{feat}</span>
          </li>
        ))}
      </ul>
      <Link href="/onboarding" className={`block w-full text-center rounded-xl py-3 text-[14px] font-semibold transition-all ${highlight ? 'btn-gradient text-white hover:scale-[1.02]' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-base)]'}`}>
        {cta}
      </Link>
    </div>
  );
}
