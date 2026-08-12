"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, Loader2, ShieldAlert, MessageSquare, Zap } from "lucide-react";
import { EmotionTimeline, type EmotionHistoryPoint } from "./EngineDashboard";

type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

interface LiveState {
  emotionLabel: string;
  intensity: number;
  confidence: number;
  vad: { v: number; a: number; d: number };
  flags: Record<string, boolean>;
  caiScore: number;
  caiCategory: string;
  transcript: Array<{ role: "user" | "agent"; text: string }>;
}

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

export function PhoneCallDemo() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [emotionHistory, setEmotionHistory] = useState<EmotionHistoryPoint[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  useEffect(() => {
    return () => closeStream();
  }, [closeStream]);

  const placeCall = useCallback(async () => {
    setValidationError(null);
    setStatusMessage(null);

    const normalized = phoneNumber.trim().replace(/[\s()-]/g, "");
    if (!PHONE_RE.test(normalized)) {
      setValidationError("Enter a valid phone number in international format, e.g. +15551234567.");
      return;
    }

    setStatus("connecting");
    setLive(null);
    setEmotionHistory([]);

    try {
      const res = await fetch("/api/telephony/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: normalized }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setStatusMessage(data.error || "Too many calls requested — please wait before trying again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setStatusMessage(data.error || `Failed to initiate call (${res.status}).`);
        return;
      }

      const data: { success: boolean; callSid: string; status: string } = await res.json();
      setStatus("live");
      setStatusMessage(`Calling ${normalized} — pick up to talk with the VOXERA agent.`);
      setLive({
        emotionLabel: "neutral",
        intensity: 0,
        confidence: 0.5,
        vad: { v: 0, a: 0, d: 0 },
        flags: {},
        caiScore: 50,
        caiCategory: "Moderate Engagement",
        transcript: [],
      });

      const es = new EventSource(`/api/session/${data.callSid}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload.type) return;

          if (payload.type === "emotion") {
            setLive((prev) =>
              prev
                ? {
                    ...prev,
                    emotionLabel: payload.data.label || "neutral",
                    intensity: payload.data.intensity || 0,
                    confidence: payload.data.confidence || 0.5,
                    vad: payload.data.vad || { v: 0, a: 0, d: 0 },
                    flags: payload.data.flags || {},
                  }
                : prev
            );
            setEmotionHistory((h) => [
              ...h.slice(-59),
              { ts: Date.now(), label: payload.data.label || "neutral", intensity: payload.data.intensity || 0 },
            ]);
          } else if (payload.type === "cai") {
            setLive((prev) =>
              prev ? { ...prev, caiScore: payload.data.score || 50, caiCategory: payload.data.category || "Moderate Engagement" } : prev
            );
          } else if (payload.type === "transcript") {
            setLive((prev) =>
              prev
                ? { ...prev, transcript: [...prev.transcript, { role: payload.data.role, text: payload.data.text }] }
                : prev
            );
          } else if (payload.type === "escalation") {
            setStatusMessage("Call escalated to a human agent.");
          }
        } catch {
          // Ignore malformed SSE frames rather than tearing down the stream.
        }
      };

      es.onerror = () => {
        setStatus((s) => (s === "live" ? "ended" : s));
        setStatusMessage((m) => m ?? "Live connection lost — the call may have ended.");
        closeStream();
      };
    } catch (e) {
      setStatus("error");
      setStatusMessage(e instanceof Error ? e.message : "Failed to initiate call.");
    }
  }, [phoneNumber, closeStream]);

  const endCall = useCallback(() => {
    closeStream();
    setStatus("ended");
    setStatusMessage("Live view closed.");
  }, [closeStream]);

  const flagList = live ? Object.entries(live.flags).filter(([, v]) => v).map(([k]) => k) : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex-none">
            <PhoneCall className="w-4 h-4" />
          </span>
          <div>
            <div className="text-[13px] font-bold text-[var(--color-text-primary)] leading-tight">Phone Call Demo</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)]">Real outbound Twilio call — needs ngrok + Twilio configured locally</div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {status !== "live" && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+15551234567"
                disabled={status === "connecting"}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-active)] disabled:opacity-50"
              />
              <button
                onClick={placeCall}
                disabled={status === "connecting" || !phoneNumber.trim()}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl btn-gradient text-white text-[13px] font-semibold shadow-[0_0_15px_var(--color-accent-glow)] transition-all hover:scale-[1.02] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {status === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {status === "connecting" ? "Calling…" : "Call Me"}
              </button>
            </div>
          )}
          {validationError && <p className="text-[12px] text-red-400">{validationError}</p>}
          {statusMessage && (
            <div
              className={`text-[12.5px] px-3.5 py-2.5 rounded-xl border ${
                status === "error"
                  ? "bg-red-950/30 border-red-900/50 text-red-400"
                  : "bg-[var(--color-accent-cyan)]/[0.06] border-[var(--color-accent-cyan)]/25 text-[var(--color-text-secondary)]"
              }`}
            >
              {statusMessage}
            </div>
          )}
          {status === "live" && (
            <button onClick={endCall} className="self-start text-[12px] font-semibold text-red-400 hover:text-red-300 transition-colors">
              Close live view
            </button>
          )}
        </div>
      </section>

      {live && (
        <section className="flex flex-col bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--color-accent-cyan)]/30 bg-[var(--color-accent-cyan)]/[0.05] p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">Live Emotion</div>
              <div className="text-[18px] font-bold capitalize text-[var(--color-text-primary)]">{live.emotionLabel}</div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {(live.confidence * 100).toFixed(0)}% conf · intensity {live.intensity.toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1.5">
                VAD {live.vad.v.toFixed(2)} / {live.vad.a.toFixed(2)} / {live.vad.d.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-1 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-500" /> Engagement (CAI)
              </div>
              <div className="text-[18px] font-bold text-[var(--color-text-primary)]">{live.caiScore} <span className="text-[12px] font-normal text-[var(--color-text-muted)]">/ 100</span></div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">{live.caiCategory}</div>
            </div>
          </div>

          {flagList.length > 0 && (
            <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-red-400 text-[11.5px] font-medium">
              <ShieldAlert className="w-4 h-4 flex-none" />
              Pattern triggered: {flagList.map((f) => f.replace(/_/g, " ")).join(", ")}
            </div>
          )}

          <div className="px-5 pb-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-2">Emotion Timeline</div>
            <EmotionTimeline history={emotionHistory} />
          </div>

          <div className="px-5 pb-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Live Transcript
            </div>
            <div className="bg-[var(--color-bg-base)] rounded-xl p-3 border border-[var(--color-border-subtle)] max-h-56 overflow-y-auto space-y-2">
              {live.transcript.length === 0 ? (
                <p className="text-[11.5px] text-[var(--color-text-muted)] italic">Waiting for the call to connect and the first turn…</p>
              ) : (
                live.transcript.map((t, idx) => (
                  <div
                    key={idx}
                    className={`text-[12.5px] p-2.5 rounded-lg ${
                      t.role === "user"
                        ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                        : "bg-[var(--color-accent-violet)]/10 text-[var(--color-text-primary)] border border-[var(--color-accent-violet)]/20"
                    }`}
                  >
                    <span className="font-mono uppercase text-[9.5px] block opacity-60 mb-0.5">{t.role}</span>
                    {t.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed px-1">
        Note: the per-engine (HF / Lexicon / Local ONNX) breakdown shown in Text Demo isn't enabled for real phone
        calls — turning it on would add a real HuggingFace API call and local ONNX inference to every production
        call's latency and cost, not just demo ones. Live phone calls show the same final emotion, VAD, and CAI
        score the agent actually reasons from.
      </p>
    </div>
  );
}
