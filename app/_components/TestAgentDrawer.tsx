"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radio, X, Phone, PhoneOff, Sparkles, ChevronDown, Database, ListTree } from "lucide-react";
import { getMicSupport, describeMicError } from "./micUtils";
import { useVoiceActivityDetection } from "./useVoiceActivityDetection";
import {
  EngineDiagnosticPanel,
  EmotionTimeline,
  type DiagnosticEmotionResult,
  type EmotionHistoryPoint,
} from "./EngineDashboard";

const TARGET_SAMPLE_RATE = 16000;
// ~100ms per WS frame at 16kHz — batches the AudioWorklet's 128-sample
// (2.7ms) render quanta into chunks actually useful for streaming STT.
const SEND_CHUNK_SAMPLES = 1600;
const WS_BASE_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:3001";

type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

interface Tenant {
  id: string;
  name: string;
  authUserId: string;
}

interface TurnPolicy {
  acknowledgeFirst: boolean;
  pace: string;
  allowUpsell: boolean;
  escalate: string;
  notes: string[];
}

interface TurnMemory {
  write?: { tier: string; recordId?: string; merged?: boolean };
  retrieved?: { mtmIds: string[]; ltmUserIds: string[]; ltmClientIds: string[] };
}

interface TranscriptTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  emotion?: string;
  diagnostics?: DiagnosticEmotionResult;
  cai?: { score: number; category: string };
  policy?: TurnPolicy;
  memory?: TurnMemory;
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(""); // "" = demo agent
  const [activeTenantName, setActiveTenantName] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
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
  // AudioWorkletNode.process() fires once per 128-sample render quantum —
  // sending a WS frame per call (~2.7ms of audio, ~375 msg/s) is far too
  // fragmented for Deepgram. Buffer on the main thread and flush in
  // larger batches instead, same chunking pattern AcousticDemo.tsx uses.
  const captureBufferRef = useRef<Int16Array[]>([]);
  const captureBufferedSamplesRef = useRef(0);

  useEffect(() => {
    setMicSupported(getMicSupport());
  }, []);

  // Fetch the list of real configured agents (tenants) once the drawer is
  // first opened, so "test my own agent" doesn't require reloading the page.
  // Fails silently to an empty list (falls back to the demo agent) — most
  // commonly because Supabase isn't reachable in this environment, which
  // /api/tenants already degrades gracefully for.
  useEffect(() => {
    if (!open || tenants.length > 0) return;
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data: { tenants: Tenant[] }) => setTenants(data.tenants ?? []))
      .catch(() => {});
  }, [open, tenants.length]);

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
    captureNodeRef.current?.port.close();
    captureNodeRef.current?.disconnect();
    micSourceRef.current?.disconnect();
    micAnalyserRef.current?.disconnect();
    micAudioContextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    captureNodeRef.current = null;
    micSourceRef.current = null;
    micAnalyserRef.current = null;
    micAudioContextRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    captureBufferRef.current = [];
    captureBufferedSamplesRef.current = 0;
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

      const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
      const wsUrl = selectedTenant
        ? `${WS_BASE_URL}?clientId=${encodeURIComponent(selectedTenant.authUserId)}`
        : WS_BASE_URL;
      setActiveTenantName(selectedTenant?.name ?? null);

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        active.current = true;
      };

      ws.onerror = () => {
        setError(`Couldn't reach the realtime voice server at ${WS_BASE_URL}. Make sure it's running: npm run server`);
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
                  policy: msg.trace?.policy,
                  memory: { write: msg.trace?.memoryWrite, retrieved: msg.trace?.retrieved },
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

      // AudioWorkletNode, not the deprecated ScriptProcessorNode — this
      // context is shared with VAD below, and mixing the legacy
      // ScriptProcessor and modern AudioWorklet subsystems on one context
      // is what caused "Failed to construct AudioWorkletNode: No execution
      // context available" previously. One consistent capture path avoids
      // it, and also avoids the separate failure mode of two independent
      // AudioContexts each opening their own MediaStreamAudioSourceNode on
      // the same mic stream (unreliable across browsers — one can end up
      // silently receiving silence instead of live audio).
      await audioContext.audioWorklet.addModule("/audio-worklets/pcm-capture-processor.js");
      const captureNode = new AudioWorkletNode(audioContext, "pcm-capture-processor");
      captureNodeRef.current = captureNode;
      captureBufferRef.current = [];
      captureBufferedSamplesRef.current = 0;
      captureNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!active.current || ws.readyState !== WebSocket.OPEN) return;
        const downsampled = downsampleTo16kMono(event.data, audioContext.sampleRate);
        captureBufferRef.current.push(downsampled);
        captureBufferedSamplesRef.current += downsampled.length;
        if (captureBufferedSamplesRef.current < SEND_CHUNK_SAMPLES) return;

        const chunks = captureBufferRef.current;
        captureBufferRef.current = [];
        captureBufferedSamplesRef.current = 0;
        const merged = new Int16Array(chunks.reduce((sum, c) => sum + c.length, 0));
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        ws.send(merged.buffer);
      };
      source.connect(captureNode);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      captureNode.connect(silentGain);
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
  }, [endCall, startLevelLoop, vad, bargeIn, tenants, selectedTenantId]);

  const isLive = status !== "idle" && status !== "error";

  // The right-hand analytics panel always reflects the *latest* turn rather
  // than accumulating — that's what keeps it a fast, glanceable "what's
  // happening right now" view instead of another scrolling list to chase.
  const latestAssistantTurn = useMemo(
    () => [...turns].reverse().find((t) => t.role === "assistant" && t.diagnostics),
    [turns]
  );

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
        className={`fixed inset-y-0 right-0 z-[105] w-full sm:w-[820px] xl:w-[960px] max-w-full voxera-console border-l border-[var(--console-border)] shadow-[-20px_0_60px_-15px_rgba(10,12,20,0.6)] transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Pinned top bar — orb, status, call control. Compact and horizontal
            so it never eats into the conversation/analytics split below. */}
        <div className="flex-none border-b border-[var(--console-border)] px-5 py-3.5 flex items-center gap-4">
          <div ref={orbRef} className="voxera-orb !w-14 !h-14 flex-none">
            <div className="voxera-orb-core !w-8 !h-8">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-bold text-[var(--console-text)] leading-tight">Live Test Call</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--console-text-dim)]">
              {status === "idle" && "Ready"}
              {status === "connecting" && "Connecting…"}
              {status === "listening" && "Listening"}
              {status === "thinking" && "Thinking…"}
              {status === "speaking" && "Speaking"}
              {status === "error" && "Error"}
            </div>
          </div>

          <button
            onClick={isLive ? endCall : startCall}
            disabled={!micSupported && !isLive}
            title={!micSupported ? "Microphone requires HTTPS (or localhost) and a supported browser" : undefined}
            className={`ml-auto flex-none flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              isLive
                ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-600"
                : "bg-[var(--console-violet)] text-[#0A0C14] hover:brightness-110"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isLive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {isLive ? "End Call" : "Start Call"}
          </button>
        </div>

        {/* Agent selector — pick which configured tenant's actual prompt,
            knowledge base, and brand-voice memory to test against, instead
            of always the hardcoded demo agent. Locked once a call starts. */}
        <div className="flex-none border-b border-[var(--console-border)] px-5 py-2 flex items-center gap-2 text-[11px]">
          <span className="font-mono uppercase tracking-widest text-[var(--console-text-dim)] flex-none">Testing:</span>
          {isLive ? (
            <span className="font-semibold text-[var(--console-text)]">{activeTenantName ?? "Demo agent"}</span>
          ) : (
            <div className="relative flex-1 min-w-0 max-w-[280px]">
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full appearance-none bg-[var(--console-surface-raised)] border border-[var(--console-border)] rounded-lg px-2.5 py-1 pr-6 text-[11px] font-semibold text-[var(--console-text)] focus:outline-none focus:border-[var(--console-border-active)]"
              >
                <option value="">Demo agent</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[var(--console-surface)] text-[var(--console-text)]">
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--console-text-dim)]" />
            </div>
          )}
          {tenants.length === 0 && (
            <span className="text-[var(--console-text-dim)]">(no configured agents found — testing the demo agent)</span>
          )}
        </div>

        {/* Split body: analytics update on the left the instant new data
            arrives, conversation keeps flowing independently on the right —
            neither one waits on or pushes around the other. */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* LEFT — live analytics, always reflecting the latest turn */}
          <div className="sm:w-[360px] flex-none min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4 border-b sm:border-b-0 sm:border-r border-[var(--console-border)]">
            <div>
              <div className="voxera-console-label text-[10px] font-bold mb-2">
                Live Analytics {status === "thinking" && <span className="text-[var(--console-cyan)] normal-case">· updating…</span>}
              </div>
              {latestAssistantTurn?.diagnostics ? (
                <>
                  <EngineDiagnosticPanel diagnostics={latestAssistantTurn.diagnostics} />
                  {latestAssistantTurn.cai && (
                    <div className="mt-2 text-[10px] font-mono text-[var(--console-text-dim)]">
                      CAI {latestAssistantTurn.cai.score}/100 · {latestAssistantTurn.cai.category}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--console-border)] p-4 text-center text-[11.5px] text-[var(--console-text-dim)]">
                  Engine breakdown for each reply appears here the instant it's ready.
                </div>
              )}
            </div>

            {(latestAssistantTurn?.policy || latestAssistantTurn?.memory) && (
              <div>
                <button
                  onClick={() => setShowReasoning((s) => !s)}
                  className="w-full flex items-center justify-between voxera-console-label text-[9px] mb-1.5"
                >
                  <span className="flex items-center gap-1.5">
                    <ListTree className="w-3 h-3" /> Source of Truth — why this reply
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showReasoning ? "rotate-180" : ""}`} />
                </button>
                {showReasoning && (
                  <div className="rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-3 flex flex-col gap-3 text-[11px]">
                    {latestAssistantTurn.policy && (
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--console-text-dim)] mb-1">Policy applied</div>
                        <div className="text-[var(--console-text)]">
                          Pace: <span className="font-semibold capitalize">{latestAssistantTurn.policy.pace}</span>
                          {latestAssistantTurn.policy.acknowledgeFirst && " · acknowledge-first"}
                          {!latestAssistantTurn.policy.allowUpsell && " · no upsell"}
                          {latestAssistantTurn.policy.escalate !== "none" && (
                            <span className="text-amber-400"> · escalate: {latestAssistantTurn.policy.escalate}</span>
                          )}
                        </div>
                        {latestAssistantTurn.policy.notes.length > 0 && (
                          <ul className="mt-1 list-disc list-inside text-[var(--console-text-dim)]">
                            {latestAssistantTurn.policy.notes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                    {latestAssistantTurn.memory && (
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--console-text-dim)] mb-1 flex items-center gap-1.5">
                          <Database className="w-3 h-3" /> Memory
                        </div>
                        {latestAssistantTurn.memory.write && (
                          <div className="text-[var(--console-text)]">
                            Wrote to <span className="font-semibold">{latestAssistantTurn.memory.write.tier}</span>
                            {latestAssistantTurn.memory.write.merged && " (merged with existing memory)"}
                          </div>
                        )}
                        {latestAssistantTurn.memory.retrieved && (
                          <div className="text-[var(--console-text-dim)] mt-0.5">
                            Retrieved {latestAssistantTurn.memory.retrieved.mtmIds.length} recent +{" "}
                            {latestAssistantTurn.memory.retrieved.ltmUserIds.length} long-term-user +{" "}
                            {latestAssistantTurn.memory.retrieved.ltmClientIds.length} client memories for this reply
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="voxera-console-label text-[9px] mb-1.5">Session Trajectory</div>
              <EmotionTimeline history={emotionHistory} />
            </div>
          </div>

          {/* RIGHT — continuous conversation */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            {turns.length === 0 && !interim ? (
              <div className="flex flex-col items-center justify-center text-center gap-2 py-10 flex-1">
                <Radio className="w-6 h-6 text-[var(--console-text-dim)]" />
                <p className="text-[12.5px] text-[var(--console-text-dim)] max-w-[280px]">
                  Start a call and speak — talk over the agent any time to interrupt it, just like a
                  real conversation. Live analytics for every turn appear on the left.
                </p>
              </div>
            ) : (
              <>
                {turns.map((t) => (
                  <div
                    key={t.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug flex flex-col gap-1 ${
                      t.role === "user"
                        ? "self-end bg-[var(--console-violet)]/20 text-[var(--console-text)]"
                        : "self-start bg-[var(--console-surface-raised)] border border-[var(--console-border)] text-[var(--console-text)]"
                    }`}
                  >
                    {t.text}
                    {t.role === "assistant" && t.emotion && (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--console-text-dim)]">
                        responded to: {t.emotion}
                      </span>
                    )}
                  </div>
                ))}
                {interim && (
                  <div className="self-end max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug italic text-[var(--console-text-dim)] bg-[var(--console-violet)]/[0.08] border border-dashed border-[var(--console-violet)]/30">
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
