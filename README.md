# emotion-engine

Real-time voice agent that routes **Deepgram STT + TTS** through a **hierarchical, emotion-conditioned memory system** (STM / MTM / LTM) and an emotion-aware retrieval + policy layer.

## Pipeline

```
mic → /api/stt (Deepgram nova-2) → text + stt_confidence
    → /api/turn (orchestrator):
         text emotion (lexicon+VAD) → fused emotion
         → stm.push → buildEmotionContext → importance score I
         → writeMemory (STM|MTM + promote→LTM on recurrence)
         → retrieve (semantic + EmoMatch + recency·τI + importance − staleness − redundancy)
         → decidePolicy (acknowledge, pace, escalate, no-upsell, safety)
         → LLM (Anthropic) with grounded evidence + policy + STM
         → guardOutput (citation fence, STT/retrieval gates, policy injection)
    → /api/tts (Deepgram Aura) → audio/mpeg → <audio>
```

## Scoring (see [lib/emotion/importance.ts](lib/emotion/importance.ts), [lib/memory/retrieval.ts](lib/memory/retrieval.ts))

- **Importance**: `I = α·intensity + β·ΔVAD_user + γ·novelty + δ·recurrence + ε·taskCriticality + ζ·policyFlag`
- **Retrieval**: `score = w1·cos(q,m) + w2·EmoMatch + w3·exp(−Δt/τ_I) + w4·I(m) − w5·stale − w6·redund` with `τ_I = τ₀(1 + λ·I)`.

## Run

```bash
cp .env.example .env.local   # add DEEPGRAM_API_KEY and optionally ANTHROPIC_API_KEY
npm install
npm run dev
```

Open `http://localhost:3000`. Without `ANTHROPIC_API_KEY` the LLM falls back to a deterministic canned reply (policy rules still apply) so you can exercise the memory + emotion + policy path offline. Without `DEEPGRAM_API_KEY` the STT/TTS routes return 501 and you can still type into the textbox.

Offline smoke test (no keys needed):

```bash
npx tsx scripts/smoke.ts
```

## Directory layout

- [lib/types.ts](lib/types.ts) — core types (`Utterance`, `MemoryRecord`, `PolicyDirectives`, `VAD`…).
- [lib/emotion/](lib/emotion/) — text lexicon → VAD, fusion, context builder (trajectory, z-score, flags), importance engine.
- [lib/memory/](lib/memory/) — STM ring buffer, in-memory vector store, writer (routing, merge, promotion), retrieval (formula R + MMR).
- [lib/agent/](lib/agent/) — policy rules, LLM context assembler, anti-hallucination guard, orchestrator.
- [lib/deepgram/](lib/deepgram/) — Deepgram SDK v5 wrappers for STT (`listen.v1.media.transcribeFile`) and TTS (`speak.v1.audio.generate`).
- [app/api/](app/api/) — Next.js 16 route handlers (`runtime = "nodejs"`, `dynamic = "force-dynamic"`).
- [app/_components/VoiceAgent.tsx](app/_components/VoiceAgent.tsx) — mic → STT → turn → TTS demo UI with per-turn trace.

## Research claims

1. Emotion as a governing signal for *storage* and *retrieval* (not just response style).
2. Temporal emotion timeline with per-user VAD baseline + escalation detection.
3. Emotion-adaptive decay `τ_I = τ₀(1+λI)` — important affective memories persist longer.
4. Emotion-congruent retrieval via VAD cosine on top of semantic similarity.
5. Dual-scope LTM (user + client) unified in one retrieval pass.
6. Closed-loop memory × policy × anti-hallucination with confidence gates.

## Swap points (for production)

- **STT streaming**: replace `transcribeBuffer` with `client.listen.v1.connect()` WebSocket; feed partials into `handleTurn` on endpointing.
- **TTS streaming**: replace `synthesize` with `client.speak.v1.connect()` WebSocket for first-chunk < 250 ms.
- **Embeddings**: swap [lib/util/embed.ts](lib/util/embed.ts) with a real embedding service; keep the `(text) → number[]` signature.
- **Vector store**: swap [lib/memory/store.ts](lib/memory/store.ts) with pgvector/Qdrant; retain `put/search/byTier`.
- **Audio emotion**: implement `detectAudioEmotionStub` against a Wav2Vec2 head; fusion in [lib/emotion/detect.ts](lib/emotion/detect.ts) is modality-agnostic.
