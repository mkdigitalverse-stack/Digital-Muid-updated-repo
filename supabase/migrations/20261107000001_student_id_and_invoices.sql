-- ==============================================================================
-- DIGITALMUID UNIFIED STUDENT BILLING & GST TAX INVOICE SYSTEM MIGRATION (PHASE 2 - AUDIT HARDENED V2)
--
-- Compliance, Concurrency & Security Guarantees:
-- 1. Explicit Timezone: Financial Year projected to 'Asia/Kolkata' (IST UTC+05:30)
-- 2. Partial Refunds & Idempotency: Unique constraint on refund_id prevents duplicate credit notes
-- 3. Historical Reconciliation: Inspects both credit_notes.credit_note_number AND payments.credit_note_number
-- 4. Explicit SQL Privileges: Strict REVOKE from PUBLIC/anon/authenticated; table privileges configured alongside RLS
-- 5. Status Tampering Protection: Revokes UPDATE(status) from clients; trigger blocks unauthorized status elevations
-- 6. Transparent Locking Strategy: Explicit lock documentation and non-blocking production execution guide
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. SCHEMA EXTENSIONS (METADATA-ONLY CATALOG UPDATES)
-- In Postgres 11+, adding nullable columns takes AccessExclusiveLock briefly without table rewrite.
-- ==============================================================================

-- Profiles: Permanent Student ID, State, and Billing Address
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- Course Enrollments: Permanent Enrolment ID
ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_id TEXT;

-- Payments: Persistent Invoice Number, Credit Note Number, Tax Details, and Audit Timestamp
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_number TEXT,
  ADD COLUMN IF NOT EXISTS tax_details JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure payments.user_id allows NULL for guest checkouts (metadata-only)
ALTER TABLE public.payments
  ALTER COLUMN user_id DROP NOT NULL;

-- Fail-closed default: payments inserted without explicit status never default to 'captured'
ALTER TABLE public.payments
  ALTER COLUMN status SET DEFAULT 'pending';

-- Normalize existing payment status values and drop legacy restrictive CHECK constraints
-- (e.g. staging_baseline_review's anonymous status CHECK allowing only captured/refunded/failed)
UPDATE public.payments
SET status = LOWER(BTRIM(status, E' \t\n\r\f\v'))
WHERE status IS NOT NULL
  AND status IS DISTINCT FROM LOWER(BTRIM(status, E' \t\n\r\f\v'));

UPDATE public.payments
SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded');

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'payments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~* '\mstatus\M'
  LOOP
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS %I', v_con.conname);
  END LOOP;

  ALTER TABLE public.payments
    ADD CONSTRAINT chk_payments_status
    CHECK (status IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded'));
END $$;

-- Resource Purchases: Persistent Invoice Number
ALTER TABLE public.resource_purchases
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Bookings (Consultations): Persistent Invoice Number
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- ==============================================================================
-- 2. ATOMIC SERIES & CREDIT NOTE TABLES
-- ==============================================================================

-- Atomic sequence tracking per Indian Financial Year (April 1 to March 31 in Asia/Kolkata)
CREATE TABLE IF NOT EXISTS public.invoice_series (
  financial_year TEXT PRIMARY KEY,
  last_sequence BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic sequence tracking for Credit Notes (Section 34 CGST Act)
CREATE TABLE IF NOT EXISTS public.credit_note_series (
  financial_year TEXT PRIMARY KEY,
  last_sequence BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Section 34 CGST Act Credit Notes Table
-- Supports full refunds and multiple partial refunds with database-enforced idempotency
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL,
  original_invoice_number TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Course enrollment cancellation & refund',
  amount NUMERIC(10, 2) NOT NULL,
  tax_amount NUMERIC(10, 2) NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_partial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Schema compatibility guarantee for pre-existing credit_notes tables
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS credit_note_number TEXT,
  ADD COLUMN IF NOT EXISTS original_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_id TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'Course enrollment cancellation & refund',
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- ZERO-DOWNTIME TWO-PHASE DEPLOYMENT ARCHITECTURE (F-03 Audit Compliance):
-- In Postgres, creating indexes inside a transactional block acquires ShareLock,
-- blocking concurrent writes. To guarantee strict zero-downtime during deployment:
-- 1. Phase A (this file) performs table creation, metadata updates, normalization,
--    RPC functions, and triggers — ZERO index DDL executes in Phase A.
-- 2. Phase B (20261107000002_concurrent_indexes.sql) executes all 8 indexes
--    (including idx_credit_notes_payment_id and idx_credit_notes_user_id) via
--    CREATE [UNIQUE] INDEX CONCURRENTLY outside transaction blocks.
--
-- Target Concurrent Indexes executed in Phase B:
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number ON public.credit_notes (credit_note_number) WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != '';
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_refund_id ON public.credit_notes (refund_id) WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != '';
--   idx_credit_notes_payment_id, idx_credit_notes_user_id, idx_profiles_student_id,
--   idx_course_enrollments_enrollment_id, idx_payments_invoice_number, idx_payments_credit_note_number
-- ==============================================================================

-- ==============================================================================
-- 3. EXPLICIT SQL TABLE PRIVILEGES & ROW LEVEL SECURITY (RLS)
-- Defense-in-depth: SQL privileges are configured explicitly. RLS policies alone are NOT relied upon.
-- ==============================================================================

-- Enable Row Level Security
ALTER TABLE public.invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- 1. Series Tables: Revoke all from PUBLIC, anon, and authenticated
REVOKE ALL ON public.invoice_series FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.credit_note_series FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_series TO service_role, postgres;
GRANT SELECT, INSERT, UPDATE ON public.credit_note_series TO service_role, postgres;

-- 2. Credit Notes: Revoke all from PUBLIC, anon, authenticated
REVOKE ALL ON public.credit_notes FROM PUBLIC, anon, authenticated;
-- Authenticated users can ONLY SELECT (reading own records governed by RLS)
GRANT SELECT ON public.credit_notes TO authenticated;
-- Trusted backend service_role and postgres retain full operational access
GRANT ALL ON public.credit_notes TO service_role, postgres;

-- RLS Policies for credit_notes (owner or verified admin via public.is_admin())
DROP POLICY IF EXISTS "Users can view their own credit notes" ON public.credit_notes;
CREATE POLICY "Users can view their own credit notes"
  ON public.credit_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Service role full access on credit notes" ON public.credit_notes;
CREATE POLICY "Service role full access on credit notes"
  ON public.credit_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Payments Protection: Revoke direct INSERT, UPDATE, DELETE from client roles
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon, PUBLIC;
REVOKE UPDATE (status) ON public.payments FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role, postgres;

-- ==============================================================================
-- 4. SEQUENCES & HISTORICAL RECONCILIATION
-- ==============================================================================

CREATE SEQUENCE IF NOT EXISTS public.student_id_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS public.enrollment_id_seq START WITH 10001;

-- Synchronise student_id_seq above any pre-existing DM-STU-XXXXXX without sequence rewind
DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(student_id FROM '^DM-STU-0*([0-9]+)$')::BIGINT), 10000)
  INTO v_max_id
  FROM public.profiles
  WHERE student_id ~ '^DM-STU-[0-9]+$';

  SELECT last_value INTO v_curr_val FROM public.student_id_seq;

  IF v_max_id > v_curr_val THEN
    PERFORM setval('public.student_id_seq', v_max_id);
  END IF;
END $$;

-- Synchronise enrollment_id_seq above any pre-existing DM-ENR-XXXXXX without sequence rewind
DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(enrollment_id FROM '^DM-ENR-0*([0-9]+)$')::BIGINT), 10000)
  INTO v_max_id
  FROM public.course_enrollments
  WHERE enrollment_id ~ '^DM-ENR-[0-9]+$';

  SELECT last_value INTO v_curr_val FROM public.enrollment_id_seq;

  IF v_max_id > v_curr_val THEN
    PERFORM setval('public.enrollment_id_seq', v_max_id);
  END IF;
END $$;

-- ==============================================================================
-- 5. TIMEZONE-AWARE IDENTIFIER GENERATION FUNCTIONS (Asia/Kolkata)
-- ==============================================================================

-- Generates collision-resistant Student ID: DM-STU-010001 (13 chars) up to DM-STU-1000000+
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.student_id_seq');
  IF v_next < 1000000 THEN
    RETURN 'DM-STU-' || LPAD(v_next::TEXT, 6, '0');
  ELSE
    RETURN 'DM-STU-' || v_next::TEXT;
  END IF;
END;
$$;

-- Generates collision-resistant Enrolment ID: DM-ENR-010001 (13 chars) up to DM-ENR-1000000+
CREATE OR REPLACE FUNCTION public.generate_enrollment_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.enrollment_id_seq');
  IF v_next < 1000000 THEN
    RETURN 'DM-ENR-' || LPAD(v_next::TEXT, 6, '0');
  ELSE
    RETURN 'DM-ENR-' || v_next::TEXT;
  END IF;
END;
$$;

-- Generates atomic, consecutive Invoice Number per Indian Financial Year (GST Rule 46(b))
-- Explicitly uses 'Asia/Kolkata' timezone to eliminate boundary drift between UTC and IST
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date_ist TIMESTAMP;
  v_month INTEGER;
  v_year INTEGER;
  v_fy_start INTEGER;
  v_fy_end INTEGER;
  v_fy TEXT;
  v_seq BIGINT;
  v_seq_str TEXT;
BEGIN
  -- Explicitly project timestamp into Asia/Kolkata timezone (IST - UTC+05:30)
  v_date_ist := (COALESCE(p_date, NOW()) AT TIME ZONE 'Asia/Kolkata');
  v_month := EXTRACT(MONTH FROM v_date_ist)::INTEGER;
  v_year := EXTRACT(YEAR FROM v_date_ist)::INTEGER;

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
  DO UPDATE SET 
    last_sequence = public.invoice_series.last_sequence + 1, 
    updated_at = NOW()
  RETURNING last_sequence INTO v_seq;

  -- Safe sequence exhaustion boundary check within GST Rule 46 16-character limit
  -- Prefix 'DM/' (3) + 'YY-YY' (5) + '/' (1) = 9 chars. Allowance = 16 - 9 = 7 digits (max 9,999,999).
  IF v_seq > 9999999 THEN
    RAISE EXCEPTION 'Invoice sequence overflow for financial year %: maximum 16-character limit reached (limit 9,999,999 under GST Rule 46)', v_fy;
  END IF;

  -- Fix LPAD truncation bug: strings >= 10000 are not truncated by LPAD
  IF v_seq < 10000 THEN
    v_seq_str := LPAD(v_seq::TEXT, 4, '0');
  ELSE
    v_seq_str := v_seq::TEXT;
  END IF;

  RETURN 'DM/' || v_fy || '/' || v_seq_str;
END;
$$;

-- Generates atomic, consecutive Credit Note Number per Indian Financial Year (Section 34 CGST Act)
-- Explicitly uses 'Asia/Kolkata' timezone
CREATE OR REPLACE FUNCTION public.get_next_credit_note_number(p_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date_ist TIMESTAMP;
  v_month INTEGER;
  v_year INTEGER;
  v_fy_start INTEGER;
  v_fy_end INTEGER;
  v_fy TEXT;
  v_seq BIGINT;
  v_seq_str TEXT;
BEGIN
  -- Explicitly project timestamp into Asia/Kolkata timezone (IST - UTC+05:30)
  v_date_ist := (COALESCE(p_date, NOW()) AT TIME ZONE 'Asia/Kolkata');
  v_month := EXTRACT(MONTH FROM v_date_ist)::INTEGER;
  v_year := EXTRACT(YEAR FROM v_date_ist)::INTEGER;

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
  DO UPDATE SET 
    last_sequence = public.credit_note_series.last_sequence + 1, 
    updated_at = NOW()
  RETURNING last_sequence INTO v_seq;

  IF v_seq > 9999999 THEN
    RAISE EXCEPTION 'Credit note sequence overflow for financial year %: maximum 16-character limit reached (limit 9,999,999 under Section 34 CGST Act)', v_fy;
  END IF;

  IF v_seq < 10000 THEN
    v_seq_str := LPAD(v_seq::TEXT, 4, '0');
  ELSE
    v_seq_str := v_seq::TEXT;
  END IF;

  RETURN 'CN/' || v_fy || '/' || v_seq_str;
END;
$$;

-- ==============================================================================
-- 5B. ATOMIC FINANCIAL LIMIT & CREDIT NOTE ISSUANCE FUNCTION (F-01 P0 Audit Fix + V4.3 Hardened)
-- Concurrency, Ownership & Accounting Guarantees:
-- 1. Unambiguous payment resolution + row-level locking (FOR UPDATE) BEFORE idempotency checks.
-- 2. Normalizes identifiers cleanly; uses one canonical payment identifier (razorpay_payment_id
--    or id::TEXT fallback) while aggregating cumulative refunds across both legacy representations.
-- 3. Rejects cross-payment refund_id reuse rather than returning another payment's credit note.
-- 4. Enforces authoritative v_payment.user_id ownership (never lets caller p_user_id hijack owner).
-- 5. Never silently clamps; raises detailed exception with reconciliation figures.
-- 6. Subtransaction-protected INSERT with unique_violation recovery rolls back aborted sequence
--    allocations and returns the committed idempotent record for the same payment.
-- 7. Updates payments.status = 'refunded' and payments.updated_at = NOW() upon full exhaustion.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_credit_note_with_limit(
  p_payment_id TEXT,
  p_refund_id TEXT,
  p_refund_amount NUMERIC,
  p_reason TEXT DEFAULT 'Educational course fee refund',
  p_user_id UUID DEFAULT NULL,
  p_currency TEXT DEFAULT 'INR',
  p_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  credit_note_number TEXT,
  original_invoice_number TEXT,
  payment_id TEXT,
  refund_id TEXT,
  amount NUMERIC,
  base_amount NUMERIC,
  tax_amount NUMERIC,
  is_partial BOOLEAN,
  remaining_balance NUMERIC,
  is_idempotent_duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate RECORD;
  v_payment RECORD;
  v_match_count INTEGER := 0;
  v_existing_cn RECORD;
  v_prior_refund_total NUMERIC(10, 2) := 0.00;
  v_remaining NUMERIC(10, 2);
  v_new_cn_num TEXT;
  v_base_amount NUMERIC(10, 2);
  v_tax_amount NUMERIC(10, 2);
  v_is_partial BOOLEAN;
  v_clean_pay_id TEXT := NULLIF(BTRIM(p_payment_id, E' \t\n\r\f\v'), '');
  v_clean_rfnd_id TEXT := NULLIF(BTRIM(p_refund_id, E' \t\n\r\f\v'), '');
  v_pay_uuid UUID := NULL;
  v_canonical_pay_id TEXT;
  v_payment_uuid_text TEXT;
  v_owner_user_id UUID;
  v_new_id UUID;
  v_orig_inv_num TEXT;
  v_effective_currency TEXT;
BEGIN
  -- 1. Validate input parameters
  IF p_refund_amount IS NULL OR p_refund_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid refund amount %: Amount must be a positive, non-zero number.', p_refund_amount;
  END IF;

  IF v_clean_pay_id IS NULL THEN
    RAISE EXCEPTION 'Missing payment_id: Credit note issuance requires a non-empty payment_id.';
  END IF;

  IF v_clean_rfnd_id IS NULL THEN
    RAISE EXCEPTION 'Missing refund_id: Database idempotency requires a non-empty refund_id.';
  END IF;

  -- Parse UUID safely only when input is syntactically a UUID
  IF v_clean_pay_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pay_uuid := v_clean_pay_id::UUID;
  END IF;

  -- 2. Resolve unambiguously and acquire row-level FOR UPDATE lock BEFORE idempotency checks
  FOR v_candidate IN
    SELECT p.id, p.razorpay_payment_id, p.amount, p.status, p.invoice_number, p.user_id, p.credit_note_number
    FROM public.payments p
    WHERE BTRIM(COALESCE(p.razorpay_payment_id, ''), E' \t\n\r\f\v') = v_clean_pay_id
       OR (v_pay_uuid IS NOT NULL AND p.id = v_pay_uuid)
    ORDER BY p.id ASC
    FOR UPDATE
  LOOP
    v_match_count := v_match_count + 1;
    IF v_match_count = 1 THEN
      v_payment := v_candidate;
    ELSE
      RAISE EXCEPTION 'Ambiguous payment identifier % matched multiple payment records.', v_clean_pay_id;
    END IF;
  END LOOP;

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'Payment record % not found in ledger.', v_clean_pay_id;
  END IF;

  -- Canonical payment identifier (prefer gateway razorpay_payment_id; retain UUID string for legacy sum matching)
  v_canonical_pay_id := COALESCE(
    NULLIF(BTRIM(v_payment.razorpay_payment_id, E' \t\n\r\f\v'), ''),
    v_payment.id::TEXT
  );
  v_payment_uuid_text := v_payment.id::TEXT;

  -- Enforce authoritative payment ownership: caller p_user_id may never override v_payment.user_id
  IF p_user_id IS NOT NULL AND v_payment.user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_payment.user_id THEN
    RAISE EXCEPTION 'Ownership mismatch: caller user_id % does not match authoritative payment owner % for payment %.',
      p_user_id, v_payment.user_id, v_canonical_pay_id;
  END IF;
  v_owner_user_id := COALESCE(v_payment.user_id, p_user_id);

  -- 3. Post-lock idempotency check (same payment required; reject cross-payment refund_id reuse)
  SELECT cn.id, cn.credit_note_number, cn.original_invoice_number, cn.payment_id,
         cn.refund_id, cn.amount, cn.base_amount, cn.tax_amount, cn.is_partial
  INTO v_existing_cn
  FROM public.credit_notes cn
  WHERE BTRIM(cn.refund_id, E' \t\n\r\f\v') = v_clean_rfnd_id
  LIMIT 1;

  IF FOUND THEN
    IF BTRIM(COALESCE(v_existing_cn.payment_id, ''), E' \t\n\r\f\v') NOT IN (v_canonical_pay_id, v_payment_uuid_text) THEN
      RAISE EXCEPTION 'Refund ID % is already associated with another payment (%) and cannot be reused for payment %.',
        v_clean_rfnd_id, v_existing_cn.payment_id, v_canonical_pay_id;
    END IF;

    SELECT COALESCE(SUM(c.amount), 0.00)
    INTO v_prior_refund_total
    FROM public.credit_notes c
    WHERE BTRIM(COALESCE(c.payment_id, ''), E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text);

    v_remaining := GREATEST(0.00, COALESCE(v_payment.amount, 0.00) - v_prior_refund_total);

    RETURN QUERY SELECT
      v_existing_cn.id,
      v_existing_cn.credit_note_number,
      v_existing_cn.original_invoice_number,
      v_existing_cn.payment_id,
      v_existing_cn.refund_id,
      v_existing_cn.amount,
      v_existing_cn.base_amount,
      v_existing_cn.tax_amount,
      v_existing_cn.is_partial,
      v_remaining,
      TRUE;
    RETURN;
  END IF;

  -- Verify payment status is eligible for refund
  IF LOWER(COALESCE(v_payment.status, '')) NOT IN ('captured', 'paid', 'completed', 'refunded') THEN
    RAISE EXCEPTION 'Payment % is in status %, which is not eligible for refund or credit note issuance.', v_canonical_pay_id, v_payment.status;
  END IF;

  -- 4. Calculate cumulative prior refunds across canonical & legacy UUID keys
  SELECT COALESCE(SUM(cn.amount), 0.00)
  INTO v_prior_refund_total
  FROM public.credit_notes cn
  WHERE BTRIM(COALESCE(cn.payment_id, ''), E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text);

  v_remaining := v_payment.amount - v_prior_refund_total;

  -- 5. Strict financial limit enforcement: Reject excessive refunds (NO silent clamping)
  IF p_refund_amount > v_remaining THEN
    RAISE EXCEPTION 'Refund amount % exceeds remaining eligible refundable balance of % (Original Payment: %, Cumulative Prior Refunds: %). Credit note rejected.',
      p_refund_amount, v_remaining, v_payment.amount, v_prior_refund_total;
  END IF;

  -- 6. Calculate GST tax breakdown (18% inclusive)
  v_base_amount := ROUND((p_refund_amount / 1.18), 2);
  v_tax_amount := p_refund_amount - v_base_amount;
  v_is_partial := (v_prior_refund_total + p_refund_amount) < v_payment.amount;
  v_orig_inv_num := COALESCE(
    NULLIF(BTRIM(v_payment.invoice_number, E' \t\n\r\f\v'), ''),
    'DM-INV-' || SUBSTRING(v_canonical_pay_id FROM 5)
  );
  v_effective_currency := COALESCE(NULLIF(BTRIM(p_currency, E' \t\n\r\f\v'), ''), 'INR');

  -- 7-8. Allocate consecutive credit note number and insert inside subtransaction savepoint.
  -- If unique_violation occurs on refund_id, Postgres rolls back the sequence update too,
  -- preventing burned credit note numbers and safely returning the matching idempotent row.
  BEGIN
    v_new_cn_num := public.get_next_credit_note_number(COALESCE(p_date, NOW()));

    INSERT INTO public.credit_notes (
      credit_note_number,
      original_invoice_number,
      payment_id,
      user_id,
      refund_id,
      reason,
      amount,
      base_amount,
      tax_amount,
      currency,
      is_partial,
      created_at
    ) VALUES (
      v_new_cn_num,
      v_orig_inv_num,
      v_canonical_pay_id,
      v_owner_user_id,
      v_clean_rfnd_id,
      COALESCE(NULLIF(BTRIM(p_reason, E' \t\n\r\f\v'), ''), 'Educational course fee refund'),
      p_refund_amount,
      v_base_amount,
      v_tax_amount,
      v_effective_currency,
      v_is_partial,
      COALESCE(p_date, NOW())
    )
    RETURNING credit_notes.id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT cn.id, cn.credit_note_number, cn.original_invoice_number, cn.payment_id,
           cn.refund_id, cn.amount, cn.base_amount, cn.tax_amount, cn.is_partial
    INTO v_existing_cn
    FROM public.credit_notes cn
    WHERE BTRIM(cn.refund_id, E' \t\n\r\f\v') = v_clean_rfnd_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    IF BTRIM(COALESCE(v_existing_cn.payment_id, ''), E' \t\n\r\f\v') NOT IN (v_canonical_pay_id, v_payment_uuid_text) THEN
      RAISE EXCEPTION 'Refund ID % is already associated with another payment (%) and cannot be reused for payment %.',
        v_clean_rfnd_id, v_existing_cn.payment_id, v_canonical_pay_id;
    END IF;

    SELECT COALESCE(SUM(c.amount), 0.00)
    INTO v_prior_refund_total
    FROM public.credit_notes c
    WHERE BTRIM(COALESCE(c.payment_id, ''), E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text);

    v_remaining := GREATEST(0.00, COALESCE(v_payment.amount, 0.00) - v_prior_refund_total);

    RETURN QUERY SELECT
      v_existing_cn.id,
      v_existing_cn.credit_note_number,
      v_existing_cn.original_invoice_number,
      v_existing_cn.payment_id,
      v_existing_cn.refund_id,
      v_existing_cn.amount,
      v_existing_cn.base_amount,
      v_existing_cn.tax_amount,
      v_existing_cn.is_partial,
      v_remaining,
      TRUE;
    RETURN;
  END;

  -- 9. Update payment record if balance fully refunded
  IF (v_prior_refund_total + p_refund_amount) >= v_payment.amount THEN
    UPDATE public.payments
    SET status = 'refunded',
        credit_note_number = COALESCE(NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), ''), v_new_cn_num),
        updated_at = NOW()
    WHERE id = v_payment.id;
  END IF;

  -- 10. Return credit note details
  RETURN QUERY SELECT
    v_new_id,
    v_new_cn_num,
    v_orig_inv_num,
    v_canonical_pay_id,
    v_clean_rfnd_id,
    p_refund_amount,
    v_base_amount,
    v_tax_amount,
    v_is_partial,
    (v_remaining - p_refund_amount),
    FALSE;
END;
$$;

-- Revoke execute permissions on generator functions from unprivileged roles
REVOKE ALL ON FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_next_credit_note_number(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_student_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_enrollment_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_credit_note_with_limit(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

-- Grant execution strictly to trusted server-side roles
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.get_next_credit_note_number(TIMESTAMPTZ) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.generate_student_id() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.generate_enrollment_id() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.record_credit_note_with_limit(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ) TO service_role, postgres;

-- ==============================================================================
-- 6. WHITESPACE NORMALIZATION & HISTORICAL RECONCILIATION (CREDIT_NOTES + PAYMENTS)
-- Normalize control/ASCII whitespace (spaces, tabs, newlines, CR, FF, VT) across all
-- unique identifier columns BEFORE sequence reconciliation and deduplication so untrimmed
-- legacy rows are never skipped and hidden whitespace duplicates cannot break Phase B.
-- ==============================================================================

UPDATE public.profiles
SET student_id = NULLIF(BTRIM(student_id, E' \t\n\r\f\v'), '')
WHERE student_id IS NOT NULL
  AND student_id IS DISTINCT FROM NULLIF(BTRIM(student_id, E' \t\n\r\f\v'), '');

UPDATE public.course_enrollments
SET enrollment_id = NULLIF(BTRIM(enrollment_id, E' \t\n\r\f\v'), '')
WHERE enrollment_id IS NOT NULL
  AND enrollment_id IS DISTINCT FROM NULLIF(BTRIM(enrollment_id, E' \t\n\r\f\v'), '');

UPDATE public.payments
SET invoice_number = NULLIF(BTRIM(invoice_number, E' \t\n\r\f\v'), ''),
    credit_note_number = NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), '')
WHERE (invoice_number IS NOT NULL AND invoice_number IS DISTINCT FROM NULLIF(BTRIM(invoice_number, E' \t\n\r\f\v'), ''))
   OR (credit_note_number IS NOT NULL AND credit_note_number IS DISTINCT FROM NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), ''));

-- Safely normalize legacy credit_notes columns (preserving NOT NULL constraints where enforced)
DO $$
DECLARE
  v_cn_num_nullable BOOLEAN;
  v_rfnd_nullable BOOLEAN;
BEGIN
  SELECT (is_nullable = 'YES') INTO v_cn_num_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'credit_note_number';

  SELECT (is_nullable = 'YES') INTO v_rfnd_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'refund_id';

  UPDATE public.credit_notes
  SET payment_id = BTRIM(payment_id, E' \t\n\r\f\v')
  WHERE payment_id IS NOT NULL
    AND payment_id IS DISTINCT FROM BTRIM(payment_id, E' \t\n\r\f\v');

  UPDATE public.credit_notes
  SET credit_note_number = CASE
    WHEN v_cn_num_nullable THEN NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), '')
    ELSE BTRIM(credit_note_number, E' \t\n\r\f\v')
  END
  WHERE credit_note_number IS NOT NULL
    AND credit_note_number IS DISTINCT FROM CASE
      WHEN v_cn_num_nullable THEN NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), '')
      ELSE BTRIM(credit_note_number, E' \t\n\r\f\v')
    END;

  UPDATE public.credit_notes
  SET refund_id = CASE
    WHEN v_rfnd_nullable THEN NULLIF(BTRIM(refund_id, E' \t\n\r\f\v'), '')
    ELSE BTRIM(refund_id, E' \t\n\r\f\v')
  END
  WHERE refund_id IS NOT NULL
    AND refund_id IS DISTINCT FROM CASE
      WHEN v_rfnd_nullable THEN NULLIF(BTRIM(refund_id, E' \t\n\r\f\v'), '')
      ELSE BTRIM(refund_id, E' \t\n\r\f\v')
    END;
END $$;

-- A. Align invoice_series from existing payments.invoice_number
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      SUBSTRING(invoice_number FROM '^DM/([0-9]{2}-[0-9]{2})/[0-9]+$') AS fy,
      MAX(SUBSTRING(invoice_number FROM '^DM/[0-9]{2}-[0-9]{2}/([0-9]+)$')::BIGINT) AS max_seq
    FROM public.payments
    WHERE invoice_number ~ '^DM/[0-9]{2}-[0-9]{2}/[0-9]+$'
    GROUP BY SUBSTRING(invoice_number FROM '^DM/([0-9]{2}-[0-9]{2})/[0-9]+$')
  LOOP
    IF r.fy IS NOT NULL THEN
      INSERT INTO public.invoice_series (financial_year, last_sequence, updated_at)
      VALUES (r.fy, r.max_seq, NOW())
      ON CONFLICT (financial_year)
      DO UPDATE SET 
        last_sequence = GREATEST(public.invoice_series.last_sequence, r.max_seq),
        updated_at = NOW();
    END IF;
  END LOOP;
END $$;

-- B. Align credit_note_series inspecting BOTH credit_notes AND payments tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      SUBSTRING(cn_num FROM '^CN/([0-9]{2}-[0-9]{2})/[0-9]+$') AS fy,
      MAX(SUBSTRING(cn_num FROM '^CN/[0-9]{2}-[0-9]{2}/([0-9]+)$')::BIGINT) AS max_seq
    FROM (
      SELECT credit_note_number AS cn_num FROM public.credit_notes WHERE credit_note_number ~ '^CN/[0-9]{2}-[0-9]{2}/[0-9]+$'
      UNION ALL
      SELECT credit_note_number AS cn_num FROM public.payments WHERE credit_note_number ~ '^CN/[0-9]{2}-[0-9]{2}/[0-9]+$'
    ) combined_cn
    GROUP BY SUBSTRING(cn_num FROM '^CN/([0-9]{2}-[0-9]{2})/[0-9]+$')
  LOOP
    IF r.fy IS NOT NULL THEN
      INSERT INTO public.credit_note_series (financial_year, last_sequence, updated_at)
      VALUES (r.fy, r.max_seq, NOW())
      ON CONFLICT (financial_year)
      DO UPDATE SET 
        last_sequence = GREATEST(public.credit_note_series.last_sequence, r.max_seq),
        updated_at = NOW();
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 7. SAFE BACKFILL & CONFLICT DEDUPLICATION
-- ==============================================================================

-- A. Profiles Student ID Deduplication: Earliest profile retains ID; duplicates re-assigned
DO $$
DECLARE
  dup RECORD;
  dup_row RECORD;
BEGIN
  FOR dup IN 
    SELECT student_id, COUNT(*) as cnt 
    FROM public.profiles 
    WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != '' 
    GROUP BY student_id HAVING COUNT(*) > 1
  LOOP
    FOR dup_row IN 
      SELECT id FROM public.profiles 
      WHERE student_id = dup.student_id 
      ORDER BY created_at ASC NULLS LAST, id ASC OFFSET 1 
    LOOP
      UPDATE public.profiles SET student_id = public.generate_student_id() WHERE id = dup_row.id;
    END LOOP;
  END LOOP;
END $$;

-- B. Profiles Student ID Backfill for missing values
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE student_id IS NULL OR BTRIM(student_id, E' \t\n\r\f\v') = '' ORDER BY created_at ASC NULLS LAST, id ASC LOOP
    UPDATE public.profiles SET student_id = public.generate_student_id() WHERE id = r.id;
  END LOOP;
END $$;

-- ZERO-DOWNTIME MIGRATION (SEC-01 Compliance):
-- In-transaction CREATE UNIQUE INDEX acquires a restrictive SHARE lock that blocks concurrent INSERT/UPDATE operations.
-- Therefore, ordinary CREATE UNIQUE INDEX is removed from this transactional migration (Phase A) and executed
-- non-blocking in Phase B via:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id is executed concurrently in 20261107000002_concurrent_indexes.sql

-- C. Course Enrollments Enrolment ID Deduplication
DO $$
DECLARE
  dup RECORD;
  dup_row RECORD;
BEGIN
  FOR dup IN 
    SELECT enrollment_id, COUNT(*) as cnt 
    FROM public.course_enrollments 
    WHERE enrollment_id IS NOT NULL AND BTRIM(enrollment_id, E' \t\n\r\f\v') != '' 
    GROUP BY enrollment_id HAVING COUNT(*) > 1
  LOOP
    FOR dup_row IN 
      SELECT id FROM public.course_enrollments 
      WHERE enrollment_id = dup.enrollment_id 
      ORDER BY created_at ASC NULLS LAST, id ASC OFFSET 1 
    LOOP
      UPDATE public.course_enrollments SET enrollment_id = public.generate_enrollment_id() WHERE id = dup_row.id;
    END LOOP;
  END LOOP;
END $$;

-- D. Course Enrollments Enrolment ID Backfill for missing values
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.course_enrollments WHERE enrollment_id IS NULL OR BTRIM(enrollment_id, E' \t\n\r\f\v') = '' ORDER BY created_at ASC NULLS LAST, id ASC LOOP
    UPDATE public.course_enrollments SET enrollment_id = public.generate_enrollment_id() WHERE id = r.id;
  END LOOP;
END $$;

-- ZERO-DOWNTIME MIGRATION (SEC-01 Compliance):
-- Defer to Phase B: CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enrollments_enrollment_id is executed non-blocking via CREATE UNIQUE INDEX CONCURRENTLY in 20261107000002_concurrent_indexes.sql

-- E. Payments Invoice Number Backfill
-- STRICT SECURITY RULES:
-- 1. ONLY backfill rows with status in ('captured', 'paid', 'completed').
-- 2. NEVER backfill or assign an invoice number to refunded, failed, pending, or cancelled orders.
-- 3. NEVER overwrite or alter any pre-existing invoice number.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, created_at 
    FROM public.payments 
    WHERE status IN ('captured', 'paid', 'completed') 
      AND (invoice_number IS NULL OR BTRIM(invoice_number, E' \t\n\r\f\v') = '') 
    ORDER BY created_at ASC NULLS LAST, id ASC 
  LOOP
    UPDATE public.payments 
    SET invoice_number = public.get_next_invoice_number(r.created_at) 
    WHERE id = r.id AND (invoice_number IS NULL OR BTRIM(invoice_number, E' \t\n\r\f\v') = '');
  END LOOP;
END $$;

-- F. Pre-Phase-B Financial Duplicate Safety Check (fail fast rather than half-completing concurrent indexes)
DO $$
DECLARE
  v_dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT invoice_number FROM public.payments
    WHERE invoice_number IS NOT NULL AND BTRIM(invoice_number, E' \t\n\r\f\v') != ''
    GROUP BY invoice_number HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate payments.invoice_number value(s). Reconcile financial ledger before proceeding to Phase B.', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT credit_note_number FROM public.payments
    WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY credit_note_number HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate payments.credit_note_number value(s). Reconcile financial ledger before proceeding to Phase B.', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT credit_note_number FROM public.credit_notes
    WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY credit_note_number HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate credit_notes.credit_note_number value(s). Reconcile financial ledger before proceeding to Phase B.', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT refund_id FROM public.credit_notes
    WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != ''
    GROUP BY refund_id HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate credit_notes.refund_id value(s). Reconcile financial ledger before proceeding to Phase B.', v_dup_count;
  END IF;
END $$;

-- ZERO-DOWNTIME MIGRATION (SEC-01 Compliance):
-- Defer to Phase B: CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_invoice_number is executed non-blocking via CREATE UNIQUE INDEX CONCURRENTLY in 20261107000002_concurrent_indexes.sql
-- Defer to Phase B: CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_credit_note_number is executed non-blocking via CREATE UNIQUE INDEX CONCURRENTLY in 20261107000002_concurrent_indexes.sql

-- ==============================================================================
-- 8. INTEGRITY TRIGGERS & TAMPERING GUARDS
-- ==============================================================================

-- Trigger: Ensure new profiles receive a permanent Student ID
CREATE OR REPLACE FUNCTION public.trigger_set_student_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Trigger: Ensure new enrollments receive a permanent Enrolment ID
CREATE OR REPLACE FUNCTION public.trigger_set_enrollment_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Trigger: Payment security & invoice lifecycle enforcement
-- 1. If an invoice number exists historically (non-blank), it is permanently locked and can NEVER be overwritten or wiped.
-- 2. If status is unverified/unpaid/refunded (pending, created, authorized, failed, cancelled, refunded),
--    an invoice number is NEVER generated AND any forged invoice_number supplied on INSERT is cleared to NULL.
-- 3. Note: Database triggers CANNOT verify Razorpay signatures or gateway capture; server-side
--    cryptographic verification and gateway API capture checks in paymentRoutes/paymentWebhook remain mandatory.
CREATE OR REPLACE FUNCTION public.trigger_set_payment_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_norm_status TEXT := LOWER(BTRIM(COALESCE(NEW.status, ''), E' \t\n\r\f\v'));
  v_has_old_inv BOOLEAN := (
    TG_OP = 'UPDATE'
    AND OLD.invoice_number IS NOT NULL
    AND BTRIM(OLD.invoice_number, E' \t\n\r\f\v') != ''
  );
BEGIN
  -- Permanent audit lock: Never allow altering or erasing an already-issued non-blank invoice_number
  IF v_has_old_inv THEN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      NEW.invoice_number := OLD.invoice_number;
    END IF;
  ELSE
    NEW.invoice_number := NULLIF(BTRIM(NEW.invoice_number, E' \t\n\r\f\v'), '');
  END IF;

  -- Security: Never mint OR retain forged invoice numbers on unpaid, refunded, or unverified statuses
  IF NEW.status IN ('refunded', 'failed', 'cancelled', 'pending') THEN
    IF NOT v_has_old_inv THEN
      NEW.invoice_number := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF v_norm_status NOT IN ('captured', 'paid', 'completed') THEN
    IF NOT v_has_old_inv THEN
      NEW.invoice_number := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Only mint invoice for verified captured/paid/completed status if not already set
  IF v_norm_status IN ('captured', 'paid', 'completed')
     AND (NEW.invoice_number IS NULL OR BTRIM(NEW.invoice_number, E' \t\n\r\f\v') = '') THEN
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

-- Trigger: Protect payment status from client-side tampering (INSERT & UPDATE)
-- Blocks unauthorized client sessions (authenticated/anon) from inserting or mutating payment status to captured/paid/completed.
-- IMPORTANT: Triggers cannot verify Razorpay gateway capture or HMAC signatures; server-side authorization is mandatory.
CREATE OR REPLACE FUNCTION public.protect_payment_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_status TEXT := LOWER(BTRIM(COALESCE(NEW.status, ''), E' \t\n\r\f\v'));
  v_old_status TEXT := LOWER(BTRIM(COALESCE(OLD.status, ''), E' \t\n\r\f\v'));
BEGIN
  -- Defense-in-depth: Block unprivileged client roles from setting captured/paid/completed status on INSERT or UPDATE
  IF v_new_status IN ('captured', 'paid', 'completed') THEN
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
      -- In Supabase PostgREST, client sessions run with auth.role() = 'authenticated' or 'anon'
      IF auth.role() IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'Unauthorized: Status % cannot be set directly by client roles. Payment must be verified via server-side Razorpay webhook or verification handler.', NEW.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_status ON public.payments;
CREATE TRIGGER trg_protect_payment_status
  BEFORE INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_payment_status_transitions();

COMMIT;

-- ==============================================================================
-- 9. PRODUCTION ZERO-DOWNTIME CONCURRENT INDEXING & LOCKING STRATEGY
-- ==============================================================================
--
-- Postgres Locking Analysis:
-- 1. ALTER TABLE ... ADD COLUMN IF NOT EXISTS:
--    - Lock: AccessExclusiveLock
--    - Duration: < 2ms (catalog metadata update only; no table rewrite in Postgres 11+)
-- 2. CREATE TABLE / SEQUENCE IF NOT EXISTS:
--    - Lock: None on existing tables (ShareUpdateExclusiveLock on new relation)
-- 3. CREATE UNIQUE INDEX:
--    - Inside transaction: Takes ShareLock, blocking concurrent writes (INSERT/UPDATE/DELETE)
--    - For live production deployments with high write volumes, the partial unique indexes
--      can optionally be executed outside the transaction block using CONCURRENTLY:
--
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_refund_id
--     ON public.credit_notes (refund_id)
--     WHERE refund_id IS NOT NULL AND TRIM(refund_id) != '';
--
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
--     ON public.profiles (student_id)
--     WHERE student_id IS NOT NULL AND TRIM(student_id) != '';
--
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_course_enrollments_enrollment_id
--     ON public.course_enrollments (enrollment_id)
--     WHERE enrollment_id IS NOT NULL AND TRIM(enrollment_id) != '';
--
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_number
--     ON public.payments (invoice_number)
--     WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != '';
--
-- Rollback Strategy:
-- In the event of migration failure prior to COMMIT, all transactional DDL automatically rolls back.
-- If rolled back manually post-COMMIT, drop added triggers and columns without data corruption.
-- ==============================================================================
