"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const VOICE_PERSONAS = [
  { id: "female-friendly", label: "Female · Friendly", model: "aura-asteria-en" },
  { id: "male-formal", label: "Male · Formal", model: "aura-orion-en" },
  { id: "female-formal", label: "Female · Formal", model: "aura-athena-en" },
  { id: "male-friendly", label: "Male · Friendly", model: "aura-arcas-en" },
];

export default function SettingsPage() {
  const [selectedVoice, setSelectedVoice] = useState("female-friendly");
  const [greeting, setGreeting] = useState("Welcome to Hotel Paradise. How may I assist you today?");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedVoice = localStorage.getItem("voxera_voice_persona");
    const savedGreeting = localStorage.getItem("voxera_greeting");
    if (savedVoice) setSelectedVoice(savedVoice);
    if (savedGreeting) setGreeting(savedGreeting);
  }, []);

  const handleSave = () => {
    localStorage.setItem("voxera_voice_persona", selectedVoice);
    localStorage.setItem("voxera_greeting", greeting);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 md:p-10 font-body min-h-screen">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">Settings</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mt-2">
          Configure your AI receptionist's voice, tone, and greeting message.
        </p>
      </header>

      <div className="max-w-2xl space-y-8">
        {/* Voice Persona Section */}
        <section className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-2">Voice Persona (FR-25)</h2>
          <p className="text-[14px] text-[var(--color-text-muted)] mb-6">
            Select the voice and tone your AI receptionist will use when speaking to customers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VOICE_PERSONAS.map((persona) => (
              <button
                key={persona.id}
                onClick={() => setSelectedVoice(persona.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  selectedVoice === persona.id
                    ? "border-[var(--color-border-active)] bg-[var(--color-bg-base)] shadow-[0_0_15px_var(--color-accent-glow)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-active)]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex-none flex items-center justify-center border ${
                    selectedVoice === persona.id ? "border-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/20" : "border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]"
                  }`}
                >
                  {selectedVoice === persona.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-cyan)] shadow-[0_0_5px_var(--color-accent-cyan)]" />}
                </div>
                <div>
                  <div className={`text-[14px] font-semibold ${selectedVoice === persona.id ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>{persona.label}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] tracking-wider mt-0.5">{persona.model}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Custom Greeting Section */}
        <section className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-2">Custom Greeting</h2>
          <p className="text-[14px] text-[var(--color-text-muted)] mb-6">
            The first thing your AI receptionist says when answering a call.
          </p>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[14px] text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)] resize-none"
            placeholder="Welcome to Hotel Paradise. How may I assist you today?"
          />
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 text-[14px] font-semibold text-white btn-gradient rounded-xl transition-all hover:scale-[1.02] shadow-[0_0_15px_var(--color-accent-glow)]"
          >
            Save Settings
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-[13px] text-emerald-400 font-medium font-mono">
              <Check className="w-4 h-4" /> Settings saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
