-- ==============================================================================
-- Migration: 20260919000002_create_certificates_table.sql
-- Description: Creates the public.certificates table for official course completion
-- certificates with unique numbers, verification hashes, and public verification RLS.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  recipient_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_hash TEXT NOT NULL UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_course_certificate UNIQUE (user_id, course_id)
);

-- Comments
COMMENT ON TABLE public.certificates IS 'Stores official course completion certificates earned by students.';
COMMENT ON COLUMN public.certificates.user_id IS 'The authenticated student who earned the certificate.';
COMMENT ON COLUMN public.certificates.course_id IS 'The completed course.';
COMMENT ON COLUMN public.certificates.certificate_number IS 'Human-readable unique certificate identifier (e.g., DM-2026-XXXXX).';
COMMENT ON COLUMN public.certificates.verification_hash IS 'Cryptographic/random alphanumeric hash used for public certificate verification.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course ON public.certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_hash ON public.certificates(verification_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_issued ON public.certificates(issued_at DESC);

-- Enable Row Level Security
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies
-- ------------------------------------------------------------------------------

-- 1. SELECT: Public can read certificates for credential verification.
-- Certificates are public credentials meant to be verifiable by employers, LinkedIn, etc.
DROP POLICY IF EXISTS "certificates_public_select_policy" ON public.certificates;
CREATE POLICY "certificates_public_select_policy"
  ON public.certificates
  FOR SELECT
  USING (true);

-- 2. INSERT: Students can insert their own certificate, or admins can grant.
DROP POLICY IF EXISTS "certificates_insert_policy" ON public.certificates;
CREATE POLICY "certificates_insert_policy"
  ON public.certificates
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- 3. UPDATE: Only administrators can update certificate details.
DROP POLICY IF EXISTS "certificates_update_policy" ON public.certificates;
CREATE POLICY "certificates_update_policy"
  ON public.certificates
  FOR UPDATE
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 4. DELETE: Only administrators can revoke/delete certificates.
DROP POLICY IF EXISTS "certificates_delete_policy" ON public.certificates;
CREATE POLICY "certificates_delete_policy"
  ON public.certificates
  FOR DELETE
  USING ((SELECT public.is_admin()));
