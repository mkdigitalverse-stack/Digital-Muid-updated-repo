-- ==============================================================================
-- DIGITAL MUID — FOUNDATIONAL BASELINE TABLES MIGRATION
-- Migration: 20260824000000_create_foundational_baseline_tables.sql
-- ==============================================================================
-- STATUS: PROPOSED & APPROVED BASELINE MIGRATION
-- PURPOSE: Provisions missing foundational baseline tables (public.crm_leads and 
--          public.availability_rules) prior to migration replay and hardening preflights.
-- ==============================================================================

-- --------------------------------------------------------------------------------
-- 1. CRM LEADS TABLE
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'Website',
  interest TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Converted', 'Lost')),
  amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON public.crm_leads (email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads (status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads (created_at DESC);

-- Backward-compatibility view for services referencing public.leads
CREATE OR REPLACE VIEW public.leads AS SELECT * FROM public.crm_leads;

-- --------------------------------------------------------------------------------
-- 2. AVAILABILITY RULES TABLE
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id TEXT PRIMARY KEY DEFAULT 'primary_availability_rules',
  working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time VARCHAR(5) NOT NULL DEFAULT '11:00',
  end_time VARCHAR(5) NOT NULL DEFAULT '20:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  break_periods JSONB NOT NULL DEFAULT '[{"start":"14:00","end":"15:00","name":"Strategic Break"}]'::jsonb,
  blocked_dates TEXT[] NOT NULL DEFAULT '{}',
  blocked_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_notice_hours INTEGER NOT NULL DEFAULT 4,
  max_advance_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.availability_rules (id)
VALUES ('primary_availability_rules')
ON CONFLICT (id) DO NOTHING;
