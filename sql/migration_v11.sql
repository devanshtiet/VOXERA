-- Migration v11: Agent Builder
--
-- The `agents` table (from migration_v2.sql) had no field for what an agent
-- actually says — only bookkeeping (name/type/status). This adds the
-- editable fields the Agent Builder UI needs: a custom system prompt
-- injected into the LLM pipeline alongside the core rules and emotional
-- persona, a greeting, a default voice, and a short description shown in
-- list/selector UI. A tenant can now own multiple agents, each with its own
-- prompt, and pick which one to test or place a call with — see
-- lib/agent/context.ts's customInstructions param and lib/db/agents.ts.

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS system_prompt TEXT;

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS greeting TEXT;

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS voice_persona TEXT DEFAULT 'female-friendly';
