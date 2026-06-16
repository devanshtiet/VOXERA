"use client";

import { useEffect, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface KnowledgeEntry {
  id: string;
  topic: string;
  text: string;
  importance: number;
}

export default function KnowledgeBasePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Load existing knowledge entries
  useEffect(() => {
    fetch("/api/knowledge/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "", listAll: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.results ?? []);
        setLoadingEntries(false);
      })
      .catch(() => setLoadingEntries(false));
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResult(data);
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const grouped = entries.reduce<Record<string, KnowledgeEntry[]>>((acc, e) => {
    const topic = e.topic || "general";
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(e);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-10 font-body min-h-screen">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">Knowledge Base</h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mt-2">
          Upload PDFs or Text files to train your AI receptionist.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Panel */}
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl p-6 lg:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-6">Upload Document</h2>
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <div className="flex justify-center px-6 pt-8 pb-8 border-2 border-dashed border-[var(--color-border-subtle)] rounded-xl hover:border-[var(--color-accent-cyan)] transition-colors bg-[var(--color-bg-surface)]">
                <div className="space-y-2 text-center flex flex-col items-center">
                  <UploadCloud className="w-10 h-10 text-[var(--color-text-muted)] mb-2" />
                  <div className="flex text-[14px] text-[var(--color-text-secondary)] justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-semibold text-[var(--color-accent-cyan)] hover:text-white transition-colors focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".txt,.pdf"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-muted)] font-mono">TXT or PDF up to 5MB</p>
                </div>
              </div>
              {file && (
                <p className="mt-3 text-[13px] text-[var(--color-accent-cyan)] font-mono font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Selected: {file.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!file || isUploading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-[14px] font-semibold text-white btn-gradient shadow-[0_0_15px_var(--color-accent-glow)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading & Indexing..." : "Ingest Document"}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-[14px] font-semibold text-red-400">Upload Error</h3>
                <p className="mt-1 text-[13px] text-red-500/80">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-[14px] font-semibold text-emerald-400">Success!</h3>
                <p className="mt-1 text-[13px] text-emerald-500/80">
                  Document ingested. Broken down into {result.chunkCount} semantic chunks.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Ingested Knowledge List */}
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl p-6 lg:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">Ingested Knowledge</h2>
            <span className="px-2 py-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded text-[10px] font-mono text-[var(--color-accent-cyan)]">{entries.length} CHUNKS</span>
          </div>

          {loadingEntries ? (
            <p className="text-[var(--color-text-muted)] text-[13px] animate-pulse">Loading...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-[13px] italic">No knowledge documents ingested yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 hide-scrollbar">
              {Object.entries(grouped).map(([topic, items]) => (
                <details key={topic} className="group bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-subtle)] overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-base)] flex justify-between items-center transition-colors">
                    <span className="capitalize flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--color-accent-violet)]" /> {topic.replace("kb:", "")}</span>
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{items.length} chunks</span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="text-[12px] text-[var(--color-text-secondary)] p-3 bg-[var(--color-bg-base)] rounded-lg border border-[var(--color-border-subtle)]">
                        <div className="font-mono text-[10px] text-[var(--color-accent-cyan)] mb-1.5 opacity-70">ID: {item.id}</div>
                        <p className="line-clamp-3 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
