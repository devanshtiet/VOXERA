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

interface Country {
  iso: string;
  name: string;
  dialCode: string;
  /** Expected national significant number length. Omit for variable-length countries (generic 7-14 digit check applies instead). */
  nsnLength?: number;
}

// India defaults first per product requirement — everything else alphabetical-ish by common demo usage.
const COUNTRIES: Country[] = [
  { iso: "IN", name: "India", dialCode: "+91", nsnLength: 10 },
  { iso: "US", name: "United States", dialCode: "+1", nsnLength: 10 },
  { iso: "CA", name: "Canada", dialCode: "+1", nsnLength: 10 },
  { iso: "GB", name: "United Kingdom", dialCode: "+44", nsnLength: 10 },
  { iso: "AU", name: "Australia", dialCode: "+61", nsnLength: 9 },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971", nsnLength: 9 },
  { iso: "SG", name: "Singapore", dialCode: "+65", nsnLength: 8 },
  { iso: "DE", name: "Germany", dialCode: "+49" },
  { iso: "FR", name: "France", dialCode: "+33", nsnLength: 9 },
];

export function PhoneCallDemo() {
  const [countryIdx, setCountryIdx] = useState(0); // India by default
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

    const country = COUNTRIES[countryIdx];
    const localDigits = phoneNumber.trim().replace(/\D/g, "");

    if (!localDigits) {
      setValidationError(`Enter a phone number (without the ${country.dialCode} country code — that's added automatically).`);
      return;
    }
    if (country.nsnLength && localDigits.length !== country.nsnLength) {
      setValidationError(`${country.name} numbers are ${country.nsnLength} digits — you entered ${localDigits.length}.`);
      return;
    }

    const normalized = `${country.dialCode}${localDigits}`;
    if (!PHONE_RE.test(normalized)) {
      setValidationError("That doesn't look like a valid phone number — check the digits and try again.");
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
  }, [phoneNumber, countryIdx, closeStream]);

  const endCall = useCallback(() => {
    closeStream();
    setStatus("ended");
    setStatusMessage("Live view closed.");
  }, [closeStream]);

  const flagList = live ? Object.entries(live.flags).filter(([, v]) => v).map(([k]) => k) : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="voxera-console flex flex-col rounded-2xl shadow-[0_20px_60px_-15px_rgba(10,12,20,0.5)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b voxera-console-hairline">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex-none">
            <PhoneCall className="w-4 h-4" />
          </span>
          <div>
            <div className="text-[13px] font-bold text-[var(--console-text)] leading-tight">Phone Call Demo</div>
            <div className="text-[10.5px] text-[var(--console-text-dim)]">Real outbound Twilio call — needs ngrok + Twilio configured locally</div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {status !== "live" && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex flex-1 rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] overflow-hidden focus-within:border-[var(--console-border-active)]">
                <select
                  value={countryIdx}
                  onChange={(e) => setCountryIdx(Number(e.target.value))}
                  disabled={status === "connecting"}
                  aria-label="Country code"
                  className="px-3 py-2.5 bg-transparent border-r border-[var(--console-border)] text-[13px] text-[var(--console-text)] focus:outline-none disabled:opacity-50"
                >
                  {COUNTRIES.map((c, i) => (
                    <option key={c.iso} value={i} className="bg-[var(--console-surface)] text-[var(--console-text)]">
                      {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                  placeholder={COUNTRIES[countryIdx].nsnLength ? "9876543210" : "phone number"}
                  disabled={status === "connecting"}
                  className="flex-1 min-w-0 px-4 py-2.5 bg-transparent text-[14px] text-[var(--console-text)] placeholder:text-[var(--console-text-dim)] focus:outline-none disabled:opacity-50"
                />
              </div>
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
                  ? "bg-red-950/40 border-red-900/60 text-red-300"
                  : "bg-[var(--console-cyan)]/[0.08] border-[var(--console-cyan)]/25 text-[var(--console-text-dim)]"
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
        <section className="voxera-console flex flex-col rounded-2xl shadow-[0_20px_60px_-15px_rgba(10,12,20,0.5)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--console-cyan)]/30 bg-[var(--console-cyan)]/[0.06] p-4">
              <div className="voxera-console-label text-[10px] mb-1">Live Emotion</div>
              <div className="text-[18px] font-bold capitalize text-[var(--console-text)]">{live.emotionLabel}</div>
              <div className="text-[11px] text-[var(--console-text-dim)] mt-1">
                {(live.confidence * 100).toFixed(0)}% conf · intensity {live.intensity.toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-[var(--console-text-dim)] mt-1.5">
                VAD {live.vad.v.toFixed(2)} / {live.vad.a.toFixed(2)} / {live.vad.d.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
              <div className="voxera-console-label text-[10px] mb-1 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" /> Engagement (CAI)
              </div>
              <div className="text-[18px] font-bold text-[var(--console-text)]">{live.caiScore} <span className="text-[12px] font-normal text-[var(--console-text-dim)]">/ 100</span></div>
              <div className="text-[11px] text-[var(--console-text-dim)] mt-1">{live.caiCategory}</div>
            </div>
          </div>

          {flagList.length > 0 && (
            <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-red-400 text-[11.5px] font-medium">
              <ShieldAlert className="w-4 h-4 flex-none" />
              Pattern triggered: {flagList.map((f) => f.replace(/_/g, " ")).join(", ")}
            </div>
          )}

          <div className="px-5 pb-4">
            <div className="voxera-console-label text-[10px] mb-2">Emotion Timeline</div>
            <EmotionTimeline history={emotionHistory} />
          </div>

          <div className="px-5 pb-5">
            <div className="voxera-console-label text-[10px] mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Live Transcript
            </div>
            <div className="bg-[var(--console-surface)] rounded-xl p-3 border border-[var(--console-border)] max-h-56 overflow-y-auto space-y-2">
              {live.transcript.length === 0 ? (
                <p className="text-[11.5px] text-[var(--console-text-dim)] italic">Waiting for the call to connect and the first turn…</p>
              ) : (
                live.transcript.map((t, idx) => (
                  <div
                    key={idx}
                    className={`text-[12.5px] p-2.5 rounded-lg ${
                      t.role === "user"
                        ? "bg-[var(--console-surface-raised)] text-[var(--console-text)]"
                        : "bg-[var(--console-violet)]/10 text-[var(--console-text)] border border-[var(--console-violet)]/20"
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
