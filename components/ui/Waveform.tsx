"use client";

import { useEffect, useState } from "react";

export function Waveform() {
  const [mounted, setMounted] = useState(false);
  const bars = 40;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-48 w-full opacity-0" />;

  return (
    <div className="relative w-full h-48 md:h-64 flex items-end justify-center gap-1 overflow-hidden pointer-events-none">
      {/* Background Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-full bg-[var(--color-accent-glow)] blur-[100px] rounded-[100%]" />
      
      {/* Waveform Bars */}
      {Array.from({ length: bars }).map((_, i) => {
        // Create a bell-curve height distribution so the center is tallest
        const position = i / (bars - 1);
        const curve = Math.sin(position * Math.PI);
        const baseHeight = curve * 80 + 10; // 10% to 90%
        const animationDelay = `${i * 0.05}s`;
        const duration = `${0.8 + Math.random() * 0.5}s`;

        return (
          <div
            key={i}
            className="relative w-2 md:w-3 bg-gradient-to-t from-[var(--color-accent-violet)] to-[var(--color-accent-cyan)] rounded-t-full shadow-[0_0_10px_var(--color-accent-cyan)] opacity-80 z-10 animate-wave-bounce"
            style={{
              height: `${baseHeight}%`,
              animationDelay,
              animationDuration: duration,
            }}
          />
        );
      })}
      
      {/* Horizon Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-accent-cyan)] to-transparent opacity-50 z-20" />
    </div>
  );
}
