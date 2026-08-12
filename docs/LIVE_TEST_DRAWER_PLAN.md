# VOXERA — Live Test Drawer (Vapi-style realtime testing widget)

Status: **implemented** (2026-08-12). See `app/_components/TestAgentDrawer.tsx`,
`app/_components/useVoiceActivityDetection.ts`, and the `server.ts` diagnostics/barge-in changes.
All three assumptions in §6 were confirmed and built as stated: site-wide trigger, full
replacement of the old Live Call tab, and self-hosted VAD assets — the last one turned out to be
mandatory rather than a preference, since `@ricky0123/vad-web` resolves its asset path relative to
the page origin in a bundler context like Next.js, not a CDN by default. See `public/vad/README`
(inline comment in the hook) for the exact file set (~15MB: ONNX model + WASM runtime + worklet).

## 1. What we're building

A right-side slide-out drawer, opened from a floating trigger, that lets anyone hold a real
spoken conversation with the VOXERA agent and watch the emotion engine reason about it live —
one continuous session, no manual record button, full diagnostics per turn. Reference point:
Vapi's live-call testing widget, but built around VOXERA's actual differentiator (the multi-engine
emotion pipeline), not a generic chat bubble list.

This supersedes the current "Live Call" tab in `/demo` (`app/_components/RealtimeVoiceCall.tsx`),
which proved the WebSocket STT→LLM→TTS loop works but has three real gaps this plan closes:

1. **No barge-in.** The agent's reply audio plays to completion even if the user starts talking —
   real conversations don't work that way.
2. **No visible diagnostics.** `server.ts` calls `handleTurn()` without `diagnostics: true`, so the
   per-engine (HF / Lexicon / Local ONNX / Acoustic) breakdown that the Text mode already shows
   never reaches the realtime path.
3. **Naive turn-taking.** Silence detection is entirely server-side (Deepgram's `utterance_end_ms`).
   There's no client-side voice activity signal, so the UI can't react instantly when the user
   starts speaking — it waits for a round trip.

## 2. Design brief

**Subject**: an engineer or founder verifying, live, that VOXERA can hold a real spoken
conversation and read emotion correctly — a proof instrument, not a marketing chat widget.

**Signature element — the orb.** A circular waveform ring at the top of the drawer, driven by
real audio amplitude in both directions (not a decorative animation):
- Idle: slow ambient breathing (matches the existing `.voxera-waveform.is-idle` cadence).
- User speaking: ring reacts to live mic input amplitude via a Web Audio `AnalyserNode` on the
  mic stream.
- Agent speaking: ring shifts hue toward cyan and reacts to the `<audio>` element's own amplitude
  via a second `AnalyserNode` on the playback element.

Everything else in the drawer stays disciplined — the orb is the one bold moment.

**Layout — annotated transcript, not dashboard-beside-chat.** A generic support-widget layout
(bubble list + rail of stat cards beside it) treats the analytics as decoration. Instead:
- A **pinned header** (does not scroll): the orb, call controls (Start/End), and a slim **session
  strip** — the running emotion timeline + CAI trend for the whole call, always visible.
- A **scrolling feed** below it where each turn is a transcript bubble with its own live emotion
  readout attached directly underneath — mini engine chips (HF/Lexicon/ONNX/Acoustic), VAD
  triplet, intensity — so the diagnostics are pinned to the exact utterance that produced them.

**No text input.** This widget is voice-only by design — its only job is proving the agent can
hold a spoken, emotionally-aware conversation. A text box would dilute that statement.

**Visual language**: reuse the dark "signal console" system already built for `/demo`
(`.voxera-console`, `.voxera-console-label`, `.voxera-waveform`, `--console-*` tokens in
`app/globals.css`) — same near-black panel, violet/cyan accents, JetBrains Mono for every
technical readout. No new palette, no new typeface — this drawer is a mode of the same
instrument, not a different product.

## 3. Turn-taking & VAD

**Library**: [`@ricky0123/vad-web`](https://www.npmjs.com/package/@ricky0123/vad-web) — runs
Silero VAD via ONNX Runtime Web, client-side, MIT licensed. `MicVAD.new({ onSpeechStart,
onSpeechEnd })` gives a real speech-start/speech-end signal instead of a naive amplitude
threshold.

**What it's for here — barge-in, not transcription.** Deepgram's server-side `utterance_end_ms`
(already configured in `lib/deepgram/live.ts`) stays authoritative for *when a transcript is
final* — don't replace that. The client VAD's job is purely to make the UI and audio playback
react **instantly** the moment the user starts talking, before any server round trip:

1. `onSpeechStart` fires while agent audio is playing → treat as **barge-in**:
   - Immediately pause/mute the `<audio>` element client-side (zero latency, no server round trip).
   - Send `{ type: "barge_in" }` over the WebSocket.
   - Flip the orb to "listening" state immediately.
2. Server (`server.ts`) tracks a per-connection `generation` counter, incremented on `barge_in`.
   Any in-flight `synthesize()` call whose reply was generated for a stale generation is dropped
   when it resolves (checked before sending `reply_audio`) — prevents a late TTS response from a
   pre-barge-in turn playing over the user.
3. `onSpeechStart` while agent is *not* speaking is just a UI signal (orb reacts) — no protocol
   message needed, Deepgram's own interim transcripts already drive the visible transcript.

**Asset hosting**: `@ricky0123/vad-web` needs its ONNX model, WASM runtime, and an AudioWorklet
script available at runtime. Self-host them under `public/vad/` (copied from the package via its
`copy-assets` support) rather than pointing `baseAssetPath` at a CDN — keeps the widget working
offline/on restricted networks and avoids a third-party runtime dependency for a core feature.

## 4. Backend changes (`server.ts`)

All additive — `lib/agent/orchestrator.ts` and `lib/deepgram/*` are untouched.

1. **Full diagnostics per turn**: pass `diagnostics: true` into the existing `handleTurn()` call
   (mirrors `app/api/turn/route.ts`'s `diagnostics` flag) so `output.trace` carries the full
   `DiagnosticEmotionResult` (HF/Lexicon/ONNX/Acoustic + fusion reasoning), not just the fused
   label.
2. **Acoustic features per turn**: accumulate raw PCM chunks between `transcript_final` events
   (same pattern as `TelephonyStreamHandler.turnAudioChunks` in
   `lib/telephony/stream-handler.ts`) and run `extractAcousticFeatures()` on the accumulated
   buffer before calling `handleTurn()`, passing it in as `acousticFeatures` — this is what makes
   the Acoustic engine card populate during a live call, exactly as it does in Text mode's
   diagnostic panel today.
3. **Generation counter + barge-in**: as described above — increment `generation` on `barge_in`,
   stamp every `handleTurn`/`synthesize` call with the generation it started on, drop stale
   `reply_audio` sends.
4. **New WS message**: `{ type: "diagnostics", turnId, diagnostics, acousticFeatures }` sent
   alongside the existing `reply_text` message so the client can attach it to the right transcript
   bubble.

No changes to `handleTurn()`'s signature or `orchestrator.ts` — `diagnostics` and
`acousticFeatures` are both already-supported input fields.

## 5. Frontend changes

**New**: `app/_components/TestAgentDrawer.tsx` — the drawer itself. Internally reuses:
- `EngineDashboard.tsx`'s `EngineCard`/`EngineDiagnosticPanel` building blocks (already
  console-styled) for the per-turn mini engine chips.
- `EmotionTimeline` for the pinned session strip.
- The mic-capture + WebSocket plumbing already proven in `RealtimeVoiceCall.tsx` (16kHz downsample,
  binary WS frames) — this logic moves into the drawer rather than staying duplicated.

**New**: `app/_components/useVoiceActivityDetection.ts` — thin hook wrapping `@ricky0123/vad-web`'s
`MicVAD`, exposing `{ start, stop, isSpeaking }` and taking `onSpeechStart`/`onSpeechEnd`
callbacks. Isolated so it can be unit-tested independently of the drawer's audio-graph code.

**New**: floating trigger button, mounted once in `app/layout.tsx` so it's available site-wide
(landing page, `/demo`, admin) — a fixed bottom-right pill using the same `.voxera-waveform` mini
icon, opens the drawer as a fixed-position right-anchored panel (full width on mobile, ~440px on
desktop) with a backdrop.

**Retire**: `RealtimeVoiceCall.tsx` and the `/demo` "Live Call" tab are replaced by a call-to-action
that opens the same drawer — keeps one implementation instead of two parallel realtime-call UIs.
Text / Acoustic / Phone Call tabs in `DemoModeSwitcher.tsx` are unaffected.

## 6. Assumptions made in this plan (flag if wrong before building)

- Drawer trigger is **site-wide** (landing page included), not scoped to `/demo` only — matches
  "like Vapi," whose widget is embeddable anywhere.
- `RealtimeVoiceCall.tsx` / the Live Call tab is **replaced**, not kept alongside the new drawer.
- VAD model assets are **self-hosted** in `public/vad/`, not loaded from a CDN at runtime.

## 7. Build sequence

Each phase independently testable/verifiable before moving to the next.

1. **Backend**: diagnostics + acoustic accumulation + generation/barge-in protocol in `server.ts`.
   Verify with a scripted WS client sending synthetic PCM — confirm `diagnostics` and
   `reply_audio` messages, confirm a `barge_in` message drops a stale in-flight reply.
2. **Drawer shell**: `TestAgentDrawer.tsx` UI only — orb (idle animation), pinned header, empty
   scrolling feed, open/close from the floating trigger. No audio wiring yet; verify visually.
3. **Voice pipeline**: move the mic-capture/WS logic from `RealtimeVoiceCall.tsx` into the drawer;
   wire the orb to real input amplitude (`AnalyserNode`) and real playback amplitude on the
   `<audio>` element.
4. **VAD + barge-in**: `useVoiceActivityDetection.ts`, wire `onSpeechStart` during agent playback
   to pause audio + send `barge_in`; confirm interruption feels instant.
5. **Diagnostics wiring**: attach incoming `diagnostics` messages to the matching transcript
   bubble; wire the pinned session strip to the running `EmotionTimeline`.
6. **Cutover**: mount the floating trigger in `app/layout.tsx`; replace the Live Call tab's content
   with a "Talk to the agent" CTA that opens the drawer; delete `RealtimeVoiceCall.tsx` once the
   drawer covers everything it did.
7. **Verification**: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (new tests for the
   generation/barge-in logic and the VAD hook), `npm run build`, manual browser pass (drawer
   open/close, visual states — full mic+VAD flow needs a real microphone, same sandbox limitation
   as the existing Live Call/Acoustic modes). Update `VOXERA_IMPLEMENTATION.md` with a changelog
   entry and note the `@ricky0123/vad-web` dependency + `public/vad/` asset hosting in setup docs.

## 8. New dependency

- `@ricky0123/vad-web` (MIT) — Silero VAD via ONNX Runtime Web. No other new runtime
  dependencies; everything else reuses existing infrastructure (`handleTurn`, `synthesize`,
  `extractAcousticFeatures`, `DeepgramLiveWrapper`).
