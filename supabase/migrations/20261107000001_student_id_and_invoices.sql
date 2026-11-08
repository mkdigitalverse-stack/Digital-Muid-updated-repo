-- ==============================================================================
-- DIGITALMUID UNIFIED STUDENT BILLING & GST TAX INVOICE SYSTEM MIGRATION (PHASE 2)
-- Safe, Idempotent, Production-Ready Migration
-- Compliance:
-- 1. GST Rule 46(b) Consecutive Invoice Numbering (<= 16 characters, unique per FY)
-- 2. Section 34 CGST Act, 2017 Credit Notes for Refunds / Ledger Reversals
-- 3. Collision-resistant, database sequence-backed Student ID & Enrolment ID
-- 4. Payment Security: Invoices strictly issued ONLY for captured/paid transactions
-- 5. Place of Supply: Customer billing state and address support
-- 6. Zero Downtime: Pre-checks for duplicates prior to unique index application
-- ==============================================================================

-- 1. Profiles Table: Add permanent Student ID, State, and Billing Address
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- 2. Course Enrollments Table: Add permanent Enrolment ID
ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_id TEXT;

-- 3. Payments Table: Add persistent Invoice Number
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 4. Invoice Series Tracking Table (Atomic per Financial Year)
CREATE TABLE IF NOT EXISTS public.invoice_series (
  financial_year TEXT PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Credit Note Series Tracking Table (Section 34 CGST Act)
CREATE TABLE IF NOT EXISTS public.credit_note_series (
  financial_year TEXT PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Credit Notes Table (Section 34 CGST Act records)
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL,
  original_invoice_number TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_id TEXT,
  reason TEXT NOT NULL DEFAULT 'Course enrollment cancellation & refund',
  amount NUMERIC(10, 2) NOT NULL,
  tax_amount NUMERIC(10, 2) NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number 
  ON public.credit_notes (credit_note_number);

-- ==============================================================================
-- COLLISION-RESISTANT SEQUENCES
-- ==============================================================================

CREATE SEQUENCE IF NOT EXISTS public.student_id_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS public.enrollment_id_seq START WITH 10001;

-- Generates collision-resistant Student ID: DM-STU-010001 (13 chars)
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.student_id_seq');
  RETURN 'DM-STU-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

-- Generates collision-resistant Enrolment ID: DM-ENR-010001 (13 chars)
CREATE OR REPLACE FUNCTION public.generate_enrollment_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.enrollment_id_seq');
  RETURN 'DM-ENR-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

-- Generates atomic, consecutive Invoice Number per Indian Financial Year
-- Format: DM/YY-YY/0001 (13 characters - strictly <= 16 chars under GST Rule 46(b))
-- Serialized via PostgreSQL row lock on public.invoice_series
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date TIMESTAMPTZ;
  v_month INTEGER;
  v_year INTEGER;
  v_fy_start INTEGER;
  v_fy_end INTEGER;
  v_fy TEXT;
  v_seq INTEGER;
BEGIN
  v_date := COALESCE(p_date, NOW());
  v_month := EXTRACT(MONTH FROM v_date)::INTEGER;
  v_year := EXTRACT(YEAR FROM v_date)::INTEGER;

  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_fy := LPAD(v_fy_start::TEXT, 2, '0') || '-' || LPAD(v_fy_end::TEXT, 2, '0');

  -- Atomic row lock / upsert prevents concurrency race conditions
  INSERT INTO public.invoice_series (financial_year, last_sequence, updated_at)
  VALUES (v_fy, 1, NOW())
  ON CONFLICT (financial_year)
  DO UPDATE SET last_sequence = public.invoice_series.last_sequence + 1, updated_at = NOW()
  RETURNING last_sequence INTO v_seq;

  RETURN 'DM/' || v_fy || '/' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- Generates atomic, consecutive Credit Note Number per Indian Financial Year (Sec 34 CGST Act)
-- Format: CN/YY-YY/0001 (13 characters - strictly <= 16 chars)
CREATE OR REPLACE FUNCTION public.get_next_credit_note_number(p_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date TIMESTAMPTZ;
  v_month INTEGER;
  v_year INTEGER;
  v_fy_start INTEGER;
  v_fy_end INTEGER;
  v_fy TEXT;
  v_seq INTEGER;
BEGIN
  v_date := COALESCE(p_date, NOW());
  v_month := EXTRACT(MONTH FROM v_date)::INTEGER;
  v_year := EXTRACT(YEAR FROM v_date)::INTEGER;

  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_fy := LPAD(v_fy_start::TEXT, 2, '0') || '-' || LPAD(v_fy_end::TEXT, 2, '0');

  INSERT INTO public.credit_note_series (financial_year, last_sequence, updated_at)
  VALUES (v_fy, 1, NOW())
  ON CONFLICT (financial_year)
  DO UPDATE SET last_sequence = public.credit_note_series.last_sequence + 1, updated_at = NOW()
  RETURNING last_sequence INTO v_seq;

  RETURN 'CN/' || v_fy || '/' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- ==============================================================================
-- AUTOMATIC DATABASE TRIGGERS
-- ==============================================================================

-- Trigger: Ensure profiles receive a permanent Student ID (preserving existing)
CREATE OR REPLACE FUNCTION public.trigger_set_student_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS NULL OR TRIM(NEW.student_id) = '' THEN
    NEW.student_id := public.generate_student_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_student_id ON public.profiles;
CREATE TRIGGER set_profile_student_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_student_id();

-- Trigger: Ensure enrollments receive a permanent Enrolment ID
CREATE OR REPLACE FUNCTION public.trigger_set_enrollment_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.enrollment_id IS NULL OR TRIM(NEW.enrollment_id) = '' THEN
    NEW.enrollment_id := public.generate_enrollment_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_enrollment_id ON public.course_enrollments;
CREATE TRIGGER set_enrollment_id
  BEFORE INSERT ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_enrollment_id();

-- Trigger: Payment security enforcement
-- ONLY assign invoice number when payment status is 'captured' or 'paid'
CREATE OR REPLACE FUNCTION public.trigger_set_payment_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Strict verification: Reject assigning invoice number to pending, failed, or cancelled payments
  IF (NEW.status = 'captured' OR NEW.status = 'paid') AND (NEW.invoice_number IS NULL OR TRIM(NEW.invoice_number) = '') THEN
    NEW.invoice_number := public.get_next_invoice_number(COALESCE(NEW.created_at, NOW()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_payment_invoice_number ON public.payments;
CREATE TRIGGER set_payment_invoice_number
  BEFORE INSERT OR UPDATE OF status, invoice_number ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_payment_invoice();

-- ==============================================================================
-- IDEMPOTENT, SAFE BACKFILL & CONFLICT DEDUPLICATION
-- ==============================================================================

-- 1. Profiles backfill (only rows missing student_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE student_id IS NULL OR TRIM(student_id) = '' ORDER BY created_at ASC LOOP
    UPDATE public.profiles SET student_id = public.generate_student_id() WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Deduplicate profiles student_id if any conflict existed historically
DO $$
DECLARE
  dup RECORD;
  dup_row RECORD;
BEGIN
  FOR dup IN 
    SELECT student_id, COUNT(*) as cnt 
    FROM public.profiles 
    WHERE student_id IS NOT NULL AND TRIM(student_id) != '' 
    GROUP BY student_id HAVING COUNT(*) > 1
  LOOP
    FOR dup_row IN 
      SELECT id FROM public.profiles WHERE student_id = dup.student_id ORDER BY created_at ASC OFFSET 1 
    LOOP
      UPDATE public.profiles SET student_id = public.generate_student_id() WHERE id = dup_row.id;
    END LOOP;
  END LOOP;
END $$;

-- Safe unique index for profiles (applies only after deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id 
  ON public.profiles (student_id) 
  WHERE student_id IS NOT NULL AND TRIM(student_id) != '';

-- 3. Enrollments backfill (only rows missing enrollment_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.course_enrollments WHERE enrollment_id IS NULL OR TRIM(enrollment_id) = '' ORDER BY created_at ASC LOOP
    UPDATE public.course_enrollments SET enrollment_id = public.generate_enrollment_id() WHERE id = r.id;
  END LOOP;
END $$;

-- Deduplicate enrollments enrollment_id if any conflict existed historically
DO $$
DECLARE
  dup RECORD;
  dup_row RECORD;
BEGIN
  FOR dup IN 
    SELECT enrollment_id, COUNT(*) as cnt 
    FROM public.course_enrollments 
    WHERE enrollment_id IS NOT NULL AND TRIM(enrollment_id) != '' 
    GROUP BY enrollment_id HAVING COUNT(*) > 1
  LOOP
    FOR dup_row IN 
      SELECT id FROM public.course_enrollments WHERE enrollment_id = dup.enrollment_id ORDER BY created_at ASC OFFSET 1 
    LOOP
      UPDATE public.course_enrollments SET enrollment_id = public.generate_enrollment_id() WHERE id = dup_row.id;
    END LOOP;
  END LOOP;
END $$;

-- Safe unique index for course_enrollments
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enrollments_enrollment_id 
  ON public.course_enrollments (enrollment_id) 
  WHERE enrollment_id IS NOT NULL AND TRIM(enrollment_id) != '';

-- 4. Payments backfill (ONLY captured or paid records, strictly preserving existing numbers)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, created_at FROM public.payments WHERE (status = 'captured' OR status = 'paid') AND (invoice_number IS NULL OR TRIM(invoice_number) = '') ORDER BY created_at ASC LOOP
    UPDATE public.payments SET invoice_number = public.get_next_invoice_number(r.created_at) WHERE id = r.id;
  END LOOP;
END $$;

-- Safe unique index for payments invoice_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_invoice_number 
  ON public.payments (invoice_number) 
  WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != '';

-- Reconciliation Documentation:
-- Pre-existing historical invoice numbers (if any) are strictly preserved to maintain accounting continuity.
-- Any future audit reconciliation can cross-reference payments.id, razorpay_payment_id, and invoice_number.
