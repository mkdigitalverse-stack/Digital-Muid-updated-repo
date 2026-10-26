-- ==============================================================================
-- DIGITAL MUID — TRANSACTIONAL EMAIL LOGS & DEDUPLICATION LEDGER
-- Migration: 20261025000001_create_email_logs_table.sql
-- ==============================================================================

-- 1. Create public.email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT,
  order_id TEXT,
  recipient_email TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'course_access' | 'consultation_confirmation' | 'resource_delivery'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast deduplication lookup & reporting
CREATE INDEX IF NOT EXISTS idx_email_logs_payment_id ON public.email_logs (payment_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON public.email_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs (created_at DESC);

-- Unique index to prevent duplicate emails for same payment and template type
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_logs_payment_template 
  ON public.email_logs (payment_id, template_type) 
  WHERE payment_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Administrators have read access to inspect email logs in dashboard
DROP POLICY IF EXISTS "Admin View Email Logs" ON public.email_logs;
CREATE POLICY "Admin View Email Logs"
  ON public.email_logs FOR SELECT
  USING (public.is_admin());

-- Administrators have full management access
DROP POLICY IF EXISTS "Admin All Email Logs" ON public.email_logs;
CREATE POLICY "Admin All Email Logs"
  ON public.email_logs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
