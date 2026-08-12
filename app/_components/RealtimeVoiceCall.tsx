"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Radio, Sparkles } from "lucide-react";
import { getMicSupport, describeMicError } from "./micUtils";

const TARGET_SAMPLE_RATE = 16000;
const WS_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:3001";

type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

interface TranscriptTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  emotion?: string;
  final: boolean;
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

export function RealtimeVoiceCall() {
  const [micSupported, setMicSupported] = useState(true);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [interim, setInterim] = useState("");
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const active = useRef(false);

  useEffect(() => {
    setMicSupported(getMicSupport());
    return () => endCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endCall = useCallback(() => {
    active.current = false;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    setStatus("idle");
    setInterim("");
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
        setError(
          `Couldn't reach the realtime voice server at ${WS_URL}. Make sure it's running: npm run server`
        );
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
              setTurns((prev) => [
                ...prev,
                { id: `u-${Date.now()}`, role: "user", text: msg.text, final: true },
              ]);
              break;
            case "turn_start":
              setStatus("thinking");
              break;
            case "reply_text":
              setCurrentEmotion(msg.trace?.emotion?.current?.label ?? null);
              setTurns((prev) => [
                ...prev,
                { id: `a-${Date.now()}`, role: "assistant", text: msg.text, emotion: msg.trace?.emotion?.current?.label, final: true },
              ]);
              break;
            case "reply_audio": {
              setStatus("speaking");
              const audio = playerRef.current;
              if (audio) {
                audio.src = `data:${msg.mime};base64,${msg.audio}`;
                audio.onended = () => {
                  if (active.current) setStatus("listening");
                };
                void audio.play().catch(() => {
                  if (active.current) setStatus("listening");
                });
              }
              break;
            }
            case "turn_end":
              // status transitions to "listening" once audio finishes playing (see reply_audio)
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
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

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
    } catch (e) {
      setError(describeMicError(e));
      setStatus("error");
      endCall();
    }
  }, [endCall]);

  const isLive = status !== "idle" && status !== "error";

  return (
    <div className="flex flex-col gap-6">
      <section className="voxera-console flex flex-col rounded-2xl shadow-[0_20px_60px_-15px_rgba(10,12,20,0.5)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b voxera-console-hairline">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--console-violet)]/15 text-[var(--console-violet)] flex-none">
              <Radio className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[13px] font-bold text-[var(--console-text)] leading-tight">Live Voice Call</div>
              <div className="text-[10.5px] text-[var(--console-text-dim)]">
                Continuous WebSocket streaming — no record button, feels like a real call
              </div>
            </div>
          </div>
          <button
            onClick={isLive ? endCall : startCall}
            disabled={!micSupported && !isLive}
            title={!micSupported ? "Microphone requires HTTPS (or localhost) and a supported browser" : undefined}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all flex-none ${
              isLive
                ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-600"
                : "bg-[var(--console-violet)] text-[#0A0C14] hover:brightness-110"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isLive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {isLive ? "End Call" : "Start Call"}
          </button>
        </div>

        {isLive && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b voxera-console-hairline bg-[var(--console-violet)]/[0.06]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === "speaking" ? "bg-[var(--console-cyan)]" : "bg-[var(--console-violet)]"
              } animate-pulse`}
            />
            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--console-violet)]">
              {status === "connecting" && "Connecting…"}
              {status === "listening" && "Listening"}
              {status === "thinking" && "Thinking…"}
              {status === "speaking" && "Speaking"}
            </span>
            {currentEmotion && (
              <span className="flex items-center gap-1 text-[10.5px] text-[var(--console-text-dim)] ml-1">
                <Sparkles className="w-3 h-3 text-[var(--console-cyan)]" /> detected: {currentEmotion}
              </span>
            )}
            <div className={`voxera-waveform ml-auto ${status === "listening" ? "is-idle" : ""}`} aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>
        )}

        <div className="p-5 flex flex-col gap-3 max-h-[420px] overflow-y-auto">
          {turns.length === 0 && !interim ? (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
              <Radio className="w-6 h-6 text-[var(--console-text-dim)]" />
              <p className="text-[12.5px] text-[var(--console-text-dim)]">
                Click "Start Call" and speak — your words transcribe live, the agent replies in short
                sentences, and the reply plays back automatically. No buttons to press between turns.
              </p>
            </div>
          ) : (
            <>
              {turns.map((t) => (
                <div
                  key={t.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug ${
                    t.role === "user"
                      ? "self-end bg-[var(--console-violet)]/20 text-[var(--console-text)]"
                      : "self-start bg-[var(--console-surface-raised)] border border-[var(--console-border)] text-[var(--console-text)]"
                  }`}
                >
                  {t.text}
                  {t.role === "assistant" && t.emotion && (
                    <div className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--console-text-dim)] mt-1">
                      responded to: {t.emotion}
                    </div>
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
        </div>
      </section>

      {error && (
        <div className="rounded-xl bg-red-950/30 border border-red-900/50 text-[13px] text-red-400 px-4 py-3">
          {error}
        </div>
      )}

      <audio ref={playerRef} className="hidden" />
    </div>
  );
}
