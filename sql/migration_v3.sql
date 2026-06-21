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
