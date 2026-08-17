# VOXERA Technical Implementation Handbook

This document serves as the authoritative technical implementation handbook for the VOXERA platform, describing the current production-ready architecture, workflows, database schemas, and external integrations.

---

## 1. Overview

VOXERA is a multi-tenant, emotion-adaptive AI voice receptionist and SaaS operations platform. It allows businesses to handle phone calls, answer customer queries using a document-trained Knowledge Base (RAG), and book appointments with real-time Google Calendar and Resend email synchronizations.

---

## 2. High-Level Architecture

The system operates across three primary boundaries:
1. **Next.js App Router Frontend & Management API**: Handles tenant authentication, document uploads, settings configuration, and session analytics.
2. **Telephony & Audio Streaming Engine**: Connects Twilio phone lines to a real-time WebSocket connection, handling bi-directional audio codecs (mulaw to PCM and vice versa) and streaming audio packets to/from Deepgram.
3. **AI Orchestrator & Database Layer**: Routes transcriptions through vector memory stores, applies emotion-aware prompt policies, runs LLM tool-calling loops, interacts with Google Calendar/Resend, and records structured event logs in Supabase Postgres.

```
                  [Caller Phone Line]
                          │ (SIP)
                          ▼
                   [Twilio Telecom]
                          │ (HTTPS Webhook)
                          ▼
            [Next.js api/telephony/incoming] ── (Retrieves Tenant ID)
                          │ (Returns TwiML Connect Stream)
                          ▼
               [Twilio Media Stream]
                          │ (WebSockets / 8kHz mulaw)
                          ▼
            [Next.js api/telephony/stream] ── (TelephonyStreamHandler)
                          │
                          ├─► [PCM Conversion] ──► [Deepgram Live STT]
                          │                                │ (Text Transcript)
                          │                                ▼
                          │                        [AI Orchestrator]
                          │                                │ (Semantic Memory + RAG)
                          │                                ├─► [Supabase Vector DB]
                          │                                ├─► [Groq Llama 3.3]
                          │                                ├─► [Integrations: Google Calendar, Resend]
                          │                                ▼
                          │                        (Text Response)
                          │                                │
                          │                                ▼
                          │                        [Deepgram TTS]
                          │                                │ (MP3 Audio)
                          │                                ▼
                          │                        [Audio Codec / mulaw]
                          │                                │ (8kHz mulaw)
                          │                                ▼
                          └────────────────────────► [Twilio Stream]
```

---

## 3. Feature Status Summary

All core features are implemented, tested, and fully integrated:
* **Multi-Tenant Isolation & Security (FR-23)**: Fully active and hardened. Row-Level Security (RLS) is strictly enforced on all tables mapping to `auth.uid()`. Client IDs are securely resolved server-side from Supabase cookies. Tenant integrations (like Google Calendar) use AES-256-GCM encryption for credential storage.
* **Voice Cloning & TTS (FR-24)**: Supports integration with ElevenLabs for custom tenant voice cloning alongside Deepgram Aura.
* **Customer Recovery SMS (FR-25)**: Automated post-call SMS follow-ups are triggered for conversations ending with negative sentiments using Twilio/Resend.
* **Distributed State & Redis (FR-26)**: Core telephony queues and circuit breaker states are synchronized across horizontal instances using `ioredis` and Pub/Sub.
* **Telephony & Real-Time Codecs (FR-1, FR-19)**: Inbound Twilio streams are processed in-process via custom WebSockets. Supports queue routing, wait metric estimations, and status logging.
* **Emotion-Aware Routing (FR-11, FR-18)**: Dynamically injects voice coaching rules into system prompts. Triggers human-escalation flags upon sustained customer negativity or extreme anger.
* **Vector Memory & Document Ingestion (FR-10, FR-16)**: Supports paginated document table, error detail drawer, cascade deletions, and automatic duplicate prevention (superseding old document chunks).
* **Advisory Slot Locking (FR-13)**: Employs Postgres-level advisory transactions to eliminate double-booking race conditions.
* **Integrations (FR-14, FR-15)**: Actively syncs Google Calendar events via a custom OAuth2 JWT client and sends personalized confirmation emails via Resend.
* **SVG/CSS Dashboard (FR-22)**: Visualizes real-time metrics, heatmaps, trends, conversion rates, and confidence distributions without heavy graphing libraries.

---

## 4. System Modules

### 4.1 Authentication & Multi-Tenancy
* **Purpose**: Restricts access to client analytics, settings, and documents, guaranteeing zero cross-tenant leakage.
* **Implementation Logic**:
  - Uses `@supabase/ssr` to instantiate cookie-based clients.
  - Layout-level middleware (`app/admin/layout.tsx`) intercepts unauthenticated routes and redirects users to `/login`.
  - Backend API endpoints extract the authenticated client credentials directly from the session cookie instead of trusting client-supplied URL parameters.
  - Supabase backend enforces multi-tenant isolation directly via RLS policies mapping to `auth.uid()`. `SERVICE_ROLE_KEY` usage has been deprecated in favor of secure user contexts.
* **Files & Directories**:
  - [server.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/db/server.ts) — Server-side Supabase client initialization.
  - [page.tsx](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/login/page.tsx) & [actions.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/login/actions.ts) — Server actions for login, logout, and signup.
  - [layout.tsx](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/admin/layout.tsx) — Protected layout routing.

### 4.2 Telephony, WebSockets & Audio Codecs
* **Purpose**: Establishes bi-directional audio connections with Twilio.
* **Implementation Logic**:
  - Incoming Webhook (`/api/telephony/incoming`) validates Twilio signatures, verifies active phone numbers, checks queue thresholds, and generates hold (`buildWaitTwiml`) or media stream (`buildConnectTwiml`) TwiML responses.
  - WebSocket Upgrade (`/api/telephony/stream`) runs an in-process socket handler.
  - `TelephonyStreamHandler` converts 8kHz mono mulaw audio bytes to 16kHz linear PCM using an in-memory decoding lookup table.
  - Transformed PCM is piped into `DeepgramLiveWrapper` via WebSockets.
  - When the orchestrator produces a response, Deepgram TTS generates an MP3, which is decoded to raw PCM, resampled, encoded back into 8kHz mulaw bytes, and flushed to Twilio.
* **Files & Directories**:
  - [twilio.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/telephony/twilio.ts) — HMAC webhook validation and TwiML generators.
  - [stream-handler.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/telephony/stream-handler.ts) — Mulaw codec conversion table and telephony socket manager.
  - [route.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/api/telephony/incoming/route.ts) — Webhook entry endpoint.
  - [route.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/api/telephony/stream/route.ts) — WebSocket upgrade endpoint.
  - [route.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/api/telephony/status/route.ts) — Twilio callback endpoint to update call durations.
  - [server.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/server.ts) — Standalone WebSocket server running on port 3001 for browser/script testing.
  - **Issue #14 Enhancements**:
    - **Energy-Based Barge-In**: Incoming audio packets compute RMS energy via `computeRmsEnergy()`. TTS playback is only interrupted when RMS exceeds `CONFIG.telephony.bargeInEnergyThreshold` (default: 500), preventing false triggers from background noise.
    - **PCM Accumulation**: Decoded PCM chunks are buffered in `turnAudioChunks[]` during each speech turn and concatenated for acoustic feature extraction upon final transcript.
    - **Interruption Tracking**: Barge-in events increment `turnInterruptionCount`, which is passed to the CAI calculator for engagement scoring.

### 4.3 Speech Emotion Recognition (SER) & Emotion Engine
* **Purpose**: Dynamically adjusts agent speaking tone, policies, and safeguards based on the caller's feeling states.
* **Implementation Logic**:
  - Classifies caller mood into one of 11 labels: `neutral`, `frustration`, `anger`, `sadness`, `distress`, `fear`, `confusion`, `joy`, `gratitude`, `excitement`, `disappointment`.
  - **Concurrent Text-Emotion Router** (`detectTextEmotion()` in `detect.ts`): runs the remote HuggingFace engine (`detectTextEmotionHF`, `ml-detect.ts`) and the deterministic Lexicon engine (`detectTextEmotionLexicon`) **concurrently** via `Promise.all` — neither waits on the other. If HF returns a valid signal within its latency budget (`CONFIG.emotion.hfLatencyBudgetMs`, default 200ms, timeout covers the full fetch + JSON parse), it's used as primary; otherwise the already-computed Lexicon result is used immediately, with no blocking. Both results are always returned together (`TextEmotionResult { primary, lexicon, hf, selection }`) for diagnostic comparison.
  - **Local ONNX Emotion Engine** (`local-onnx-detect.ts` / `local-emotion-classifier.ts`, diagnostic-only for now): a 7-class emotion model run in-process via `@xenova/transformers`, same underlying model as the remote HF path (`j-hartmann/emotion-english-distilroberta-base`, via a community ONNX conversion). Not wired into the production router yet — available for side-by-side comparison via the diagnostic layer below; promoting it to primary/replacing the remote call is a Phase 2 decision pending comparative accuracy data.
  - **Diagnostic Instrumentation** (`emotion-debug.ts`, `runDiagnosticEmotion()`): when `CONFIG.emotion.diagnosticMode` is enabled (off by default in production to avoid extra latency/cost on live calls), every turn additionally runs HF + Lexicon + Local ONNX + Acoustic concurrently and returns a full side-by-side breakdown — label, confidence, intensity, VAD, latency, and per-engine importance/memory-tier classification — plus the exact fusion decision production made. Attached to `TurnTrace.emotionDiagnostics` and logged as an `emotion_diagnostic` session event. Manual comparison CLI: `scripts/test-emotion-diagnostic.ts`.
  - **`/demo` — three-mode testing dashboard** (`app/_components/DemoModeSwitcher.tsx`): **Text** mode opts every turn into `diagnostics: true`, rendering the same HF/Lexicon/Local-ONNX/Acoustic breakdown live (`EngineDashboard.tsx`), with curated ambiguous example inputs. **Acoustic** mode (`AcousticDemo.tsx`) captures continuous browser microphone audio via the Web Audio API, downsamples to 8kHz mono PCM client-side, and POSTs ~1.6s chunks to `app/api/acoustic/analyze/route.ts` — a thin transport that calls the *exact same* `extractAcousticFeatures()`/`detectAudioEmotion()` used for real calls, no separate browser-side inference. **Phone Call** mode (`PhoneCallDemo.tsx`) places a real outbound Twilio call (rate-limited per-IP via `lib/telephony/rate-limit.ts`, since the endpoint is public/unauthenticated) and subscribes to the same SSE stream the admin dashboard uses, showing live transcript/emotion/CAI — but not the full per-engine breakdown, since enabling `diagnosticMode` for every real phone call would add HF-API and local-ONNX cost/latency to production traffic, not just demo calls. Local setup (ngrok + Twilio webhook config) documented in `docs/PHONE_CALL_DEMO_SETUP.md`.
  - **Confidence-aware Fusion** (`fuseEmotion()` in `detect.ts`): blends text and acoustic signals with two safeguards — a minimum-confidence floor (`CONFIG.emotion.fusionMinConfidence`, default 0.3: if both engines are effectively guessing, default to neutral rather than picking a weak winner) and a confidence margin (`CONFIG.emotion.fusionConfidenceMargin`, default 0.15: the winning engine must be meaningfully more confident, not just marginally, or text wins the tie-break). Preserves the `isMixed` flag and both individual engine signals (`textSignal`, `audioSignal`) for diagnostics.
  - **Context-aware punctuation handling**: Multiple exclamation marks (`!!`) and question marks (`???`) boost arousal in the direction of the already-detected valence, instead of blindly assuming frustration. A **positivity safety net** catches edge cases where a clearly positive message (high valence + high arousal) was incorrectly classified as a negative emotion.
  - Maps labels to structured voice configurations (`lib/emotion/persona.ts`), with 11 full persona definitions including tone instructions, forbidden phrases, opening style coaching, and example sentences.
  - Injects formatted markdown blocks at the highest priority location inside the LLM prompt.
  - Traverses the session timeline to identify sustained negative turns (3 consecutive anger/distress turns or intensity > 0.70), returning `escalate: "human"` to immediately route the caller to human staff.
* **Files & Directories**:
  - `lexicon.ts` — 35+ keyword-to-emotion mappings with VAD offsets and weights.
  - `detect.ts` — Concurrent text-emotion router (`detectTextEmotion`), Lexicon engine (`detectTextEmotionLexicon`), confidence-aware fusion (`fuseEmotion`), and the unused-but-kept local sentiment fallback (`detectTextEmotionLocal`).
  - `ml-detect.ts` — Remote HuggingFace 7-class emotion API (`detectTextEmotionHF`), independent of the Lexicon engine, full-operation latency budget.
  - `emotion-label-map.ts` — Shared 7-class → 11-label/VAD mapping used by both the remote HF and local ONNX engines (same underlying model).
  - `local-onnx-detect.ts` / `local-emotion-classifier.ts` — Local 7-class ONNX emotion engine (diagnostic-only), via `@xenova/transformers`.
  - `emotion-debug.ts` — Diagnostic instrumentation (`runDiagnosticEmotion`, `DiagnosticEmotionResult`).
  - `classifier.ts` — Local 2-class sentiment model (`@xenova/transformers`). **Not part of the production path** — documented as unused/legacy in its header comment.
  - `persona.ts` — 11 full persona definitions with tone rules, warnings, and priority overrides.
  - `context.ts` (`lib/agent/`) — System prompt builder incorporating emotion coach blocks.
  - `policy.ts` (`lib/agent/`) — Escalation, pacing, and upsell directive engine.
  - `audio-emotion.ts` — Scored multi-feature acoustic inference (see 4.10 below) mapping physical acoustic features to an `EmotionSignal` with `source: "audio"`.

### 4.4 Memory & Vector Store (RAG)
* **Purpose**: Stores and retrieves semantic memories and client documents.
* **Implementation Logic**:
  - Stores memory records in a flat Postgres table `memories`.
  - Semantic lookup uses the `match_memories` Supabase RPC, computing cosine similarity over OpenAI-compatible 1536-dimensional embeddings.
  - Automatically deduplicates and merges similar memories using cosine similarity (`>= 0.85`).
  - Implements **Adaptive Memory Ranking & Time-Decay**: 
    - Stored memories maintain an `importance_score` that decays dynamically based on a **7-day half-life** since last retrieval or edit activity.
    - Critical user details (such as allergies, permanent preferences, VIP status, language) are preserved with a score floor of `0.70`, ensuring they never decay out of priority.
    - Retrieving a memory adds a logarithmic boost `+ 0.1 * ln(1 + retrieval_count)` and updates `last_retrieved_at`.
  - Implements **Selection Explainability**: Every retrieved memory calculates its score components (similarity, dynamic importance, recency, retrieval frequency) and generates a detailed explanation for RAG evaluation.
  - **Timeline Chronological Grouping**: Retrieved memories are grouped into event buckets based on time proximity (within 48 hours) and topic sharing, formatting memory context as a narrative sequence.
* **Files & Directories**:
  - [retrieval.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/memory/retrieval.ts) — Semantic search via pgvector, adaptive exponential decay ranking, and timeline clustering.
  - [writer.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/memory/writer.ts) — Memory extraction, recurrence tracking, and LTM promotion.

### 4.5 Knowledge Base Ingestion Pipeline
* **Purpose**: Transforms raw uploaded files into searchable vector knowledge chunks.
* **Implementation Logic**:
  - Upload route (`/api/knowledge/upload`) parses files (.txt, .pdf) and creates an initial document log in the `knowledge_documents` table with status `'processing'`.
  - Compares the uploaded filename against existing documents. If a matching name exists, it increments the file version, marks the old document as `'superseded'`, and removes its existing chunks from the database to avoid duplicate search hits.
  - Extracts text, splits it into semantic chunks, generates 1536-dimensional embeddings, and writes to the `memories` table under a shared `documentId` key.
  - On failure, logs the message stack to `errorMessage` and flags status as `'failed'`. On success, writes status `'ready'`.
  - Cascading deletes are enforced: removing a document via the API executes a foreign key cascade that automatically purges all associated vector memory chunks.
* **Files & Directories**:
  - [ingest.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/knowledge/ingest.ts) — Version checking, chunking, and db serialization.
  - [route.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/api/knowledge/upload/route.ts) — Raw file parsing api.
  - [route.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/api/knowledge/documents/route.ts) — Search pagination and cascade deletion endpoint.
  - [page.tsx](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/admin/knowledge/page.tsx) — Management dashboard featuring polling refreshes and error drawers.

### 4.6 Booking Engine & Third-Party Integrations
* **Purpose**: Schedules customer bookings while ensuring thread-safe calendars and notifications.
* **Implementation Logic**:
  - **Thread Safety**: Booking execution runs via the `create_reservation_atomic` Postgres function. This RPC acquires a transactional advisory lock (`pg_advisory_xact_lock`) on the hash of the slot (`clientId + date + time`), preventing race-condition double bookings.
  - **Google Calendar Sync**: Employs a custom REST client to issue signed JSON Web Tokens (RS256 signature using `crypto`) to Google's OAuth2 endpoints on behalf of a Service Account. Tenant credentials are AES-256 encrypted at rest in the `tenant_credentials` table. FreeBusy calls check external conflicts before updating events.
  - **Email Alerts**: Uses the Resend SDK to dynamically send html emails based on state: Confirmations (Green), Rescheduled modifications (Blue), and Cancellations (Red).
* **Files & Directories**:
  - [reservations.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/db/reservations.ts) — Reservation queries, cancellation logs, and atomic RPC invoker.
  - [calendar.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/integrations/calendar.ts) — Custom Google OAuth JWT handler and calendar event API actions.
  - [email.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/integrations/email.ts) — Resend template formatter and dispatcher.
  - [tools.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/agent/tools.ts) — Tool definitions for `create_booking`, `modify_booking`, `cancel_booking`, and `check_availability`.

### 4.7 Analytics Engine
* **Purpose**: Aggregates operation metrics and visualizes dashboards.
* **Implementation Logic**:
  - Analytics API aggregates database tables, filtering on the authenticated `clientId`.
  - Custom SVG/CSS progress arcs, segmented horizontal bars, and vertical layout grids render clean graphics natively, eliminating runtime issues associated with heavy visualization modules.
  - Tool execution routes write logs directly to the database via `dispatchToolCall`, avoiding double counts.
* **Files & Directories**:
  - [route.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/api/analytics/route.ts) — Heatmap, trends, and bucket statistics aggregator.
  - [page.tsx](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/admin/page.tsx) — Dashboard UI.

### 4.8 AI Orchestrator
* **Purpose**: Coordinates conversational loops with optimized parallelism.
* **Implementation Logic**:
  - Uses `llama-3.3-70b-versatile` hosted on Groq.
  - Computes the Commitment Acoustic Index (CAI) based on speech rate, pause intervals, and intensity.
  - Executes tool calling loops, updating sessions with log records on execution outcomes.
  - **Parallelized pipeline**: Independent database fetches (`LTM_user` + `MTM`) run concurrently via `Promise.all`. Memory write and retrieval are also parallelized. This reduces the critical path to only the LLM inference call.
  - **Fire-and-forget observability logging**: All 8 session event log writes are dispatched with `void` (no `await`), ensuring that logging failures or Supabase timeouts never block the user-facing response.
* **Files & Directories**:
  - [orchestrator.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/agent/orchestrator.ts) — Core parallelized loop with fire-and-forget logging.
  - [llm.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/agent/llm.ts) — LLM call wrappers.
  - [session-logger.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/logging/session-logger.ts) — Circuit-breaker-protected event logger that catches all errors internally.

### 4.9 Supabase Resilience Layer
* **Purpose**: Prevents cascading timeouts when the Supabase database is temporarily unreachable.
* **Implementation Logic**:
  - **Timeout Fetch**: All Supabase HTTP requests are wrapped with a 5-second `AbortController` timeout, preventing DNS failures (`ENOTFOUND`) from blocking the pipeline for 10+ seconds.
  - **Distributed Circuit Breaker**: After 3 consecutive Supabase failures, the circuit opens for a 30-second cooldown period. The failure state is pushed asynchronously to Redis (`voxera:cb:consecutive_failures`) and broadcasted via Pub/Sub, updating the local cache of all distributed instances instantly without incurring network penalty on read.
  - **Graceful Degradation**: When the circuit is open, the orchestrator continues to function using in-memory STM data and the local lexicon-based emotion engine. Logging is silently skipped. The system self-heals when connectivity is restored.
* **Files & Directories**:
  - [supabase.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/db/supabase.ts) — Timeout fetch wrapper, circuit breaker state, and health check API.

### 4.10 Acoustic Feature Extraction & Voice Intelligence
* **Purpose**: Extracts physical acoustic properties from raw PCM audio to power real emotion analysis, CAI scoring, and barge-in detection.
* **Implementation Logic**:
  - Operates on 8kHz mono linear16 PCM buffers accumulated during each caller speech turn.
  - **RMS Energy**: Root-mean-square amplitude via `Buffer.readInt16LE()`. Used for barge-in energy thresholds (prevents false interrupts from noise) and vocal intensity.
  - **Zero-Crossing Rate (ZCR)**: Counts sign changes per 20ms frame. Discriminates voiced/unvoiced speech, and (see below) contributes to laughter detection.
  - **Pitch Estimation**: Autocorrelation on windowed PCM frames to estimate F0 in Hz. Returns median pitch and coefficient of variation (pitch dynamics).
  - **Energy Modulation Rate**: Mean absolute frame-to-frame energy delta, normalized 0–1. Captures rapid amplitude oscillation characteristic of crying, sobbing, and laughter.
  - **Pitch Contour**: Linear-regression slope over the chronologically-ordered per-frame pitch trace, classified as `rising` / `falling` / `flat` / `unstable` (high coefficient of variation). Computed from the frames in their original time order — the median/variance stats use a separately sorted copy so contour direction isn't corrupted by the sort.
  - **Speaking Rate**: Words-per-minute from transcript word count and audio duration.
  - **Pause Detection**: Scans for contiguous silence regions (RMS below threshold for >300ms). Returns pause count and total pause duration.
  - All computations are pure JavaScript — no FFT libraries, no native bindings, no external dependencies.
  - **Scored Multi-Feature Emotion Inference** (`lib/emotion/audio-emotion.ts`, `detectAudioEmotion`): each candidate label (anger, excitement, sadness, distress, joy, frustration, confusion, fear, disappointment, neutral) accumulates a weighted score from multiple feature contributions rather than a single rigid if/else threshold. Notably:
    - **Crying/sobbing** → `distress`: high energy modulation + elevated pitch + broken speech (pause count) + unstable pitch contour, distinguished from anger (which is high-energy but *low* pitch variation/modulation — controlled, not broken).
    - **Laughter** → `joy`: high ZCR + rapid energy modulation + mid/high pitch — the first use of `zeroCrossingRate` in label inference (previously extracted but unused).
  - **Confidence Ceiling**: scales with utterance duration and pattern clarity — up to `CONFIG.emotion.audioConfidenceCeiling` (0.75) for utterances under 8s, and up to `audioConfidenceCeilingLong` (0.85) for longer utterances with a clear, distinctive winning pattern (large score margin over the runner-up label). Short/ambiguous audio (<2s) stays capped near 0.3.
* **Files & Directories**:
  - `acoustic.ts` — Pure-JS DSP feature extractor.
  - `audio-emotion.ts` — Scored multi-feature label inference and confidence calibration.

### 4.11 Input Guardrails & AI Safety
* **Purpose**: Pre-LLM defense layer that detects and blocks prompt injection and jailbreak attempts in voice transcripts before they reach the AI orchestrator.
* **Implementation Logic**:
  - **Multi-Pattern Detection**: 12+ regex patterns covering role-assumption attacks ("ignore previous instructions"), system prompt extraction ("reveal your system prompt"), delimiter injection (`<<<SYSTEM>>>`), DAN/jailbreak tropes, encoding evasion, and hypothetical framing.
  - **Weighted Scoring**: Each pattern contributes a calibrated weight (0.5–0.9) to a composite threat score. Inputs scoring ≥0.6 are blocked.
  - **Safe Deflection**: Blocked inputs receive natural-sounding voice-appropriate responses (randomized from 5 templates) without ever reaching the LLM.
  - **Defense-in-Depth**: This pre-LLM guard complements the existing post-LLM `guardOutput()` filter. The two layers operate independently.
* **Files & Directories**:
  - [input-guard.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/agent/input-guard.ts) — Pattern matching, scoring, and deflection engine.

---

## 5. Database Schema

Here are the primary multi-tenant database tables used in the production environment:

### 5.1 `knowledge_documents`
Tracks administrative file uploads:
```sql
CREATE TABLE public.knowledge_documents (
  id text PRIMARY KEY,
  "clientId" text NOT NULL,
  filename text NOT NULL,
  "mimeType" text NOT NULL,
  status text NOT NULL DEFAULT 'processing', -- 'processing' | 'ready' | 'failed' | 'superseded'
  "chunkCount" integer DEFAULT 0,
  "errorMessage" text,
  version integer DEFAULT 1,
  "createdAt" bigint NOT NULL
);
```

### 5.2 `memories`
Stores 1536-dimensional vector embedding chunks:
```sql
CREATE TABLE public.memories (
  id text PRIMARY KEY,
  tier text NOT NULL,
  "userId" text,
  "clientId" text NOT NULL,
  ts bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  text text NOT NULL,
  summary text NOT NULL DEFAULT '',
  entities text[] NOT NULL DEFAULT '{}',
  topic text NOT NULL DEFAULT 'general',
  emotion text NOT NULL DEFAULT 'neutral',
  vad_v real NOT NULL DEFAULT 0,
  vad_a real NOT NULL DEFAULT 0,
  vad_d real NOT NULL DEFAULT 0,
  intensity real NOT NULL DEFAULT 0,
  importance real NOT NULL DEFAULT 0.5,
  importance_score real NOT NULL DEFAULT 0.5,
  retrieval_count integer NOT NULL DEFAULT 0,
  last_retrieved_at bigint,
  embedding vector(1536),
  "sourceUtteranceIds" text[] NOT NULL DEFAULT '{}',
  recurrence integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false,
  ttl bigint
);
```

### 5.2.1 Adaptive Memory Ranking & Explainability Pipeline
The Memory & RAG subsystem employs an adaptive memory ranking, decay, explainability, and chronological event grouping pipeline:
1. **Dynamic Scoring & Re-ranking:** Re-ranking uses pgvector similarity coupled with custom metrics.
2. **Adaptive Score Decay:** Static memory importance score (`importance_score`) decays over time with a **7-day half-life** since last retrieval or write activity to prevent obsolete data from cluttering agent context.
3. **Preservation Floors for Critical Facts:** Key facts (LTM user/client memories, or records containing critical keywords like allergies, preferences, language, vip, payment, compliance) have a preservation floor of `0.70`, ensuring they never decay below this point and are consistently prioritized.
4. **Retrieval Usage Boost:** Whenever a memory is selected in the retrieval results, its `retrieval_count` is incremented, and its `importance_score` gets a logarithmic boost: `importance_score = min(decayed_importance + 0.05 * ln(1 + retrieval_count), 1.0)`.
5. **Selection Explainability:** Every retrieval result maps the exact relevance score components (semantic similarity, dynamic importance, recency, emotion match, staleness) to produce a detailed natural language explanation for administrators.
6. **Chronological Timeline Grouping:** Retrieved memories are grouped into events using proximity (within 48 hours) and topic sharing, providing a sequential narrative to the LLM.

### 5.3 `reservations`
Manages customer bookings:
```sql
CREATE TABLE public.reservations (
  id text PRIMARY KEY,
  "clientId" text NOT NULL,
  date text NOT NULL, -- YYYY-MM-DD
  time text NOT NULL, -- HH:MM
  status text NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'cancelled'
  "customerName" text,
  "customerEmail" text,
  "customerPhone" text,
  "calendarEventId" text,
  "createdAt" bigint NOT NULL
);
```

### 5.4 `call_logs`
Tracks telephony call metrics:
```sql
CREATE TABLE public.call_logs (
  id text PRIMARY KEY, -- Twilio CallSid
  "clientId" text NOT NULL,
  "callerNumber" text,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'failed' | 'queued'
  "startedAt" bigint NOT NULL,
  "endedAt" bigint,
  "durationMs" bigint,
  "sessionId" text,
  "queueWaitMs" bigint DEFAULT 0
);
```

---

## 6. Important Design Decisions

1. **Flattened Vector Database Schema**: Swapped dynamic metadata JSONB blobs for explicit columns (`vad_v`, `intensity`, etc.) to prevent runtime type exceptions, simplify indexing, and accelerate mathematical scoring matches in Postgres.
2. **Postgres advisory locks (`pg_advisory_xact_lock`)**: Implemented transactional advisory locks during slot allocation, securing appointments against race conditions without relying on heavy external queue engines.
3. **No Third-Party Charting Packages**: Programmed raw SVGs and Tailwind layouts for heatmaps and analytics dials to avoid runtime canvas issues, improve loading speed, and ensure layout responsiveness.
4. **Native Local Development execution**: The environment runs using `npm run dev` and `npm run server` locally while using external managed services (Supabase, Groq, Deepgram), minimizing local computing overhead.
5. **Fire-and-Forget Observability**: Session event logging is treated as non-critical telemetry that should never block the user-facing response path. All log writes are dispatched without `await` and protected by a circuit breaker, ensuring the system remains responsive even during complete database outages.
6. **Context-Aware Punctuation Detection**: Punctuation cues (`!!`, `???`, ALL CAPS) amplify arousal in the direction of the already-detected valence rather than forcing a fixed label. This prevents false negatives where enthusiastic positive messages are misclassified as frustration.
7. **Supabase Circuit Breaker**: A threshold-based circuit breaker (3 failures → 30s cooldown) prevents the cascading timeout pattern where N sequential failed database calls each block for ~3-5 seconds, compounding to 30+ second response times.

---

## 7. Current Limitations

* **Pitch Estimation Accuracy**: The autocorrelation-based pitch estimator works well for clean speech but may produce inaccurate results in very noisy telephony environments. A Wav2Vec2/HuBERT-based feature extractor would improve robustness.

---

## 8. Changelog

### 2026-08-11 — Emotion Engine Phase 1 Integration (Issues #26–#31)

**Context**: The prior "Hybrid Emotion Engine" entry below claimed a working concurrent HF+Lexicon architecture, but the orchestrator was still importing a since-renamed function (`detectTextEmotionML`), which broke `npm run build` entirely and failed 19 tests — see the corrected entry above it. This entry covers the follow-up Phase 1 work: fixing that break, then auditing and completing the remaining emotion-engine architecture against the requirements in Issues #26–#31.

**Features Implemented / Verified:**
1. **Orchestrator build-break fix**: Restored `npm run build` by pointing the orchestrator at the new concurrent `detectTextEmotion()` router instead of the removed `detectTextEmotionML` export.
2. **Concurrent HF + Lexicon architecture (#26)**: Verified `detectTextEmotion()` runs `detectTextEmotionHF` and `detectTextEmotionLexicon` concurrently via `Promise.all`, with no circular fallback and a latency budget covering the full HF operation (fetch + JSON parsing). Added `__tests__/emotion/concurrent-engines.test.ts`.
3. **Acoustic engine upgrade (#28)**: Verified the scored multi-feature acoustic inference (crying/sobbing → distress, laughter → joy via ZCR, recalibrated 0.75→0.85 confidence ceiling) was already implemented, and fixed a real bug found while adding test coverage: `pitchContour` was computed on the magnitude-sorted pitch array instead of the chronologically-ordered one, so it could never actually return `"falling"`. Added `__tests__/emotion/acoustic-scored-inference.test.ts`.
4. **Emotion fusion safeguards (#29)**: Verified `fuseEmotion()`'s minimum-confidence floor and confidence-margin requirements were already implemented per spec.
5. **Diagnostic instrumentation (#27, #30)**: Added `lib/emotion/emotion-debug.ts` (`runDiagnosticEmotion()`), which runs HF + Lexicon + a new local ONNX emotion engine + Acoustic concurrently and returns a full side-by-side comparison (label, confidence, intensity, VAD, latency, per-engine importance/memory-tier), plus the exact fusion decision production made. Wired into the orchestrator behind `CONFIG.emotion.diagnosticMode` (default off). Added `scripts/test-emotion-diagnostic.ts` (CLI) and `__tests__/emotion/emotion-diagnostic.test.ts`.
6. **New local ONNX emotion engine**: Added `lib/emotion/local-onnx-detect.ts` / `local-emotion-classifier.ts`, a 7-class local emotion model via `@xenova/transformers` (community ONNX conversion of the same `j-hartmann/emotion-english-distilroberta-base` model already used remotely). Diagnostic-only — not wired into the production router. Fixed a real tokenizer compatibility bug in the process: this conversion's `tokenizer.json` serializes BPE merges as `[a, b]` pairs (a newer `tokenizers` library format) but the installed `@xenova/transformers@2.17.2` expects `"a b"` strings; worked around by pre-patching the cached tokenizer.json before the pipeline loads it.
7. **`classifier.ts` disposition**: Kept in place (not removed), header comment now explicitly documents it as unused legacy code — the production path uses the HF/Lexicon/Local-ONNX engines above, not this 2-class sentiment model.

**Validation Performed:**
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 243 tests passed, 0 failures across 25 files
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeded
- Manual diagnostic CLI validation (`scripts/test-emotion-diagnostic.ts`) against the real downloaded local ONNX model, covering the representative cases from Issue #31 ("I'm feeling low", "I'm fine", "I can't believe you did that", "Great. Just great.") and the acoustic validation scenario from Issue #28 (crying child, neutral wording) — engines disagree in exactly the ways expected (e.g. sarcasm fools both the lexicon and the local ONNX model; the acoustic engine alone correctly resolves the crying scenario to `distress`).

**Explicitly not done (Phase 2, per Issues #26/#28/#29/#31 scope boundaries)**: final HF vs. Lexicon vs. Local-ONNX selection/fusion architecture, cross-modal text+acoustic mathematical fusion, ≥95% accuracy evaluation against a labeled dataset, replacing the remote HF call with the local ONNX model in production.

### 2026-08-11 — Hybrid Emotion Engine & Telephony Integration

**Features Implemented:**
1. **Hybrid Text Emotion Engine**: Integrated `detectTextEmotionML` using HuggingFace's `j-hartmann/emotion-english-distilroberta-base` model. It accurately catches sarcasm and complex nuances that the previous lexicon missed.
2. **Deterministic Fallback Circuit**: A strict 200ms `AbortController` timeout wraps the HuggingFace API call. If the external ML server lags or drops, the system instantly falls back to the local `detectTextEmotion` lexicon, guaranteeing zero-lag responses for callers.
3. **Telephony Integration**: Resolved merge conflicts between the new ML emotion logic and Vikas's Telephony pipeline. The orchestrator now accurately fuses ML-based text sentiment with physical acoustic vocal features.
4. **Strict CI Compliance**: Enforced ESLint strict typing by updating legacy ignore blocks to `@ts-expect-error` in `lib/emotion/classifier.ts`.

### 2026-07-02 — CI Lint & TypeScript Build Fix

**Problems Discovered:**
1. **ESLint `no-require-imports` errors** in two compiled JavaScript files (`lib/emotion/detect.js` and `test-stress-runner.js`) used CommonJS `require()` syntax, which is forbidden by the `@typescript-eslint/no-require-imports` rule enforced in CI.
2. **TypeScript build error** in `scripts/test-emotion.ts` at line 44: `result.confidenceCategory` is declared as optional (`?`) in the `EmotionSignal` interface, but was accessed without a null check, causing `TS2532: Object is possibly 'undefined'`.
3. **React Hook warnings** in `app/admin/knowledge/page.tsx` (lines 73 and 98): two `useEffect` hooks referenced `fetchDocuments` without listing it as a dependency, triggering `react-hooks/exhaustive-deps` warnings.

**Root Causes:**
1. The `.js` files were TypeScript compiler outputs that retained CommonJS module syntax (`require()`, `module.exports`). The ESLint configuration does not ignore `.js` files (only `.next/`, `out/`, `build/`), so these compiled outputs were linted alongside source code.
2. The `EmotionSignal.confidenceCategory` field is typed as `ConfidenceCategory | undefined` (optional with `?`). While `detectTextEmotion()` always populates this field, TypeScript's strict mode correctly flags the access as unsafe since the type allows `undefined`.
3. The `fetchDocuments` async function was defined as a plain closure inside the component body, creating a new reference on every render but not tracked by `useEffect` dependency arrays.

**Files Modified:**
- [detect.js](file:///Users/hardikkadd/Desktop/Projects/VOXERA/lib/emotion/detect.js) — Converted CommonJS `require()` to ES module `import` declarations; replaced `Object.defineProperty(exports, ...)` with `export` function declarations.
- [test-stress-runner.js](file:///Users/hardikkadd/Desktop/Projects/VOXERA/test-stress-runner.js) — Converted CommonJS `require()` and `__importDefault` wrapper to ES module `import`; updated internal call-site references from compiled patterns (`detect_1.detectTextEmotion`) to direct names.
- [test-emotion.ts](file:///Users/hardikkadd/Desktop/Projects/VOXERA/scripts/test-emotion.ts) — Added optional chaining (`?.`) with nullish coalescing (`?? "unknown"`) for the `confidenceCategory.level` access.
- [page.tsx](file:///Users/hardikkadd/Desktop/Projects/VOXERA/app/admin/knowledge/page.tsx) — Wrapped `fetchDocuments` in `useCallback` with `[currentPage, searchQuery]` dependencies; added `fetchDocuments` to both `useEffect` dependency arrays.

**Implementation Approach:**
- All fixes preserve existing runtime behaviour. No ESLint rules were disabled, no TypeScript strict checks were suppressed, and no `as any` casts were introduced.
- The ES module conversions in `.js` files maintain the same public API surface (`detectTextEmotion`, `detectAudioEmotionStub`, `fuseEmotion` exports).
- The TypeScript fix uses `?.` + `??` to safely degrade to `"unknown"` if `confidenceCategory` is ever `undefined`, matching the defensive coding style used elsewhere in the codebase.

**Validation Performed:**
- `npm run lint` → **0 errors, 0 warnings** (all lint errors and the `useEffect` dependency warnings resolved).
- `npm run build` → **Build succeeded** (TypeScript type checking passed, all 15 static pages generated, production bundle optimized).

**Final Outcome:**
All CI-blocking errors are resolved. The existing Pull Request on `feature/improve-emotion-analysis` is now ready to merge.


### 2026-07-09 — Voice Cloning & Security Hardening (Issues #16 & #12)

**Features Implemented:**
1. **Custom Voice Cloning (Issue #16)**: Integrated ElevenLabs TTS engine, allowing tenants to configure custom voice personas.
2. **Automated Recovery SMS (Issue #16)**: Added logic to `TelephonyStreamHandler` to detect negative ending sentiments (anger, frustration) and trigger an automated SMS recovery workflow to the caller via configured templates.
3. **Database Security & RLS (Issue #12)**: Implemented Row-Level Security (RLS) across `session_logs`, `reservations`, `memories`, `knowledge_documents`, and `call_logs`. Refactored backend routes to use `auth.uid()` rather than bypassing security via `SERVICE_ROLE_KEY`.
4. **Credential Encryption (Issue #12)**: Developed an AES-256-GCM encryption utility (`lib/util/crypto.ts`) and a new `tenant_credentials` table. Google Calendar private keys are now securely encrypted at rest.
5. **Compound Indexing (Issue #12)**: Added crucial compound indices via `migration_v8.sql` for analytical dashboards (`idx_session_logs_client_ts`, `idx_reservations_client_slot`), ensuring O(log N) scale performance.

### 2026-07-10 — Distributed Architecture & Redis Scaling (Issue #13)

**Features Implemented:**
1. **Redis Infrastructure**: Integrated `ioredis` with an in-memory `MockRedis` fallback to keep local dev environments stable without requiring a Docker container.
2. **Distributed Queue Manager**: Rebuilt the `CallQueueManager` using Redis Sorted Sets (`zadd`) to guarantee FIFO ordering within priority bands. Wait times and queue positions are now shared across all horizontal nodes.
3. **Pub/Sub Synchronization**: Real-time slot availability is broadcast via Redis Pub/Sub (`voxera:slot_available`), triggering all scale-out instances simultaneously.
4. **Distributed Circuit Breaker**: Supabase database failures are written to Redis asynchronously and broadcasted via Pub/Sub, updating the local fast-cache of all instances immediately.

**Final Outcome:**
VOXERA is now capable of horizontal scaling. Critical telephony queues and state management are centralized in Redis, solving all single-node limitations.

### 2026-07-10 — Advanced Voice Intelligence & Telephony Experience (Issue #14)

**Features Implemented:**
1. **Acoustic Feature Extraction**: New pure-JS DSP module (`lib/audio/acoustic.ts`) that extracts RMS energy, zero-crossing rate, pitch (autocorrelation), speaking rate, and pause patterns from raw 8kHz PCM audio — zero external dependencies.
2. **Energy-Based Barge-In**: Upgraded `TelephonyStreamHandler` to compute RMS energy on incoming audio. TTS playback only stops when caller audio exceeds the configurable energy threshold (`CONFIG.telephony.bargeInEnergyThreshold`), eliminating false barge-ins from background noise.
3. **Acoustic Emotion Analysis**: New `detectAudioEmotion()` in `lib/emotion/audio-emotion.ts` maps physical acoustic features to EmotionSignal (pitch→arousal, energy→intensity, rate→valence). Replaces the previous null-returning stub.
4. **Text+Audio Emotion Fusion**: The existing `fuseEmotion()` now receives real audio emotion signals, enabling confidence-weighted VAD fusion between text and acoustic channels.
5. **Real CAI Metrics**: The orchestrator passes actual pitch variation, speaking rate, barge-in count, and pause duration to `calculateCAI()` instead of heuristic placeholders.
6. **Prompt Injection Guardrail**: New `guardInput()` in `lib/agent/input-guard.ts` runs before the LLM. Detects 12+ jailbreak/injection pattern families (role assumption, prompt extraction, delimiter injection, DAN mode, etc.) with weighted scoring and natural voice deflections.

**Files Created:**
- `lib/audio/acoustic.ts` — PCM acoustic feature extraction
- `lib/emotion/audio-emotion.ts` — Acoustic-to-emotion mapper
- `lib/agent/input-guard.ts` — Pre-LLM prompt injection guardrail
- `__tests__/e2e/voice-intelligence.test.ts` — 31 integration tests

**Files Modified:**
- `lib/telephony/stream-handler.ts` — Energy barge-in, PCM accumulation, interruption tracking
- `lib/agent/orchestrator.ts` — Input guard, acoustic emotion, real CAI metrics
- `lib/emotion/detect.ts` — Removed audio emotion stub
- `lib/types.ts` — Added AcousticFeatures interface
- `lib/config.ts` — Energy thresholds
- `lib/logging/session-logger.ts` — New event types (input_guard, acoustic)

**Validation Performed:**
- `npx vitest run` → **184 tests passed, 0 failures** across 16 test files
- `npm run lint` → **0 errors, 0 warnings**
- `npm run build` → **Build succeeded** (TypeScript type checking passed, all pages generated)

### 2026-07-12 — Sprint 5 (Issue #15: SaaS Commercialization)
**Objective**: Transform VOXERA from a single-tenant demo into a production-ready SaaS platform with self-service onboarding, subscription billing, and tenant management.

**Changes Implemented**:
1. **Stripe Billing Integration**: 
   - Created Stripe SDK wrapper (`lib/billing/stripe.ts`) defining Starter, Growth, and Enterprise tiers.
   - Built checkout API route and webhook handler for `checkout.session.completed`, `customer.subscription.updated`, and `deleted` events.
   - Designed a new `subscriptions` table (Migration v10) with RLS for multi-tenant isolation.
2. **Onboarding Wizard Upgrade**: 
   - Added Step 3: Choose Plan to `app/onboarding/planner.tsx`.
   - Updated `lib/db/onboarding.ts` to properly save business hours and AI settings (`language`, `tone`, `greeting`) into `business_settings`.
   - Automatically redirect tenants to Stripe Checkout if they choose a paid tier.
3. **Admin Tenant Dashboard**: 
   - Built a Super-Admin panel (`/admin/tenants`) summarizing tenant creation, subscription status, call volume, and knowledge document metrics.

**Files Created**:
- `lib/billing/stripe.ts` — Stripe tier logic and limits
- `app/api/billing/checkout/route.ts` — Stripe Checkout endpoint
- `app/api/billing/webhook/route.ts` — Stripe webhook handler
- `app/admin/tenants/page.tsx` — Admin tenant management dashboard
- `__tests__/e2e/saas-commercialization.test.ts` — Integration tests for Stripe & billing
- `sql/migration_v10.sql` — Subscriptions schema and RLS

**Files Modified**:
- `lib/db/onboarding.ts` — Added logic to save AI settings and operating hours
- `app/onboarding/planner.tsx` — Added pricing UI and redirection logic
- `app/admin/layout.tsx` — Added Tenants link to the sidebar
- `VOXERA_ROADMAP.md` — Updated Phase III completion status

**Validation Performed**:
- `npx vitest run` → **188 tests passed, 0 failures** across 17 test files
- `npm run lint` → **0 errors, 0 warnings**
- `npm run build` → **Build succeeded**

### 2026-07-13 — Sprint 6 (Issue #23: Emotion Detection Bug & UI Warning)
**Objective**: Fix the colloquial negative emotion classification bug and the `[object Object]` rendering display warning.

**Changes Implemented**:
1. **Lexicon Colloquial Contractions**:
   - Redefined the regex for sadness to `feel(?:ing?|s|in'?)? low` to capture `"feelin low"` and other forms.
   - Updated all occurrences of `ing` words in the lexicon (such as `working`, `breaking`, `falling`) to match their contracted versions (e.g., `workin`, `breakin`, `fallin`).
   - Converted all regex capture groups to non-capturing groups `(?:...)` and added the global `/g` flag. This correctly fixes the bug where `matches.length` was biased by the number of capturing groups in the pattern rather than the true match count.
   - Boosted the `distress` lexicon weight for `"breaking down"` from `0.8` to `0.9` to properly override `sadness` tie-breakers.
2. **Confidence Category Rendering Fix**:
   - Updated the `TurnTrace` TypeScript interface to support `confidenceCategory` as an object.
   - Fixed `app/_components/VoiceAgent.tsx` which was coercing the object to a string resulting in `[object Object]`. It now securely extracts the `.level` property.

**Validation Performed**:
- `npx vitest run` → **194 tests passed, 0 failures** across 18 test files (including new detection suite)
- `npm run build` → **Build succeeded**

### 2026-08-12 — Real-Time WebSocket Conversation Mode + Dark-Mode CSS Fix

**Objective**: Replace the demo's manual Record/Stop turn-taking with a genuinely continuous,
low-latency voice conversation ("Live Call" mode), tighten LLM responses so replies don't feel
laggy, and fix a reported dark-mode visibility bug on `/demo`.

**Changes Implemented**:
1. **`server.ts` wired to the full turn pipeline** (previously only echoed transcripts back,
   `// TODO (Phase 2)`): on each Deepgram `is_final` transcript, calls `handleTurn()`
   (`lib/agent/orchestrator.ts` — the same orchestrator used by telephony calls), sends the
   reply text + emotion trace back over the WebSocket immediately, then synthesizes an MP3 reply
   via `synthesize()` (`lib/deepgram/tts.ts`) and streams it back as a base64 `reply_audio`
   message. One session per WebSocket connection (`browser-<nanoid>`), matching the pattern
   already used by `TelephonyStreamHandler` (`lib/telephony/stream-handler.ts`) for real calls.
2. **New `app/_components/RealtimeVoiceCall.tsx`** ("Live Call" mode in the `/demo` switcher):
   continuous browser mic capture via Web Audio API (`AudioContext` + `ScriptProcessorNode`),
   downsampled to 16kHz mono PCM and streamed as raw binary frames directly over the WebSocket
   to `ws://localhost:3001` (or `NEXT_PUBLIC_REALTIME_WS_URL` if set) — no chunk-and-POST
   round-trips, no manual Record button. Renders live interim transcript, a running chat-style
   transcript of both sides, the detected emotion for the latest turn, and auto-plays the
   assistant's reply audio the moment it arrives. Reuses the `getMicSupport`/`describeMicError`
   helpers from `micUtils.ts` for consistent permission-error handling. Added as a 4th tab in
   `DemoModeSwitcher.tsx` alongside Text / Acoustic / Phone Call.
3. **Shorter, snappier LLM replies**: `CONFIG.llm.maxOutputTokens` reduced from `400` to `160`,
   and the voice-style system instruction in `lib/agent/context.ts` tightened to "1-2 short
   sentences (under ~30 words)... no preamble" — both apply globally (telephony calls and the
   new Live Call mode benefit equally), since a real phone conversation shouldn't wait on
   paragraph-length completions.
4. **Dark-mode CSS visibility fix**: added `color-scheme: light` to `:root` in `app/globals.css`.
   The site has no dark stylesheet — without this declaration, browsers on a dark-mode OS render
   native UA chrome (notably default text/background colors on unstyled sub-parts of form
   controls) using dark-mode defaults, which can collide with the site's explicit light
   backgrounds and make text unreadable. Forcing `color-scheme: light` makes every native control
   render light regardless of OS preference. Verified by emulating a dark OS color scheme in the
   browser tool and confirming `/demo` still renders fully legible and light-themed.

**Operational note — two processes required for Live Call mode**: `server.ts` (the WebSocket
STT/LLM/TTS server, port 3001) is a **separate Node process** from the Next.js dev server (port
3000). Both must be running locally for the "Live Call" tab to work:

```bash
npm run dev      # terminal 1 — Next.js app (port 3000)
npm run server    # terminal 2 — realtime WS server (port 3001)
```

If `npm run server` isn't running, the Live Call tab shows a friendly inline error naming the
command to run, rather than failing silently. Text, Acoustic, and Phone Call modes are unaffected
and don't require the second process.

**Validation Performed**:
- `npx tsc --noEmit` → clean
- `npm run lint` → **0 errors, 0 warnings**
- `npx vitest run` → **251 tests passed** across 27 test files
- `npm run build` → **Build succeeded**
- Manual browser pass: all four `/demo` tabs render correctly (including under emulated
  dark-OS color scheme); Live Call mode mounts cleanly with no console errors. The live mic
  streaming loop and WS-driven turn loop require a real microphone and a running `server.ts`
  process, both outside this sandbox — left for the user to verify end-to-end.

### 2026-08-12 — Live Test Drawer (Vapi-style widget) + full console theme unification

**Objective**: Implement `docs/LIVE_TEST_DRAWER_PLAN.md` — a site-wide, right-side drawer for
holding a real voice conversation with the agent with real barge-in and per-turn diagnostics
attached to the transcript — and fix a reported black/white theme mismatch across `/demo`.

**Changes Implemented**:
1. **`server.ts`**: added a per-connection `generation` counter incremented on a client `barge_in`
   message; any reply already in flight when that happens is dropped instead of being spoken over
   the user. Also turned on `diagnostics: true` on the `handleTurn()` call (previously only the
   fused label reached the client, not the HF/Lexicon/Local ONNX/Acoustic breakdown) and now
   accumulates per-turn PCM to run `extractAcousticFeatures()` before each turn, downsampled 16kHz
   → 8kHz so the exact same DSP telephony calls use gets exercised here too.
2. **New `app/_components/useVoiceActivityDetection.ts`**: thin wrapper around
   `@ricky0123/vad-web` (Silero VAD, MIT). Shares the caller's existing `MediaStream`/
   `AudioContext` via option overrides (`getStream`/`audioContext`) instead of opening a second
   independent mic stream.
3. **New `app/_components/TestAgentDrawer.tsx`**: the drawer itself, mounted once in
   `app/layout.tsx` so its floating "Talk to the agent" trigger is available on every page. Signature
   element is an orb driven by real Web Audio `AnalyserNode` amplitude in both directions (mic
   input while listening, TTS playback while speaking) — never a decorative loop. VAD's
   `onSpeechStart` while the agent is talking triggers an immediate client-side barge-in (pause
   audio, send `{type:"barge_in"}`) before any server round trip. Each transcript turn carries its
   own attached `EngineDiagnosticPanel` + CAI line rather than a separate dashboard bolted beside
   the chat.
4. **Retired `RealtimeVoiceCall.tsx`**: the `/demo` "Live Call" tab now shows a CTA that opens the
   same drawer via a `window` custom event (`voxera:open-test-drawer`), rather than maintaining a
   second parallel realtime-call implementation.
5. **New dependency**: `@ricky0123/vad-web`. Its model/WASM/worklet assets are self-hosted under
   `public/vad/` (~15MB, see `public/vad/README.md`) — the package resolves asset paths relative
   to the page origin in a bundler context like Next.js, not a CDN, so this isn't optional.
6. **Theme unification** (the reported "color coding, white/black theme, not matching" issue):
   found and fixed several light (`--color-bg-elevated`) panels sitting directly beneath the dark
   `.voxera-console` panels introduced in the previous pass — `VoiceAgent.tsx`'s input bar and
   per-turn history card, `PhoneCallDemo.tsx`'s call-setup card, and `AcousticDemo.tsx`'s manual
   test-case card. All converted to the same dark console tokens so each mode reads as one
   continuous instrument instead of a light card stacked under a dark one.
7. Excluded `public/vad/**` (vendored, not authored) from ESLint via `eslint.config.mjs`.

**Validation Performed**:
- `npx tsc --noEmit` → clean
- `npm run lint` → **0 errors, 0 warnings**
- `npx vitest run` → **257 tests passed** across 27 test files (unchanged by this pass — no new
  server-side logic besides `server.ts`, which isn't unit-testable without a live Deepgram/Twilio
  connection, consistent with the rest of that file's existing testing approach)
- `npm run build` → **Build succeeded**
- Manual browser pass: floating trigger renders and opens the drawer on both the landing page and
  `/demo`; fixed a real z-index bug found during this pass where the landing page's own
  `z-index: 100` header rendered over the drawer's top edge — the drawer/trigger/backdrop are now
  `z-[105]`/`z-[110]`/`z-[100]` respectively. Mic-permission-denied path inside the drawer shows
  the expected friendly error with no console errors. The `/demo` "Live Call" CTA correctly opens
  the same drawer instance via the custom event. Full live mic + VAD + barge-in flow needs a real
  microphone and a running `npm run server` — outside this sandbox, left for the user to verify.

### 2026-08-17 — Conversation Quality Root-Cause Fixes + Real-Agent Testing + Source of Truth Panel

**Objective**: The Live Test Drawer worked end-to-end but the conversation itself sounded like a
support script, not a person — reported directly via screenshots showing "Of course — let me help
you with that right away", identical replies repeated turn after turn, and an escalation offer
("connect you with a senior specialist") leaking on every distress/sadness turn despite prompt-level
rules forbidding it. Root-caused and fixed each one via live curl/browser testing rather than
guessing, and added the ability to test against a real configured agent instead of only the demo
persona.

**Changes Implemented**:
1. **Neutral persona rewrite**: was "Professional, efficient, focused" with example text "Of course —
   let me help you with that right away", which the model reproduced near-verbatim on every plain
   greeting. Rewritten warm/conversational; `formatPersonaBlock()` now explicitly tells the model its
   example is a tone reference, never to be copied.
2. **Lexicon false positive**: `"help me"` was grouped into the same distress-severity regex as
   `desperate|emergency|urgent|scared|afraid`, so routine requests ("can you help me book an
   appointment?") were misclassified as maximum-severity distress. Removed.
3. **No negation handling at all**: `"I'm not feeling good"` matched the bare `good` keyword and
   scored as pure JOY. `detectTextEmotionLexicon()` (`lib/emotion/detect.ts`) now scans for a negation
   cue in the ~20 characters before a match and flips positive labels to their negative counterpart
   (or drops negated negative matches, e.g. "not angry", rather than guessing a replacement).
4. **Small-talk misclassification**: a bare `"How are you?"` was being classified as CONFUSION,
   force-gluing "Does that make sense?" onto an unrelated reply via the confusion persona's rules.
   Added a small-talk guard in `detectTextEmotion()` that forces neutral for whole-utterance greetings
   when the lexicon found no real keyword hit (genuine distress phrased as a question is untouched),
   and softened the confusion persona's rule to only fire after an actual multi-step explanation.
5. **The actual root cause of the escalation-jargon leak**: `guardOutput()` (`lib/agent/guard.ts`)
   runs *after* the LLM and after an earlier `sanitizeReply()` fix, as a separate output-guard layer —
   it unconditionally appended `"Let me connect you with a senior specialist now."` whenever escalation
   was active and the reply didn't match a narrow regex (`connect|transfer|specialist|supervisor|human`),
   which the newly-humanized persona phrasing ("grab someone from the team") never matched. Fixed the
   regex to recognize natural hand-off phrasing and changed the fallback sentence to match.
6. **Escalation offers repeating every turn**: `policyToPrompt()` (`lib/agent/policy.ts`) now takes an
   `alreadyOfferedHandoff` flag, computed in `buildLLMContext()` by scanning STM for prior hand-off
   phrasing, and tells the model not to repeat the offer once it's already been made this session.
7. **Real-agent testing + Source of Truth panel**: new `GET /api/tenants` route and a "Testing: ..."
   selector in `TestAgentDrawer.tsx` (superseded by Agent Builder's `/api/agents` a few hours later,
   see below) — test against a real configured tenant's knowledge base and brand-voice memory instead
   of always the hardcoded demo agent. New collapsible "Source of Truth" panel showing the actual
   POLICY directives applied and MEMORY written/retrieved for the latest turn.
8. Fixed a real UI bug: `EngineDiagnosticPanel`'s 4-column grid used a viewport-width breakpoint
   (`md:grid-cols-4`), not a container-width one, forcing 4 columns into the drawer's ~360px analytics
   column and overlapping card content. Added a `compact` prop.

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (269 → 281 passing across these commits),
  `npm run build` — all clean at each step
- Live-verified via repeated curl against `/api/turn` with a fixed `sessionId`, re-running the exact
  scenario from the reported screenshots after each fix — confirmed "senior specialist" fully gone
  (including under the offline-fallback path, which shares the same `guardOutput()`/persona/policy
  code), "How are you?" now gets a natural reply instead of a confusion-persona non-sequitur, and
  negated positive text no longer misreads as joy

### 2026-08-17 — Unified Dark Theme for `/demo` + Full-Page Blur Behind the Drawer

**Objective**: The Live Test Drawer used a dark instrument-panel theme while the rest of `/demo`
stayed in the app's default light theme, so opening the drawer felt like two different products
stitched together.

**Changes Implemented**:
- Since every component under `/demo` already reads color through semantic `--color-*` tokens
  rather than hardcoded palette classes, added one scoping class (`.voxera-demo-dark` in
  `app/globals.css`) on the page's root `<main>` that redefines those tokens to the existing console
  values — re-theming Text/Live Call/Acoustic/Phone Call and every panel beneath them with no
  per-component edits.
- Fixed two knock-on light-theme leaks this surfaced: `<html>`/`<body>` had a hardcoded light
  background that flashed on overscroll since neither sits inside the `.voxera-demo-dark` scope on
  `<main>` — fixed via a `:has()` selector scoped to pages containing that class.
- Widened the drawer's backdrop (`TestAgentDrawer.tsx`) from a 1px mobile-only dimmer to a full
  12px blur + 40% scrim across all breakpoints, so opening the drawer visibly blurs the page behind
  it instead of just sliding a panel over untouched content.

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (281 passing), `npm run build` — all clean
- Live-verified in-browser: all four `/demo` modes render dark consistently; drawer's blur backdrop
  confirmed via computed `backdrop-filter: blur(12px)`

### 2026-08-17 — Six Judge-Facing Demo Features

**Objective**: Make `/demo` more convincing to evaluate — expose the concurrent multi-engine
architecture's disagreement (not just its winner), let a judge scrub back through past turns instead
of only ever seeing the latest, show real retrieved memory content instead of bare counts, wire real
per-stage latency into the previously-decorative pipeline visual, add one-click scripted scenarios,
and roll per-turn data into a session scorecard.

**Changes Implemented**:
1. **Data plumbing**: `TurnTrace` (`lib/agent/orchestrator.ts`) now carries real per-stage timings
   (`emotionMs`/`retrievalMs`/`llmMs` measured in the orchestrator, `sttMs`/`ttsMs` measured in
   `server.ts`) and actual retrieved memory snippets (id/summary/topic/emotion/importance), not just
   IDs and counts.
2. **Engine disagreement callout**: `EngineDiagnosticPanel` (`EngineDashboard.tsx`) shows whether
   HF/Lexicon/Local ONNX actually agreed on a turn's emotion, and why fusion picked what it picked
   when they didn't.
3. **Scrubbable reasoning trace**: `TestAgentDrawer.tsx`'s transcript turns are individually
   clickable — scrub back to any past assistant turn to inspect its full diagnostics/policy/memory.
   Auto-advances to the newest turn as replies arrive; a "Jump to latest" pill appears when pinned to
   an older one.
4. **Visible memory content**: the Source of Truth panel shows actual retrieved memory text (grouped
   by MTM/LTM-user/client, capped at 3 each) instead of bare counts.
5. **Real pipeline latency**: a new latency bar (Listen/Analyze/Memory/LLM/Voice) renders for the
   selected turn using the Phase 1 measurements, replacing the previously-decorative pipeline tracker.
6. **Stress-test scenarios**: `VoiceAgent.tsx`'s Text mode gets four one-click scripted scenarios
   (angry escalation, genuine distress, happy news, confused/rambling) that auto-play the full turn
   sequence at a readable pace.
7. **Session scorecard**: a live-updating summary (turn count, avg CAI with trend, escalation
   count/peak level, memories written, dominant emotion) rolls up per-turn data already being
   collected into a measurable outcome.

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (281 passing), `npm run build` — all clean;
  WS server (`npm run server`) boots cleanly with the new timing instrumentation
- Live-verified in-browser: ran the "Angry escalation" scenario end-to-end in Text mode — disagreement
  callout correctly showed Lexicon/Local ONNX splitting on frustration vs anger, `repeated_frustration`
  flag fired, tier2 escalation triggered with clean phrasing, CAI and policy traced correctly
  turn-by-turn. Scrubbable trace / memory snippets / latency bar / scorecard are WS-only (Live Call)
  features verified via type-checked data flow and code review, not exercised live (needs a real
  microphone, outside this sandbox).

### 2026-08-17 — Acoustic Sadness Bias + Agent Cutting the Caller Off Mid-Sentence

**Objective**: Two bugs reported from live phone-call testing: the acoustic engine misread
neutral/joyful/grateful speech as sadness most of the time, and the agent started replying before
the caller finished a sentence.

**Changes Implemented**:
1. **Sadness bias**: `inferLabelScored()` (`lib/emotion/audio-emotion.ts`) gave independent,
   unconditional points toward sadness for low energy OR low pitch OR slow rate OR low pitch
   variation OR a falling contour — each alone is also just what calm/neutral speech or warm
   gratitude sounds like (see the gratitude rules a few lines below, and the pre-existing "quiet"
   soft-nudge comment, which already recognized quietness alone shouldn't assert a label — the main
   sadness rules contradicted that same principle). Considered switching to a full acoustic embedding
   model (an external proposal suggested `emotion2vec+` via ONNX) but that's a large, unvalidated
   undertaking for a bug with a much simpler root cause; also confirmed pitch contour alone can't
   discriminate sadness, since ordinary declarative English sentences end on a falling pitch. Fixed by
   requiring energy AND pitch to both be genuinely low together for the primary sadness signal, with
   variation/contour downgraded to smaller supporting nudges that also require low energy.
2. **Cutting the caller off**: `is_final` (which `server.ts`'s `onFinalTranscript` acts on to trigger
   a reply) is governed by Deepgram's `endpointing` parameter, left unset and therefore using
   Deepgram's short default silence gap — any brief pause or breath was enough to finalize the
   utterance early. Set `endpointing: 500` in `lib/deepgram/live.ts` (`utterance_end_ms` was already
   set but is a separate, unused mechanism here).

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (287 passing, 3 new regression tests pinning
  the reported scenario), `npm run build` — all clean
- The acoustic fix is verified via targeted unit tests reproducing the exact reported feature
  combinations (calm/gratitude-toned speech no longer reads as sadness, genuinely low energy+pitch
  audio still does); the `endpointing` change is a single, well-understood parameter and needs a real
  call to confirm 500ms feels right in practice — outside this sandbox

### 2026-08-17 — ZenMux as Primary LLM Provider

**Objective**: Add ZenMux ahead of the existing Groq key-rotation setup as the primary LLM provider,
without touching the Groq fallback logic.

**Changes Implemented**:
- The entire integration is one new entry in `CONFIG.llm.providers` (`lib/config.ts`):
  `{ name: "zenmux", envKey: "ZENMUX_API_KEY", baseURL, model }`, placed first. `generateReply()`
  (`lib/agent/llm.ts`) already iterates providers in array order, builds a fresh `KeyRotator` per
  provider's `envKey`, and falls through to the next provider on any failure — none of that changed,
  so Groq's rotation/backoff/retry behavior is exactly what it was.
- `baseURL`/`model` are env-overridable (`ZENMUX_BASE_URL`/`ZENMUX_MODEL`) since ZenMux's model
  catalog is account-specific. `KeyRotator` is generic over any comma-separated env var, so ZenMux
  gets multi-key rotation, timeouts, and exponential backoff on 429/5xx for free.
- Documented in `.env.example`/`.env.local.example`. No key hardcoded anywhere.

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (292 passing, 5 new tests mocking the `openai`
  SDK), `npm run build` — all clean
- Live-verified end-to-end with a real ZenMux key: confirmed the priority order (`zenmux` tried
  first), automatic fallback to Groq on a real `402` (account balance) error, and a fully successful
  ZenMux completion once pointed at a model the account could actually use — `[LLM] Success via
  provider: zenmux` with a real generated reply routed through the exact same orchestrator pipeline

### 2026-08-17 — Agent Builder

**Objective**: Let a signed-up user create multiple custom voice agents (name, system prompt,
greeting, voice) under their account, storable and pickable for both live testing and outbound
calls — the missing piece for a Vapi-style product experience. Previously `/admin` supported
exactly one agent per account, configured only for voice/greeting/integrations — there was no
stored, editable system prompt at all; the LLM's behavior came entirely from code plus knowledge-
base memory records.

**Changes Implemented**:
1. **Schema**: the `agents` table already existed (migration_v2.sql, `id/tenant_id/name/type/
   status`) but had no field for what an agent actually says. `sql/migration_v11.sql` adds
   `description`, `system_prompt`, `greeting`, `voice_persona`.
2. **`lib/db/agents.ts`**: CRUD + listing helpers, parameterized over a `SupabaseClient` so they
   work with both the cookie-bound, RLS-respecting client (admin routes) and the service-role
   client (orchestrator/`server.ts`, which have no logged-in session to bind to).
3. **Admin CRUD**: `app/api/admin/agents/route.ts` (list/create) and
   `app/api/admin/agents/[id]/route.ts` (get/update/delete), authenticated via the existing
   cookie-session pattern, scoped to the logged-in user's own tenant.
4. **Public listing**: `app/api/agents/route.ts` mirrors `/api/tenants`' graceful-degradation
   shape (empty list, not an error, when Supabase is unreachable) but lists individual agents.
5. **Real prompt injection**: `buildLLMContext()` (`lib/agent/context.ts`) takes an optional
   `customInstructions` param and injects it as its own block, explicit that it adds detail/
   personality on top of the CORE RULES and EMOTIONAL PERSONA and never overrides them (safety/
   escalation behavior stays intact regardless of what an agent's creator writes). `handleTurn()`
   (`lib/agent/orchestrator.ts`) resolves a new optional `agentId` at the top of the turn — before
   anything else keys off `clientId` — via `getAgentWithTenant()`, overriding `clientId` with the
   agent's own tenant (so knowledge/memory scoping follows the agent) and threading its
   `system_prompt` through. Falls back silently to the plain demo agent on any lookup failure.
6. **Admin UI**: new `/admin/agents` page (list + create/edit/delete form, voice picker reusing
   `/admin/settings`'s persona list) and an "Agent Builder" sidebar link in `app/admin/layout.tsx`
   and `components/admin/AdminMobileNav.tsx`. Each saved agent has a "Test this agent" link to
   `/demo?agentId=<id>`.
7. **Test drawer**: `TestAgentDrawer.tsx`'s "Testing: ..." selector now lists real agents from
   `/api/agents` (was tenants from `/api/tenants`, which is left in place, unused by the drawer
   now but still valid) and passes `?agentId=` on the WebSocket URL instead of `?clientId=`;
   reads `?agentId=` from the page URL on mount to support the admin page's deep link, auto-
   opening the drawer with that agent pre-selected.

**Files Created**:
- `sql/migration_v11.sql` — `agents` table: description/system_prompt/greeting/voice_persona
- `lib/db/agents.ts` — CRUD + listing helpers
- `app/api/admin/agents/route.ts`, `app/api/admin/agents/[id]/route.ts` — authenticated CRUD
- `app/api/agents/route.ts` — public listing
- `app/admin/agents/page.tsx` — Agent Builder UI
- `__tests__/agent/context-custom-instructions.test.ts` — prompt-injection regression tests

**Files Modified**:
- `lib/agent/context.ts` — `customInstructions` param + injected prompt block
- `lib/agent/orchestrator.ts` — `agentId` resolution, `agent` field on `TurnTrace`
- `app/api/turn/route.ts` — `agentId` in the request schema
- `server.ts` — parses `?agentId=` from the WS URL, passes it through
- `app/_components/TestAgentDrawer.tsx` — agent selector + deep-link support
- `app/admin/layout.tsx`, `components/admin/AdminMobileNav.tsx` — sidebar nav entry

**Validation Performed**:
- `npx tsc --noEmit` → clean
- `npm run lint` → **0 errors, 0 warnings**
- `npx vitest run` → **284 tests passed** across 31 files
- `npm run build` → **Build succeeded**; `/admin/agents`, `/api/admin/agents`,
  `/api/admin/agents/[id]`, `/api/agents` all present in the route manifest
- Live-verified: `/api/agents` returns `{agents: []}` gracefully with Supabase unreachable (this
  sandbox's actual state); `/admin/agents` correctly redirects an unauthenticated request to
  `/login`; `/api/turn` with a bogus `agentId` falls back cleanly to the demo agent rather than
  erroring; the `/demo` drawer's selector renders "Demo agent (no custom agents found...)"
  correctly in-browser. The full authenticated create → test → call loop needs a real Supabase
  connection and login session — outside this sandbox, left for the user to verify after applying
  `sql/migration_v11.sql`.


### 2026-08-17 — Onboarding Redesign: Simple, Vapi-Style Agent Creator

**Objective**: The onboarding wizard (industry dropdown, workflow dropdown, operating hours,
escalation-string field, subscription plan picker) never actually fed the real agent architecture —
it wrote to a separate `business_settings` row and inserted a legacy `agents` row using columns that
don't exist on that table (`opening_time`/`closing_time`), so it was already partially broken.
Replaced it with a simple 4-step flow that creates a real Agent Builder agent: describe your
business, write or AI-generate the prompt, optionally attach files for RAG, review and create.

**Changes Implemented**:
1. **Basics → Prompt → Knowledge → Review**, `app/onboarding/planner.tsx` rewritten from scratch.
   Basics is business name + agent name (optional) + a free-text description — the only required
   input.
2. **AI prompt generation**: new `POST /api/onboarding/generate-prompt` calls the existing
   `generateReply()` (same ZenMux → Groq → OpenAI fallback pipeline, not a duplicate LLM path) with a
   prompt-writing system instruction and the user's description, explicitly told not to invent facts
   beyond what was described. `generateReply()` gained two optional, backward-compatible params —
   `maxOutputTokens` and `useTools` — since the default 160-token cap and forced tool-calling are
   tuned for live voice turns, not one-off prompt drafting; every existing caller is unaffected.
3. **Knowledge**: optional drag-and-drop file upload straight into the existing
   `POST /api/knowledge/upload` (unchanged) — ingests into the account's shared `LTM_client`
   knowledge base, which every agent under that account already draws on via `buildLLMContext()`'s
   CLIENT block, so this needed zero new ingestion code.
4. **Create**: `POST /api/onboarding` rewritten to just ensure a tenant row exists (same upsert
   logic as before, extracted into `lib/db/onboarding.ts`'s `createFirstAgent()`) and create one
   agent under it via the existing `createAgent()` helper (`lib/db/agents.ts`). No more
   `business_settings` write, no more broken `agents`-table insert.
5. Success page (`app/onboarding/success/page.tsx`) now deep-links to `/demo?agentId=<id>`
   (`TestAgentDrawer` already reads this from the Agent Builder work) so a brand-new agent can be
   talked to immediately, plus a link to Agent Builder to keep refining it.

**Deliberately dropped**: industry/workflow taxonomy, the AI-recommendation side panel, operating
hours, and the Stripe plan-picker step — none of it fed the actual agent, and simplicity was the
explicit ask. Billing can be wired up separately if wanted.

**Files Created**:
- `app/api/onboarding/generate-prompt/route.ts` — AI prompt drafting
- `__tests__/db/onboarding.test.ts` — `createFirstAgent()` tenant reuse/creation/failure paths

**Files Modified**:
- `lib/db/onboarding.ts` — rewritten: `createFirstAgent()` replaces `processOnboarding()`
- `app/api/onboarding/route.ts` — simplified schema and handler
- `app/onboarding/planner.tsx`, `app/onboarding/page.tsx`, `app/onboarding/success/page.tsx`
- `lib/agent/llm.ts` — `maxOutputTokens`/`useTools` optional params on `generateReply()`

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (296 passing, 4 new unit tests),
  `npm run build` — all clean
- Live-verified: both new API routes correctly reject unauthenticated requests
  (`401`/"Unauthorized"); `/onboarding` correctly redirects to `/login` when signed out (pre-existing
  middleware, unaffected by this change). Could not visually exercise the wizard itself or a real
  create-agent submission — this sandbox has no reachable Supabase connection to log in, same
  limitation as the Agent Builder work.

### 2026-08-17 — Session Not Surviving to a New Tab (Middleware Coverage Gap)

**Objective**: Reported live: log in, open a new tab to the same site (same browser, same URL), get
bounced back to `/login` even though nothing logged the user out.

**Root Cause**: `middleware.ts`'s matcher only ran on `/admin/:path*` and `/onboarding/:path*`.
Supabase's session-refresh call (`getUser()` — not `getSession()`, which deliberately makes a round
trip and transparently renews an expired access token via the refresh-token cookie) only happened
inside that same middleware. The access token was never refreshed while browsing any other page
(`/`, `/demo`, `/login`, `/signup`), so it could silently expire, and by the time a protected page was
opened in a new tab there was nothing valid left to authenticate with.

**Changes Implemented**:
- `updateSession()` (`lib/db/middleware.ts`) now always calls `getUser()` to refresh the session
  cookie, but only redirects to `/login` when the request path actually falls under `/admin` or
  `/onboarding` — separating "keep the session alive" from "require login for this route."
- `middleware.ts`'s matcher widened to run on nearly every page route, excluding `/api` (an extra
  Supabase Auth round trip on every voice-turn API call would add real latency to a live phone
  conversation) and static assets.

**Files Modified**: `lib/db/middleware.ts`, `middleware.ts`

**Files Created**: `__tests__/db/middleware.test.ts` — 8 tests covering protected-route redirects,
public-route pass-through, prefix-matching precision (`/adminish` isn't treated as protected), and
that `getUser()` still runs (refreshing the session) on public routes.

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (304 passing), `npm run build` — all clean
- Live-verified: `/`, `/demo`, `/login` return 200; `/admin`, `/onboarding` still 307-redirect to
  `/login`; `/api/agents` still returns 200 untouched by the auth check; a live `/api/turn` call
  confirmed no added latency on the API path. Could not reproduce the original bug live end-to-end
  (log in, wait for expiry, open new tab) — no reachable Supabase connection in this sandbox to
  actually authenticate.

### 2026-08-17 — PDF Upload 500 Error + Consolidated, Idempotent SQL Migration

**Objective**: Two errors reported live from the onboarding wizard's Knowledge step: uploading a PDF
returned a 500, and creating the agent failed with `Could not find the table 'public.tenants' in the
schema cache`. After the tenants fix, PDF upload was still failing, revealing a second, unrelated gap.

**Changes Implemented**:
1. **PDF upload 500 (real code bug)**: `pdf-parse` is pinned to `^2.4.5`, which completely rewrote the
   package's API — v1 exported a callable function (`pdfParse(buffer)`), which
   `lib/knowledge/ingest.ts`'s `extractPdfText()` was still calling. v2 has no default export at all;
   it's a `PDFParse` class (`new PDFParse({ data }).getText()`). Calling the module namespace as a
   function threw a generic "is not a function" on every PDF upload. Rewrote `extractPdfText()` to
   the v2 class API with `parser.destroy()` cleanup. Verified with a real generated PDF via a
   standalone script — extracts text correctly now.
2. **Clearer error for missing schema**: `createFirstAgent()` (`lib/db/onboarding.ts`) now recognizes
   PostgREST's `PGRST205` error code (table not found) and appends a concrete hint instead of
   surfacing a bare passthrough error.
3. **`sql/migration_consolidated.sql`** — one idempotent file merging `migration.sql` through
   `migration_v11.sql`, requested directly after the user hit missing-table errors from having only
   partially applied the 11 separate files (`tenants` migrated but not `knowledge_documents`, a
   completely different file). Every `CREATE TABLE` uses `IF NOT EXISTS`; every incrementally-added
   column uses `ALTER TABLE ADD COLUMN IF NOT EXISTS`; every `CREATE POLICY` is preceded by
   `DROP POLICY IF EXISTS` (Postgres has no `CREATE POLICY IF NOT EXISTS`). Deliberately drops the
   original `migration.sql`'s `DROP TABLE IF EXISTS public.memories CASCADE` — destructive and wrong
   for a script meant to be safely re-run against a database that may already hold real data; creates
   `IF NOT EXISTS` instead. Fixed `migration_v10.sql`'s `subscriptions` table, which had no
   `IF NOT EXISTS` guard in the original. Tables ordered by FK dependency; ends with a sanity-check
   query listing which of the 11 expected tables exist.
4. **Follow-up fix**: running the consolidated file hit a real Postgres error —
   `cannot change return type of existing function` on `match_memories`, because Postgres derives a
   function's row type from its `RETURNS TABLE` columns (treated as OUT parameters) and refuses to
   change that shape via `CREATE OR REPLACE`. `migration_v9.sql` grew those columns
   (`importance_score`/`retrieval_count`/`last_retrieved_at`), so it collided with any pre-v9 version
   already applied. Added `DROP FUNCTION IF EXISTS match_memories(vector, double precision, integer,
   text, text, text)` immediately before the `CREATE OR REPLACE`, exactly matching Postgres's own
   error hint.

**Files Created**: `sql/migration_consolidated.sql`

**Files Modified**: `lib/knowledge/ingest.ts`, `lib/db/onboarding.ts`, `__tests__/db/onboarding.test.ts`

**Validation Performed**:
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (305 passing), `npm run build` — all clean
- PDF fix live-verified with a real generated PDF through the actual `pdf-parse` v2 API
- `sql/migration_consolidated.sql` verified with `pglast` (a real libpg_query-based PostgreSQL
  parser — the same parser Postgres itself uses): all 80 statements parse as valid syntax. Could not
  execute it against a real database from this sandbox — the user ran it live, hit the
  `match_memories` return-type error, which was then fixed and the file re-verified; full successful
  execution end-to-end still needs final confirmation from the user's own environment.
