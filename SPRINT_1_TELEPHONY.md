# Sprint 1 — Telephony Integration
**Date:** June 21, 2026  
**Branch:** `vikas/addition_of_feature`  
**Status:** ✅ Complete

---

## Overview

This sprint adds real phone call support to VOXERA. Before this sprint, VOXERA only worked via the browser microphone. After this sprint, a real Twilio phone number can receive incoming calls and route them through the full VOXERA AI pipeline — STT → LLM → TTS — entirely over the phone.

**SRD Coverage:** FR-1 (Incoming Call Handling), FR-19 (Call Queue Management)

---

## How It Works

```
Caller dials Twilio phone number
        ↓
Twilio POSTs to /api/telephony/incoming
        ↓
VOXERA responds with TwiML → opens Media Stream WebSocket
        ↓
Twilio streams mulaw audio → /api/telephony/stream (WebSocket)
        ↓
mulaw → PCM → Deepgram STT (live transcript)
        ↓
Transcript → handleTurn() (orchestrator — unchanged)
        ↓
LLM reply → Deepgram TTS → mp3 → mulaw → sent back to Twilio
        ↓
Twilio plays audio to caller
        ↓
Call ends → call_logs updated, queue decremented
```

---

## Files Added

### `lib/telephony/twilio.ts`
Twilio utility functions:
- `getTwilioClient()` — lazy Twilio REST client init
- `validateTwilioSignature()` — HMAC-SHA1 validation to verify Twilio webhooks
- `buildConnectTwiml(wsUrl, callSid)` — generates `<Connect><Stream>` TwiML to open a Media Stream
- `buildWaitTwiml(waitTimeSec)` — plays hold message and redirects back to queue
- `buildRejectTwiml()` — rejects call when hard limit is reached

### `lib/telephony/stream-handler.ts`
Core real-time audio bridge — `TelephonyStreamHandler` class:
- Receives Twilio Media Stream WebSocket messages
- **mulaw → PCM decode** (pure JS, no native deps — `MULAW_DECODE_TABLE`)
- **PCM → mulaw encode** (for TTS audio back to Twilio)
- Feeds PCM to `DeepgramLiveWrapper` for live STT
- On final transcript → calls existing `handleTurn()` orchestrator (zero changes to AI logic)
- TTS reply → converted back to mulaw → sent to Twilio stream
- Manages call lifecycle: `callQueue.markCallStarted()` / `markCallEnded()`
- Updates `call_logs` table on start and end

### `app/api/telephony/incoming/route.ts`
**POST** — Twilio calls this when a phone call arrives:
- Validates Twilio signature (skips in dev if no token set)
- Resolves `clientId` from `phone_numbers` table by called phone number
- Falls back to `DEFAULT_CLIENT_ID` env var for single-tenant / dev
- Queue logic: full → `buildWaitTwiml()`, hard limit → `buildRejectTwiml()`
- Creates row in `call_logs` with `callSid`, `callerNumber`, `startedAt`
- Responds with `buildConnectTwiml()` to open the WebSocket stream

### `app/api/telephony/stream/route.ts`
**GET (WebSocket Upgrade)** — Twilio Media Stream endpoint:
- Upgrades HTTP → WebSocket using `ws` (already a dependency)
- Instantiates `TelephonyStreamHandler` per connection
- In-process `WebSocketServer` singleton (no extra infra needed)

### `app/api/telephony/status/route.ts`
**POST** — Twilio status callback:
- Called by Twilio when a call changes state (completed, failed, busy, no-answer)
- Updates `call_logs`: `status`, `endedAt`, `durationMs`
- Configure as "Status Callback URL" in Twilio console

### `sql/migration_v3.sql`
New database tables:

**`call_logs`** — one row per phone call:
| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | Twilio CallSid |
| `clientId` | text | Which business received the call |
| `callerNumber` | text | Caller's phone number (E.164) |
| `status` | text | `active` \| `completed` \| `failed` |
| `startedAt` | bigint | Unix ms — call start |
| `endedAt` | bigint | Unix ms — call end (null while live) |
| `durationMs` | bigint | Total call duration |
| `sessionId` | text | Links to `session_logs` rows |
| `queueWaitMs` | bigint | How long caller waited in queue |

**`phone_numbers`** — maps Twilio numbers to business tenants:
| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Auto PK |
| `clientId` | text | Business ID (Supabase user ID) |
| `phoneNumber` | text UNIQUE | E.164 format: `+1XXXXXXXXXX` |
| `friendlyName` | text | Human label |
| `active` | boolean | Toggle without deleting |

### `.env.local.example`
Environment variable template with all required Twilio keys:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
NEXT_PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
DEFAULT_CLIENT_ID=your-supabase-user-id
```

---

## Files Modified

### `lib/queue/manager.ts`
Added `getMetrics()` method:
```ts
public getMetrics(): { activeCallCount: number; queueLength: number }
```
Returns live snapshot of active call count and queue depth — used by analytics API.

### `lib/config.ts`
Added `telephony` config section:
```ts
telephony: {
  maxConcurrentCalls: 10,
  sampleRate: 8000,       // Twilio always sends 8kHz mulaw
  encoding: "mulaw",
}
```

### `app/api/analytics/route.ts`
Added telephony metrics to the response:
- `totalPhoneCalls` — count from `call_logs` table
- `activeCalls` — live from `callQueue.getMetrics()`
- `callQueueLength` — live from `callQueue.getMetrics()`
- `avgCallDurationMs` — average of completed calls

### `app/admin/page.tsx`
Added **"Live Telephony"** KPI section to the dashboard with 4 cards:
- **Phone Calls** — total phone calls received
- **Active Calls** — live count with green pulsing dot
- **Queue Length** — live count with green pulsing dot  
- **Avg Duration** — average call length in seconds

---

## Setup Instructions

### 1. Run the SQL migration
In your Supabase SQL Editor, run `sql/migration_v3.sql` (after `migration.sql` and `migration_v2.sql`).

### 2. Create `.env.local`
Copy `.env.local.example` → `.env.local` and fill in:
- Twilio Account SID and Auth Token from [console.twilio.com](https://console.twilio.com)
- Your Twilio phone number
- Your public base URL (ngrok for local dev)

### 3. Expose your local server with ngrok
```bash
ngrok http 3000
# Copy the https URL → set as NEXT_PUBLIC_BASE_URL in .env.local
```

### 4. Configure Twilio
In Twilio console → Phone Numbers → your number:
- **Voice → Webhook:** `https://your-ngrok-url.ngrok-free.app/api/telephony/incoming` (POST)
- **Status Callback URL:** `https://your-ngrok-url.ngrok-free.app/api/telephony/status` (POST)

### 5. Add phone number to DB
In Supabase SQL Editor:
```sql
INSERT INTO public.phone_numbers ("clientId", "phoneNumber", "friendlyName")
VALUES ('your-supabase-user-id', '+1xxxxxxxxxx', 'Main Line');
```

### 6. Call the number
Your AI receptionist will answer. The full session is logged in the admin dashboard.

---

## What Was NOT Changed
- `lib/agent/orchestrator.ts` — zero changes, reused as-is
- `lib/deepgram/live.ts` — zero changes, reused as-is
- `lib/deepgram/tts.ts` — zero changes, reused as-is
- All existing browser voice agent functionality still works

---

## Dependencies Added
| Package | Version | Purpose |
|---------|---------|---------|
| `twilio` | `^6.0.2` | TwiML generation, signature validation |

---

---

## Full SQL Migration (`sql/migration_v3.sql`)

> [!IMPORTANT]
> Run this in your **Supabase SQL Editor** in order:
> 1. `migration.sql` (base schema)
> 2. `migration_v2.sql` (if applicable)
> 3. `migration_v3.sql` **(this file — Sprint 1)**

```sql
-- VOXERA: Sprint 1 - Telephony Migration
-- Run this in your Supabase SQL Editor AFTER migration.sql and migration_v2.sql

-- =============================================================
-- call_logs table — stores metadata for every phone call (FR-1)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.call_logs (
  id text PRIMARY KEY,                  -- Twilio CallSid
  "clientId" text NOT NULL,             -- which business received the call
  "callerNumber" text,                  -- caller's phone number (E.164)
  status text NOT NULL DEFAULT 'active',-- active | completed | failed | queued
  "startedAt" bigint NOT NULL,          -- unix ms
  "endedAt" bigint,                     -- unix ms (null while call is live)
  "durationMs" bigint,                  -- total call duration
  "sessionId" text,                     -- links to session_logs rows
  "queueWaitMs" bigint DEFAULT 0        -- how long caller waited in queue
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_call_logs_client ON public.call_logs ("clientId");
CREATE INDEX IF NOT EXISTS idx_call_logs_started ON public.call_logs ("startedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_session ON public.call_logs ("sessionId");

-- =============================================================
-- phone_numbers table — maps Twilio phone numbers to clientIds
-- =============================================================
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "clientId" text NOT NULL,
  "phoneNumber" text NOT NULL UNIQUE,   -- E.164 format: +1XXXXXXXXXX
  "friendlyName" text,
  active boolean NOT NULL DEFAULT true,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_client ON public.phone_numbers ("clientId");
```

### After running the migration — seed your phone number

Once the tables exist, insert your Twilio number so VOXERA knows which business to route calls to:

```sql
INSERT INTO public.phone_numbers ("clientId", "phoneNumber", "friendlyName")
VALUES (
  'your-supabase-user-id',   -- find this in Supabase Auth → Users
  '+1xxxxxxxxxx',             -- your Twilio phone number in E.164 format
  'Main Reception Line'
);
```

### Verify tables exist

```sql
SELECT * FROM public.call_logs LIMIT 5;
SELECT * FROM public.phone_numbers;
```

---

*Sprint 1 of 5 — Next: Sprint 2 — Emotion-Aware Response Generation*

---

## Test Coverage

All tests live in `__tests__/telephony/` and run with vitest.

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `queue-manager.test.ts` | 11 | Enqueue/dequeue, active call tracking, `getMetrics()`, wait time math |
| `twiml-builders.test.ts` | 15 | `buildConnectTwiml`, `buildWaitTwiml`, `buildRejectTwiml` XML output |
| `audio-codec.test.ts` | 14 | mulaw decode table, `decodeMulaw`, `encodeMulaw`, `pcmToMulaw` |
| `routes.test.ts` | 11 | Request parsing, status mapping, URL construction, clientId resolution |
| **Total** | **51** | **✅ All passing** |

```bash
# Run all tests once
npm run test:run

# Watch mode — re-runs on every file save
npm test
```
