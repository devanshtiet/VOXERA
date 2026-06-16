-- Phase 2 Onboarding & Blueprint Additions

-- 1. tenants
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    timezone TEXT,
    plan TEXT DEFAULT 'trial',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can manage their own row" ON public.tenants
    FOR ALL USING (auth.uid() = auth_user_id);

-- 2. business_settings
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    greeting TEXT,
    voice_persona TEXT,
    escalation_policy TEXT,
    call_goal TEXT,
    workflow_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can manage their own settings" ON public.business_settings
    FOR ALL USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()
        )
    );

-- 3. agents
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    active_version_id UUID, -- self-referencing to versions (nullable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can manage their own agents" ON public.agents
    FOR ALL USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()
        )
    );
