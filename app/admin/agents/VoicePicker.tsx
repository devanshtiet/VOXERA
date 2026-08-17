"use client";

import { useMemo, useRef, useState } from "react";
import { Search, Play, Pause, Loader2, Check } from "lucide-react";
import { DEEPGRAM_VOICES, type DeepgramVoice } from "@/lib/deepgram/voices";

const PREVIEW_TEXT = "Hi there! This is a quick preview of my voice.";

const ACCENTS = ["All", ...Array.from(new Set(DEEPGRAM_VOICES.map((v) => v.accent))).sort()];

export function VoicePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"all" | "feminine" | "masculine">("all");
  const [accent, setAccent] = useState("All");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DEEPGRAM_VOICES.filter((v) => {
      if (v.generation !== "aura-2") return false; // current generation only; legacy 4 keys still resolve fine if already saved
      if (gender !== "all" && v.gender !== gender) return false;
      if (accent !== "All" && v.accent !== accent) return false;
      if (q && !v.name.toLowerCase().includes(q) && !v.tags.some((t) => t.includes(q)) && !v.accent.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, gender, accent]);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };

  const preview = async (voice: DeepgramVoice) => {
    if (playingId === voice.id) {
      stopPreview();
      return;
    }
    stopPreview();
    setLoadingId(voice.id);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: PREVIEW_TEXT, persona: voice.id }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      setPlayingId(voice.id);
      await audio.play();
    } catch {
      setPlayingId(null);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices — name, trait, accent…"
            className="w-full pl-8 pr-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg text-[12.5px] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-violet)]"
          />
        </div>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className="px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg text-[12.5px] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-violet)]"
        >
          <option value="all">Any gender</option>
          <option value="feminine">Feminine</option>
          <option value="masculine">Masculine</option>
        </select>
        <select
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className="px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg text-[12.5px] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-violet)]"
        >
          {ACCENTS.map((a) => (
            <option key={a} value={a}>
              {a === "All" ? "Any accent" : a}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
        {voices.length === 0 && (
          <div className="col-span-full text-center text-[12.5px] text-[var(--color-text-muted)] py-8">
            No voices match your filters.
          </div>
        )}
        {voices.map((v) => {
          const selected = value === v.id;
          const isLoading = loadingId === v.id;
          const isPlaying = playingId === v.id;
          return (
            <div
              key={v.id}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                selected
                  ? "border-[var(--color-border-active)] bg-[var(--color-bg-base)] shadow-[0_0_10px_var(--color-accent-glow)]"
                  : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-active)]"
              }`}
            >
              <button
                type="button"
                onClick={() => preview(v)}
                disabled={isLoading}
                title={isPlaying ? "Stop preview" : "Preview this voice"}
                className="flex-none w-7 h-7 rounded-full flex items-center justify-center bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent-cyan)] transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>

              <button type="button" onClick={() => onChange(v.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{v.name}</span>
                  <span className="text-[10.5px] text-[var(--color-text-muted)] flex-none">· {v.accent}</span>
                </div>
                <div className="text-[10.5px] text-[var(--color-text-muted)] truncate capitalize">
                  {v.gender} · {v.tags.slice(0, 3).join(", ")}
                </div>
              </button>

              {selected && <Check className="w-4 h-4 text-[var(--color-accent-cyan)] flex-none" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
