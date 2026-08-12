"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, X, Phone, PhoneOff, Sparkles } from "lucide-react";
import { getMicSupport, describeMicError } from "./micUtils";
import { useVoiceActivityDetection } from "./useVoiceActivityDetection";
import {
  EngineDiagnosticPanel,
  EmotionTimeline,
  type DiagnosticEmotionResult,
  type EmotionHistoryPoint,
} from "./EngineDashboard";

const TARGET_SAMPLE_RATE = 16000;
const WS_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:3001";

type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

interface TranscriptTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  emotion?: string;
  diagnostics?: DiagnosticEmotionResult;
  cai?: { score: number; category: string };
}

function downsampleTo16kMono(input: Float32Array, inputSampleRate: number): Int16Array {
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

/** RMS amplitude (0–1) of an analyser's current time-domain buffer. */
function readLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) {
    const centered = (buf[i] - 128) / 128;
    sumSq += centered * centered;
  }
  return Math.min(1, Math.sqrt(sumSq / buf.length) * 4); // *4 — RMS of speech is quiet relative to full-scale
}

export function TestAgentDrawer() {
  const [open, setOpen] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [interim, setInterim] = useState("");
  const [emotionHistory, setEmotionHistory] = useState<EmotionHistoryPoint[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const active = useRef(false);
  const vad = useVoiceActivityDetection();

  useEffect(() => {
    setMicSupported(getMicSupport());
  }, []);

  // Lets other pages (e.g. the /demo mode switcher's "Live Call" CTA) open
  // this single site-wide drawer instance without prop-drilling or context.
  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("voxera:open-test-drawer", openHandler);
    return () => window.removeEventListener("voxera:open-test-drawer", openHandler);
  }, []);

  useEffect(() => {
    statusRef.current = status;
    if (orbRef.current) {
      orbRef.current.style.setProperty("--hue", status === "speaking" ? "var(--console-cyan)" : "var(--console-violet)");
    }
  }, [status]);

  // One persistent AudioContext + MediaElementSourceNode for the reply
  // player — a source node can only be created once per <audio> element.
  useEffect(() => {
    if (!playerRef.current || playbackAudioContextRef.current) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(playerRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    playbackAudioContextRef.current = ctx;
    playbackSourceRef.current = source;
    playbackAnalyserRef.current = analyser;
  }, [open]);

  const stopLevelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    orbRef.current?.style.setProperty("--level", "0");
  }, []);

  const startLevelLoop = useCallback(() => {
    const micBuf = new Uint8Array(256);
    const playbackBuf = new Uint8Array(256);
    const tick = () => {
      const analyser = statusRef.current === "speaking" ? playbackAnalyserRef.current : micAnalyserRef.current;
      const buf = statusRef.current === "speaking" ? playbackBuf : micBuf;
      const level = analyser ? readLevel(analyser, buf) : 0;
      orbRef.current?.style.setProperty("--level", level.toFixed(3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const endCall = useCallback(() => {
    active.current = false;
    stopLevelLoop();
    vad.destroy();
    processorRef.current?.disconnect();
    micSourceRef.current?.disconnect();
    micAnalyserRef.current?.disconnect();
    micAudioContextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    processorRef.current = null;
    micSourceRef.current = null;
    micAnalyserRef.current = null;
    micAudioContextRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    setStatus("idle");
    setInterim("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLevelLoop]);

  useEffect(() => () => endCall(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const bargeIn = useCallback(() => {
    if (statusRef.current !== "speaking") return;
    const audio = playerRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    wsRef.current?.send(JSON.stringify({ type: "barge_in" }));
    setStatus("listening");
  }, []);

  const startCall = useCallback(async () => {
    setError(null);
    if (!getMicSupport()) {
      setMicSupported(false);
      setError("Microphone requires HTTPS (or localhost) and a browser that supports getUserMedia.");
      return;
    }

    setStatus("connecting");
    setTurns([]);
    setEmotionHistory([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        active.current = true;
      };

      ws.onerror = () => {
        setError(`Couldn't reach the realtime voice server at ${WS_URL}. Make sure it's running: npm run server`);
        setStatus("error");
        endCall();
      };

      ws.onclose = () => {
        if (active.current) {
          setError("Realtime connection closed unexpectedly.");
          setStatus("error");
        }
        active.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "system":
              setStatus("listening");
              break;
            case "transcript_interim":
              setInterim(msg.text);
              break;
            case "transcript_final":
              setInterim("");
              setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: msg.text }]);
              break;
            case "turn_start":
              setStatus("thinking");
              break;
            case "reply_text": {
              const emotion = msg.trace?.emotion?.current;
              const diagnostics: DiagnosticEmotionResult | undefined = msg.trace?.emotionDiagnostics;
              setTurns((prev) => [
                ...prev,
                {
                  id: `a-${Date.now()}`,
                  role: "assistant",
                  text: msg.text,
                  emotion: emotion?.label,
                  diagnostics,
                  cai: msg.trace?.cai ? { score: msg.trace.cai.score, category: msg.trace.cai.category } : undefined,
                },
              ]);
              if (emotion) {
                setEmotionHistory((h) => [...h.slice(-59), { ts: Date.now(), label: emotion.label, intensity: emotion.intensity }]);
              }
              break;
            }
            case "reply_audio": {
              setStatus("speaking");
              const audio = playerRef.current;
              if (audio) {
                audio.src = `data:${msg.mime};base64,${msg.audio}`;
                audio.onended = () => {
                  if (active.current) setStatus("listening");
                };
                playbackAudioContextRef.current?.resume().catch(() => {});
                void audio.play().catch(() => {
                  if (active.current) setStatus("listening");
                });
              }
              break;
            }
            case "turn_end":
              break;
            case "error":
              setError(msg.message);
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      micAudioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      micSourceRef.current = source;

      const micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 256;
      source.connect(micAnalyser);
      micAnalyserRef.current = micAnalyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (!active.current || ws.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16kMono(input, audioContext.sampleRate);
        ws.send(downsampled.buffer);
      };
      source.connect(processor);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      startLevelLoop();

      await vad.start(
        { onSpeechStart: bargeIn },
        { stream, audioContext }
      );
    } catch (e) {
      setError(describeMicError(e));
      setStatus("error");
      endCall();
    }
  }, [endCall, startLevelLoop, vad, bargeIn]);

  const isLive = status !== "idle" && status !== "error";

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close agent test panel" : "Talk to the agent"}
        className="fixed bottom-6 right-6 z-[110] flex items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-full bg-[var(--console-bg)] border border-[var(--console-border-active)] text-[var(--console-text)] shadow-[0_10px_40px_-8px_rgba(139,92,246,0.55)] hover:shadow-[0_14px_50px_-8px_rgba(139,92,246,0.7)] transition-shadow"
      >
        {open ? <X className="w-4 h-4" /> : <Radio className="w-4 h-4 text-[var(--console-violet)]" />}
        <span className="text-[13px] font-semibold">{open ? "Close" : "Talk to the agent"}</span>
        {!open && <span className="w-1.5 h-1.5 rounded-full bg-[var(--console-cyan)] animate-pulse" />}
      </button>

      <div
        className={`fixed inset-y-0 right-0 z-[105] w-full sm:w-[440px] voxera-console border-l border-[var(--console-border)] shadow-[-20px_0_60px_-15px_rgba(10,12,20,0.6)] transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Pinned header — orb, call controls, running session strip. Never scrolls. */}
        <div className="flex-none border-b border-[var(--console-border)] px-5 pt-6 pb-4 flex flex-col items-center gap-3">
          <div ref={orbRef} className="voxera-orb">
            <div className="voxera-orb-core">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--console-text-dim)]">
            {status === "idle" && "Ready"}
            {status === "connecting" && "Connecting…"}
            {status === "listening" && "Listening"}
            {status === "thinking" && "Thinking…"}
            {status === "speaking" && "Speaking"}
            {status === "error" && "Error"}
          </div>

          <button
            onClick={isLive ? endCall : startCall}
            disabled={!micSupported && !isLive}
            title={!micSupported ? "Microphone requires HTTPS (or localhost) and a supported browser" : undefined}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              isLive
                ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-600"
                : "bg-[var(--console-violet)] text-[#0A0C14] hover:brightness-110"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isLive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {isLive ? "End Call" : "Start Call"}
          </button>

          {emotionHistory.length > 0 && (
            <div className="w-full">
              <div className="voxera-console-label text-[9px] mb-1.5">Session Trajectory</div>
              <EmotionTimeline history={emotionHistory} />
            </div>
          )}
        </div>

        {/* Scrolling annotated transcript — diagnostics attach to the exact turn that produced them. */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {turns.length === 0 && !interim ? (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
              <Radio className="w-6 h-6 text-[var(--console-text-dim)]" />
              <p className="text-[12.5px] text-[var(--console-text-dim)] max-w-[280px]">
                Start a call and speak — talk over the agent any time to interrupt it, just like a
                real conversation. Every turn's full engine breakdown appears below it.
              </p>
            </div>
          ) : (
            <>
              {turns.map((t) => (
                <div key={t.id} className="flex flex-col gap-2">
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug ${
                      t.role === "user"
                        ? "self-end bg-[var(--console-violet)]/20 text-[var(--console-text)]"
                        : "self-start bg-[var(--console-surface-raised)] border border-[var(--console-border)] text-[var(--console-text)]"
                    }`}
                  >
                    {t.text}
                  </div>
                  {t.role === "assistant" && t.diagnostics && (
                    <div className="self-start w-full pl-1">
                      <EngineDiagnosticPanel diagnostics={t.diagnostics} />
                      {t.cai && (
                        <div className="mt-2 text-[10px] font-mono text-[var(--console-text-dim)]">
                          CAI {t.cai.score}/100 · {t.cai.category}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {interim && (
                <div className="self-end max-w-[92%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug italic text-[var(--console-text-dim)] bg-[var(--console-violet)]/[0.08] border border-dashed border-[var(--console-violet)]/30">
                  {interim}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-xl bg-red-950/40 border border-red-900/60 text-[12.5px] text-red-300 px-4 py-3">
              {error}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[1px] sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <audio ref={playerRef} className="hidden" crossOrigin="anonymous" />
    </>
  );
}
