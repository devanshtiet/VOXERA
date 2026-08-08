"use client";

import { useState } from "react";
import { PhoneCall, Send, CheckCircle2, AlertCircle } from "lucide-react";

export function OutboundCallModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/telephony/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phoneNumber }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to trigger outbound call");
      }

      setStatusMsg({ type: "success", text: `Call initiated! SID: ${json.callSid}` });
      setPhoneNumber("");
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Outbound call failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition shadow-lg shadow-indigo-500/20"
      >
        <PhoneCall className="w-4 h-4" />
        <span>Place Outbound Call</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                <PhoneCall className="w-4 h-4 text-indigo-400" />
                <span>Initiate Outbound Call</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCall} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recipient Phone Number (E.164 format)
                </label>
                <input
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              {statusMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                    statusMsg.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}
                >
                  {statusMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? "Dialing..." : "Dial Call"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
