"use client";

import { useEffect, useState } from "react";
import { Bot, Plus, Trash2, ExternalLink, Loader2, Check, MessageSquare } from "lucide-react";

interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  type: string | null;
  status: string;
  description: string | null;
  system_prompt: string | null;
  greeting: string | null;
  voice_persona: string | null;
  created_at: string;
  updated_at: string;
}

const VOICE_PERSONAS = [
  { id: "female-friendly", label: "Female · Friendly" },
  { id: "male-formal", label: "Male · Formal" },
  { id: "female-formal", label: "Female · Formal" },
  { id: "male-friendly", label: "Male · Friendly" },
];

const BLANK_DRAFT = { name: "", description: "", system_prompt: "", greeting: "", voice_persona: "female-friendly" };

type Draft = typeof BLANK_DRAFT;

export default function AgentBuilderPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = () => {
    fetch("/api/admin/agents")
      .then((r) => r.json())
      .then((data: { agents?: Agent[]; error?: string }) => {
        if (data.error) {
          setError(data.error);
          setAgents([]);
        } else {
          setAgents(data.agents ?? []);
        }
      })
      .catch(() => {
        setError("Couldn't load agents.");
        setAgents([]);
      });
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const selectAgent = (agent: Agent) => {
    setSelectedId(agent.id);
    setError(null);
    setDraft({
      name: agent.name,
      description: agent.description ?? "",
      system_prompt: agent.system_prompt ?? "",
      greeting: agent.greeting ?? "",
      voice_persona: agent.voice_persona ?? "female-friendly",
    });
  };

  const startNew = () => {
    setSelectedId("new");
    setError(null);
    setDraft(BLANK_DRAFT);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError("Give the agent a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isNew = selectedId === "new";
      const res = await fetch(isNew ? "/api/admin/agents" : `/api/admin/agents/${selectedId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      loadAgents();
      setSelectedId(data.agent.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === "new" || !selectedId) return;
    if (!confirm("Delete this agent? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/agents/${selectedId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSelectedId(null);
      setDraft(BLANK_DRAFT);
      loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const isEditing = selectedId !== null;

  return (
    <div className="p-6 md:p-10 font-body min-h-screen">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <Bot className="w-8 h-8 text-[var(--color-accent-cyan)]" />
            Agent Builder
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)] mt-2 max-w-xl">
            Create custom voice agents with their own instructions and persona — each one can be picked for
            live testing or an outbound call from the public demo.
          </p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-gradient text-white text-[14px] font-semibold shadow-[0_0_15px_var(--color-accent-glow)] transition-all hover:scale-[1.02] flex-none"
        >
          <Plus className="w-4 h-4" /> New Agent
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Agent list */}
        <div className="flex flex-col gap-2">
          {agents === null && (
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] px-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading agents…
            </div>
          )}
          {agents !== null && agents.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] p-5 text-center text-[13px] text-[var(--color-text-secondary)]">
              No agents yet — create your first one.
            </div>
          )}
          {agents?.map((a) => (
            <button
              key={a.id}
              onClick={() => selectAgent(a)}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                selectedId === a.id
                  ? "border-[var(--color-border-active)] bg-[var(--color-bg-elevated)] shadow-[0_0_15px_var(--color-accent-glow)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-active)]"
              }`}
            >
              <div className="font-semibold text-[14px] text-[var(--color-text-primary)] truncate">{a.name}</div>
              {a.description && (
                <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{a.description}</div>
              )}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div>
          {!isEditing ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-subtle)] py-20 px-6">
              <Bot className="w-8 h-8 text-[var(--color-text-muted)]" />
              <p className="text-[14px] text-[var(--color-text-secondary)] max-w-sm">
                Select an agent to edit it, or create a new one — give it a name, a personality, and
                instructions, then test it live.
              </p>
            </div>
          ) : (
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col gap-6">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Front Desk Concierge"
                  className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[14px] text-[var(--color-text-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Shown wherever this agent can be picked for testing or a call"
                  className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[14px] text-[var(--color-text-primary)] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-[var(--color-accent-cyan)]" />
                  <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    System Prompt
                  </label>
                </div>
                <p className="text-[12.5px] text-[var(--color-text-muted)] mb-2">
                  What this agent knows and how it should talk — layered on top of VOXERA's core rules and
                  emotion-aware persona, which always still apply (safety and escalation behavior can't be
                  overridden here).
                </p>
                <textarea
                  value={draft.system_prompt}
                  onChange={(e) => setDraft((d) => ({ ...d, system_prompt: e.target.value }))}
                  rows={8}
                  placeholder="You are Bella, the concierge for a boutique hotel called Hotel Paradise. You're warm, a little playful, and always mention that checkout is at noon if someone asks about their stay..."
                  className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[13.5px] text-[var(--color-text-primary)] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                  Greeting
                </label>
                <input
                  type="text"
                  value={draft.greeting}
                  onChange={(e) => setDraft((d) => ({ ...d, greeting: e.target.value }))}
                  placeholder="Hey there! Thanks for calling — what can I help with today?"
                  className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl focus:ring-1 focus:ring-[var(--color-accent-cyan)] focus:border-[var(--color-accent-cyan)] text-[14px] text-[var(--color-text-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                  Voice
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {VOICE_PERSONAS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, voice_persona: v.id }))}
                      className={`px-3 py-2.5 rounded-xl border text-[12.5px] font-semibold transition-all ${
                        draft.voice_persona === v.id
                          ? "border-[var(--color-border-active)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] shadow-[0_0_10px_var(--color-accent-glow)]"
                          : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-active)]"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-950/10 border border-red-500/30 text-[13px] text-red-500 px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-4 pt-2 border-t border-[var(--color-border-subtle)]">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 text-[14px] font-semibold text-white btn-gradient rounded-xl transition-all hover:scale-[1.02] shadow-[0_0_15px_var(--color-accent-glow)] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {selectedId === "new" ? "Create Agent" : "Save Changes"}
                </button>

                {selectedId !== "new" && (
                  <>
                    <a
                      href={`/demo?agentId=${selectedId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-subtle)] text-[13.5px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-active)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Test this agent
                    </a>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="ml-auto flex items-center gap-2 text-[13px] font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </>
                )}

                {saved && (
                  <span className="flex items-center gap-1 text-[13px] text-emerald-400 font-medium font-mono">
                    <Check className="w-4 h-4" /> Saved
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
