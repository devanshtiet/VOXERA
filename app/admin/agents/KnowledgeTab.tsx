"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, Loader2, Check, AlertCircle, Trash2, Clock, ExternalLink } from "lucide-react";

interface KnowledgeDoc {
  id: string;
  filename: string;
  mimeType: string;
  status: "processing" | "ready" | "failed" | "superseded";
  chunkCount: number;
  version: number;
  createdAt: number;
  errorMessage?: string | null;
}

const ACCEPTED_EXTENSIONS = ".txt,.pdf,.md,.markdown,.csv,.json,.docx";

function formatMime(mimeType: string): string {
  const map: Record<string, string> = {
    "text/plain": "TXT",
    "application/pdf": "PDF",
    "text/markdown": "Markdown",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  };
  return map[mimeType] ?? mimeType;
}

export function KnowledgeTab() {
  const [docs, setDocs] = useState<KnowledgeDoc[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDocs = useCallback(() => {
    fetch("/api/knowledge/documents?limit=50")
      .then((r) => r.json())
      .then((data: { documents?: KnowledgeDoc[]; error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setDocs(data.documents ?? []);
      })
      .catch(() => setError("Couldn't load knowledge documents."));
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // While anything is still "processing", poll for status updates.
  useEffect(() => {
    const hasProcessing = docs?.some((d) => d.status === "processing");
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(loadDocs, 2500);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [docs, loadDocs]);

  const uploadFiles = async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/knowledge/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to upload ${file.name}`);
      }
      loadDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/knowledge/documents?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      loadDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const visibleDocs = docs?.filter((d) => d.status !== "superseded") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--color-accent-cyan)]" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Knowledge Base
          </span>
        </div>
        <a
          href="/admin/knowledge"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Full manager <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-[12.5px] text-[var(--color-text-muted)] -mt-2">
        Upload reference material — pricing sheets, FAQs, policy docs — and this agent will pull from it
        when answering calls. Files are parsed, chunked, and embedded into the vector store automatically.
        Knowledge is shared across all agents on your account.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 px-6 cursor-pointer transition-colors ${
          dragOver
            ? "border-[var(--color-accent-cyan)] bg-[var(--color-bg-base)]"
            : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-active)]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => e.target.files?.length && uploadFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="w-6 h-6 text-[var(--color-accent-cyan)] animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-[var(--color-text-muted)]" />
        )}
        <p className="text-[13px] text-[var(--color-text-secondary)] font-medium">
          {uploading ? "Uploading…" : "Drag files here, or click to browse"}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">TXT · PDF · Markdown · CSV · JSON · DOCX — up to 10MB</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-950/10 border border-red-500/30 text-[13px] text-red-500 px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-none" /> {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {docs === null && (
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] px-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
          </div>
        )}
        {docs !== null && visibleDocs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] p-5 text-center text-[13px] text-[var(--color-text-secondary)]">
            No knowledge documents yet.
          </div>
        )}
        {visibleDocs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]"
          >
            <FileText className="w-4 h-4 flex-none text-[var(--color-text-muted)]" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{doc.filename}</div>
              <div className="text-[11px] text-[var(--color-text-muted)] font-mono flex items-center gap-2">
                <span>{formatMime(doc.mimeType)}</span>
                {doc.status === "ready" && <span>· {doc.chunkCount} chunks</span>}
                {doc.status === "failed" && doc.errorMessage && (
                  <span className="text-red-400 truncate">· {doc.errorMessage}</span>
                )}
              </div>
            </div>
            <StatusBadge status={doc.status} />
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={deletingId === doc.id}
              title="Delete document"
              className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: KnowledgeDoc["status"] }) {
  if (status === "ready") {
    return (
      <span className="flex-none flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
        <Check className="w-3 h-3" /> Ready
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="flex-none flex items-center gap-1 text-[11px] font-semibold text-amber-400">
        <Clock className="w-3 h-3 animate-pulse" /> Processing
      </span>
    );
  }
  return (
    <span className="flex-none flex items-center gap-1 text-[11px] font-semibold text-red-400">
      <AlertCircle className="w-3 h-3" /> Failed
    </span>
  );
}
