"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, AudioLines, Sparkles } from "lucide-react";
import { getMicSupport, describeMicError } from "./micUtils";

const TARGET_SAMPLE_RATE = 8000;
const CHUNK_DURATION_MS = 1600;
const CHUNK_SAMPLES = Math.floor((TARGET_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000);

interface AcousticFeatures {
  rmsEnergy: number;
  zeroCrossingRate: number;
  pitchHz: number;
  pitchVariation: number;
  speakingRateWPM: number;
  pauseDurationMs: number;
  pauseCount: number;
  durationMs: number;
  energyModulationRate?: number;
  pitchContour?: "rising" | "falling" | "flat" | "unstable";
  decibels?: number;
}

interface AcousticEmotion {
  label: string;
  intensity: number;
  confidence: number;
  vad: { v: number; a: number; d: number };
  source: string;
  acousticSignalHint?: "crying" | "laughing";
}

interface AnalyzeResult {
  features: AcousticFeatures;
  emotion: AcousticEmotion | null;
  latencyMs: number;
}

const TEST_PROMPTS = [
  { label: "Neutral", hint: "Speak in your normal, everyday tone." },
  { label: "Crying / Sobbing", hint: "Try a shaky, broken, sobbing voice." },
  { label: "Laughing", hint: "Laugh naturally, or speak while chuckling." },
  { label: "Angry", hint: "Speak with a loud, sharp, controlled edge." },
  { label: "Distressed", hint: "Speak quickly with audible tension or panic." },
];

function downsampleTo8kMono(input: Float32Array, inputSampleRate: number): Int16Array {
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    const sample = Math.max(-1, Math.min(1, input[srcIndex] ?? 0));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

export function AcousticDemo() {
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Int16Array[]>([]);
  const bufferedSamplesRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setMicSupported(getMicSupport());
  }, []);

  const flushChunk = useCallback(async () => {
    if (inFlightRef.current || bufferedSamplesRef.current === 0) return;
    const chunks = bufferRef.current;
    bufferRef.current = [];
    bufferedSamplesRef.current = 0;

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    inFlightRef.current = true;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/acoustic/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: merged.buffer as ArrayBuffer,
      });
      if (res.ok) {
        const data: AnalyzeResult = await res.json();
        setResult(data);
        setChunkCount((c) => c + 1);
      }
      // A failed chunk is skipped rather than killing the session — keep listening.
    } catch {
      // Network hiccup on a single chunk — non-fatal, keep listening.
    } finally {
      inFlightRef.current = false;
      setAnalyzing(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    if (!getMicSupport()) {
      setMicSupported(false);
      setError("Microphone requires HTTPS (or localhost) and a browser that supports getUserMedia.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessorNode is deprecated but universally supported; avoids
      // shipping a separate AudioWorklet module file for a demo-scale feature.
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo8kMono(input, audioContext.sampleRate);
        bufferRef.current.push(downsampled);
        bufferedSamplesRef.current += downsampled.length;
        if (bufferedSamplesRef.current >= CHUNK_SAMPLES) {
          void flushChunk();
        }
      };

      source.connect(processor);
      // A ScriptProcessorNode must be connected to a destination to fire
      // onaudioprocess in most browsers; route to a muted gain instead of
      // speakers to avoid feeding the mic back out loud.
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      setListening(true);
    } catch (e) {
      setError(describeMicError(e));
    }
  }, [flushChunk]);

  const stopListening = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    bufferRef.current = [];
    bufferedSamplesRef.current = 0;
    setListening(false);
  }, []);

  useEffect(() => {
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="voxera-console flex flex-col rounded-2xl shadow-[0_20px_60px_-15px_rgba(10,12,20,0.5)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b voxera-console-hairline">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--console-cyan)]/15 text-[var(--console-cyan)] flex-none">
              <AudioLines className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[13px] font-bold text-[var(--console-text)] leading-tight">Acoustic Emotion Engine</div>
              <div className="text-[10.5px] text-[var(--console-text-dim)]">Real-time voice analysis — reuses the same engine as live calls</div>
            </div>
          </div>
          <button
            onClick={listening ? stopListening : startListening}
            disabled={!micSupported && !listening}
            title={!micSupported ? "Microphone requires HTTPS (or localhost) and a supported browser" : undefined}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all flex-none ${
              listening
                ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-600"
                : "bg-[var(--console-surface-raised)] border border-[var(--console-border)] text-[var(--console-text)] hover:border-[var(--console-border-active)]"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {listening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
            {listening ? "Stop" : "Start Listening"}
          </button>
        </div>

        {listening && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b voxera-console-hairline bg-[var(--console-cyan)]/[0.05]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--console-cyan)] animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--console-cyan)]">
              {analyzing ? "Analyzing…" : "Listening"}
            </span>
            <span className="text-[10.5px] text-[var(--console-text-dim)] ml-1">
              {chunkCount} sample{chunkCount === 1 ? "" : "s"} analyzed · ~{CHUNK_DURATION_MS / 1000}s windows
            </span>
            <div className="voxera-waveform ml-auto" aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>
        )}

        <div className="p-5">
          {!result ? (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
              <AudioLines className="w-6 h-6 text-[var(--console-text-dim)]" />
              <p className="text-[12.5px] text-[var(--console-text-dim)]">
                Click "Start Listening" and speak — real acoustic features (pitch, energy, ZCR, contour) and the
                emotion they infer will appear here every ~{CHUNK_DURATION_MS / 1000}s.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--console-cyan)]/30 bg-[var(--console-cyan)]/[0.06] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--console-text-dim)] mb-2">
                  <Sparkles className="w-3 h-3 text-[var(--console-violet)]" /> Detected Emotion
                </div>
                {result.emotion ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="text-[20px] font-bold capitalize text-[var(--console-text)]">{result.emotion.label}</div>
                      {result.emotion.acousticSignalHint && (
                        <span className="text-[9.5px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--console-violet)]/15 text-[var(--console-violet)] border border-[var(--console-violet)]/30">
                          {result.emotion.acousticSignalHint === "crying" ? "crying detected" : "laughing detected"}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[var(--console-text-dim)] mt-1">
                      {(result.emotion.confidence * 100).toFixed(0)}% confidence · intensity {result.emotion.intensity.toFixed(2)}
                    </div>
                    <div className="text-[10.5px] font-mono text-[var(--console-text-dim)] mt-2">
                      VAD {result.emotion.vad.v.toFixed(2)} / {result.emotion.vad.a.toFixed(2)} / {result.emotion.vad.d.toFixed(2)}
                    </div>
                    <div className="text-[9.5px] text-[var(--console-text-dim)] mt-3 leading-snug italic">
                      Importance and memory classification only apply during a full conversational
                      turn (they factor in retrieval + policy context) — this demo calls the acoustic
                      engine directly, so they're not shown here.
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] text-[var(--console-text-dim)]">Audio too short/quiet to classify — keep speaking.</div>
                )}
              </div>

              <div className="rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--console-text-dim)]">
                    Raw Acoustic Features
                  </div>
                  <div className="text-[9.5px] font-mono text-[var(--console-text-dim)]">{result.latencyMs.toFixed(1)}ms</div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11.5px]">
                  <FeatureCell label="Energy (RMS)" value={result.features.rmsEnergy.toFixed(0)} />
                  <FeatureCell label="Loudness (dBFS)" value={result.features.decibels !== undefined ? result.features.decibels.toFixed(1) : "—"} />
                  <FeatureCell label="Energy Modulation" value={result.features.energyModulationRate?.toFixed(2) ?? "—"} />
                  <FeatureCell label="Pitch (Hz)" value={result.features.pitchHz > 0 ? result.features.pitchHz.toFixed(0) : "unvoiced"} />
                  <FeatureCell label="Pitch Contour" value={result.features.pitchContour ?? "—"} />
                  <FeatureCell label="Pitch Variation" value={result.features.pitchVariation.toFixed(2)} />
                  <FeatureCell label="Zero-Crossing Rate" value={result.features.zeroCrossingRate.toFixed(3)} />
                  <FeatureCell label="Pauses" value={`${result.features.pauseCount} · ${result.features.pauseDurationMs.toFixed(0)}ms`} />
                  <FeatureCell label="Window" value={`${result.features.durationMs.toFixed(0)}ms`} />
                </dl>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl bg-red-950/30 border border-red-900/50 text-[13px] text-red-400 px-4 py-3">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-5">
        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-3">
          Manual Test Cases
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {TEST_PROMPTS.map((p) => (
            <div key={p.label} className="rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] p-3">
              <div className="text-[12px] font-bold text-[var(--color-text-primary)]">{p.label}</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)] mt-1 leading-snug">{p.hint}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--console-text-dim)]">{label}</dt>
      <dd className="font-mono text-[var(--console-text)] capitalize">{value}</dd>
    </div>
  );
}
