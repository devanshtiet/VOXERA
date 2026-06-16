"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";

export function CAIGauge() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [score, setScore] = useState(0);

  // Animate score from 0 to 78 when in view
  useEffect(() => {
    if (isInView) {
      let current = 0;
      const interval = setInterval(() => {
        current += 2;
        if (current >= 78) {
          setScore(78);
          clearInterval(interval);
        } else {
          setScore(current);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isInView]);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  // Arc represents 75% of a circle (leaving bottom open)
  const arcLength = circumference * 0.75; 
  const strokeDashoffset = arcLength - (score / 100) * arcLength;

  return (
    <div ref={ref} className="relative w-full max-w-sm mx-auto flex flex-col items-center">
      {/* Glow Ring behind the SVG */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[var(--color-accent-glow)] rounded-full blur-[60px] opacity-70" />
      
      {/* Gauge SVG */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg
          className="absolute inset-0 w-full h-full -rotate-[135deg]"
          viewBox="0 0 200 200"
        >
          {/* Background Track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--color-bg-elevated)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* Active Arc */}
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--color-accent-cyan)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: isInView ? strokeDashoffset : arcLength }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              filter: "drop-shadow(0 0 10px var(--color-accent-cyan))",
            }}
          />
        </svg>

        {/* Center Text */}
        <div className="flex flex-col items-center justify-center z-10 pt-4">
          <span className="font-display font-extrabold text-6xl text-gradient tracking-tighter">
            {score}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-accent-violet)] mt-2">
            Confidence: HIGH
          </span>
        </div>
      </div>

      {/* Bar Charts below */}
      <div className="w-full mt-4 space-y-4 px-6 z-10">
        <BarStat label="Speaking Rate" value={65} inView={isInView} delay={0.2} />
        <BarStat label="Pause Duration" value={82} inView={isInView} delay={0.4} />
        <BarStat label="Pitch Variance" value={74} inView={isInView} delay={0.6} />
      </div>
    </div>
  );
}

function BarStat({ label, value, inView, delay }: { label: string, value: number, inView: boolean, delay: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] font-mono font-semibold tracking-wider text-[var(--color-text-secondary)] mb-2 uppercase">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[var(--color-accent-violet)] to-[var(--color-accent-cyan)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: inView ? `${value}%` : 0 }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
