"use client";

import { useEffect, useState } from "react";
import { Activity, Radio, Volume2, ShieldAlert, Zap, MessageSquare } from "lucide-react";

interface LiveSessionState {
  sessionId: string;
  emotionLabel: string;
  intensity: number;
  confidence: number;
  caiScore: number;
  caiCategory: string;
  flags: Record<string, boolean>;
  transcript: Array<{ role: "user" | "agent"; text: string }>;
}

export function LiveCallMonitor() {
  const [activeCalls, setActiveCalls] = useState<Array<{ id: string; callerNumber: string; startedAt: number }>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LiveSessionState | null>(null);

  // Fetch active call logs
  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch("/api/session/active");
        const json = await res.json();
        if (json.calls) {
          setActiveCalls(json.calls);
          if (json.calls.length > 0 && !selectedSessionId) {
            setSelectedSessionId(json.calls[0].id || json.calls[0].sessionId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch active calls:", err);
      }
    }
    fetchCalls();
    const interval = setInterval(fetchCalls, 5000);
    return () => clearInterval(interval);
  }, [selectedSessionId]);

  // Subscribe to SSE stream for selected session
  useEffect(() => {
    if (!selectedSessionId) return;

    // Reset state for new session
    setLiveState({
      sessionId: selectedSessionId,
      emotionLabel: "neutral",
      intensity: 0,
      confidence: 0.5,
      caiScore: 50,
      caiCategory: "Moderate Engagement",
      flags: {},
      transcript: [],
    });

    const es = new EventSource(`/api/session/${selectedSessionId}/stream`);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload.type) return;

        setLiveState((prev) => {
          if (!prev) return null;
          const updated = { ...prev };

          if (payload.type === "emotion") {
            updated.emotionLabel = payload.data.label || "neutral";
            updated.intensity = payload.data.intensity || 0;
            updated.confidence = payload.data.confidence || 0.5;
            updated.flags = payload.data.flags || {};
          } else if (payload.type === "cai") {
            updated.caiScore = payload.data.score || 50;
            updated.caiCategory = payload.data.category || "Moderate Engagement";
          } else if (payload.type === "transcript") {
            updated.transcript = [
              ...updated.transcript,
              { role: payload.data.role, text: payload.data.text },
            ];
          }

          return updated;
        });
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    return () => {
      es.close();
    };
  }, [selectedSessionId]);

  const getEmotionColor = (label: string) => {
    switch (label) {
      case "anger":
      case "frustration":
      case "distress":
        return "text-red-400 border-red-500/50 bg-red-500/10";
      case "fear":
      case "confusion":
      case "disappointment":
        return "text-amber-400 border-amber-500/50 bg-amber-500/10";
      case "joy":
      case "gratitude":
      case "excitement":
        return "text-emerald-400 border-emerald-500/50 bg-emerald-500/10";
      default:
        return "text-cyan-400 border-cyan-500/50 bg-cyan-500/10";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl mb-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Live Call & Emotion Monitor</h2>
            <p className="text-xs text-slate-400">Real-time SSE emotion stream & prosody monitoring</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-3.5 h-3.5 mr-1 animate-spin" /> Stream Active
          </span>
        </div>
      </div>

      {activeCalls.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No active phone calls streaming at the moment.</p>
          <p className="text-xs text-slate-600 mt-1">Initiate a test call or receive a phone call to monitor live stream.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Call Selector */}
          <div className="space-y-3 border-r border-slate-800 pr-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Telephony Calls</h3>
            {activeCalls.map((call) => (
              <button
                key={call.id}
                onClick={() => setSelectedSessionId(call.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedSessionId === call.id
                    ? "bg-indigo-600/20 border-indigo-500 text-white"
                    : "bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{call.callerNumber || call.id}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ID: {call.id.slice(0, 10)}...
                </div>
              </button>
            ))}
          </div>

          {/* Live Emotion & CAI Display */}
          {liveState && (
            <div className="space-y-6 lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Emotion Ring / Badge */}
                <div className={`p-4 rounded-xl border ${getEmotionColor(liveState.emotionLabel)}`}>
                  <div className="text-xs uppercase font-medium tracking-wider opacity-80 mb-1">Detected Emotion</div>
                  <div className="text-2xl font-bold capitalize flex items-center justify-between">
                    <span>{liveState.emotionLabel}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-black/20 font-mono">
                      Conf: {(liveState.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-xs mt-2 opacity-80">
                    Intensity: {(liveState.intensity * 100).toFixed(0)}%
                  </div>
                </div>

                {/* CAI Score */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="text-xs uppercase font-medium tracking-wider text-slate-400 mb-1">Engagement Index (CAI)</div>
                  <div className="text-2xl font-bold text-white flex items-center justify-between">
                    <span>{liveState.caiScore} <span className="text-sm font-normal text-slate-400">/ 100</span></span>
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {liveState.caiCategory}
                  </div>
                </div>
              </div>

              {/* Active Emotion Pattern Flags */}
              {Object.values(liveState.flags).some(Boolean) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-2 text-red-400 text-xs font-medium">
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    Pattern Triggered: {Object.entries(liveState.flags).filter(([, v]) => v).map(([k]) => k.replace(/_/g, " ")).join(", ")}
                  </span>
                </div>
              )}

              {/* Real-time Transcript */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Live Transcript Stream
                </h3>
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 max-h-48 overflow-y-auto space-y-2">
                  {liveState.transcript.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Waiting for turn transcript...</p>
                  ) : (
                    liveState.transcript.map((t, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded ${t.role === "user" ? "bg-slate-900 text-slate-200" : "bg-indigo-950/50 text-indigo-200 border border-indigo-900/50"}`}>
                        <span className="font-semibold uppercase text-[10px] block opacity-70 mb-0.5">{t.role}</span>
                        {t.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
