# Testing the Phone Call Demo locally

The `/demo` page's **Phone Call** mode places a real outbound Twilio call and streams the
live transcript + emotion analysis back over SSE. To exercise this locally you need a
public URL Twilio can reach — `next dev` on `localhost` isn't reachable from Twilio's
servers, so this mode needs a tunnel (ngrok) during development. This is **local-dev-only**
tooling — production deployments should use their real public domain instead of ngrok.

## 1. Required environment variables

Copy `.env.local.example` to `.env.local` and fill in (see that file for the full list):

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — from the [Twilio console](https://console.twilio.com).
- `DEEPGRAM_API_KEY` — for STT/TTS during the call.
- `GROQ_API_KEY` — for the LLM reply.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — `call_logs` rows are written here.
- `NEXT_PUBLIC_BASE_URL` — **this is the ngrok URL**, set in step 3 below.

## 2. Start ngrok

```bash
ngrok http 3000
```

Copy the `https://<subdomain>.ngrok-free.app` URL it prints.

## 3. Point the app at the tunnel

Set in `.env.local`:

```
NEXT_PUBLIC_BASE_URL=https://<subdomain>.ngrok-free.app
```

Restart `npm run dev` after changing this — Next.js only reads `.env.local` on startup.

`app/api/telephony/outbound/route.ts` and `app/api/telephony/incoming/route.ts` both build
their Twilio webhook/TwiML URLs from `NEXT_PUBLIC_BASE_URL`, so this one variable is what
makes both outbound calls and inbound webhooks reachable.

## 4. Configure the Twilio phone number's webhook

In the [Twilio console](https://console.twilio.com) → Phone Numbers → your number → Voice
Configuration:

- **A call comes in** → Webhook → `https://<subdomain>.ngrok-free.app/api/telephony/incoming`
  (HTTP POST). This is required for *inbound* calls; outbound calls initiated from the demo
  set this webhook automatically per-call, but configuring it here too doesn't hurt.

## 5. Test it

1. `npm run dev` (with the env vars above set).
2. In a separate terminal, `ngrok http 3000`.
3. Open `https://<subdomain>.ngrok-free.app/demo` (use the ngrok URL, not localhost — Twilio
   needs to reach your machine).
4. Switch to **Phone Call** mode, enter your own number, click **Call Me**.
5. Answer the call and speak — the transcript and live emotion metrics should appear on the
   page within a couple seconds of each turn.

## Notes

- The outbound-call endpoint (`/api/telephony/outbound`) is public and unauthenticated (by
  design, so anonymous `/demo` visitors can use it) but is **rate-limited to 1 call per 10
  minutes per IP** (`lib/telephony/rate-limit.ts`) to prevent it being used to trigger
  unlimited real, cost-incurring calls.
- The live view does **not** show the per-engine (HuggingFace / Lexicon / Local ONNX)
  breakdown that the Text Demo shows — that's a deliberate choice, not a bug. Enabling full
  diagnostics on every phone call would add a real HuggingFace API call and local ONNX
  inference to every production call's latency and cost, not just demo ones. Phone calls
  show the same final emotion/VAD/CAI score the agent actually reasons from.
- ngrok's free tier URL changes every time you restart it — update `NEXT_PUBLIC_BASE_URL`
  (and restart `npm run dev`) each time, or use a paid ngrok static domain.
