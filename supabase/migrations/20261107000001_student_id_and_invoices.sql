-- ==============================================================================
-- DIGITALMUID UNIFIED STUDENT BILLING & GST TAX INVOICE SYSTEM MIGRATION
-- PHASE A: TRANSACTIONAL SCHEMA, RECONCILIATION, RPCS & LIFECYCLE TRIGGERS (V4.3 FINAL)
-- File: supabase/migrations/20261107000001_student_id_and_invoices.sql
--
-- Architecture & Locking Disclosure (IMPORTANT — DO NOT MISREPRESENT AS ZERO-DOWNTIME):
-- 1. Phase A acquires AccessExclusiveLock on altered tables (ADD COLUMN, ALTER COLUMN,
--    DROP/ADD CONSTRAINT, CREATE/DROP TRIGGER, GRANT/REVOKE, RLS POLICY) and executes
--    table-wide normalization/backfill UPDATEs inside a single transaction. Schedule Phase A
--    during an explicit maintenance/write-freeze window with a short lock_timeout.
-- 2. Phase A creates ZERO indexes; all 8 indexes (6 unique partial + 2 lookup) execute
--    non-transactionally via CREATE [UNIQUE] INDEX CONCURRENTLY in Phase B
--    (20261107000002_concurrent_indexes.sql).
-- 3. Phase A -> Phase B Gate: record_credit_note_with_limit() checks pg_catalog.pg_index
--    and refuses credit-note processing until Phase B indexes idx_credit_notes_number and
--    idx_credit_notes_refund_id are built and marked indisvalid = TRUE AND indisready = TRUE.
-- 4. Timezone & GST Compliance: Financial Year projected explicitly to 'Asia/Kolkata'.
-- 5. Triggers enforce DB role/immutability hygiene only; triggers CANNOT verify Razorpay
--    gateway capture or cryptographic signatures (server/paymentRoutes & webhook remain mandatory).
-- ==============================================================================

BEGIN;

-- Fail slow-lock pileups quickly instead of queuing production traffic behind AccessExclusiveLock
SET LOCAL lock_timeout = '5s';

-- ==============================================================================
-- 1. SCHEMA EXTENSIONS & EXPLICIT PAYMENT STATUS CONSTRAINT ORDERING
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

-- Ensure payments.user_id allows NULL for guest checkouts
ALTER TABLE public.payments
  ALTER COLUMN user_id DROP NOT NULL;

-- Fail-closed default: inserts omitting status never default to 'captured'
ALTER TABLE public.payments
  ALTER COLUMN status SET DEFAULT 'pending';

-- PAYMENT STATUS MIGRATION ORDERING (Fixes Check-Violation & Broad-Drop Defects):
-- Step 1A: Identify and drop ONLY explicitly approved legacy single-column status CHECK constraints
--          BEFORE normalizing existing rows (e.g. staging_baseline_review's payments_status_check
--          only permits captured/refunded/failed and would abort UPDATEs to 'pending').
--          Never broadly drop unrelated or multi-column CHECK constraints.
DO $$
DECLARE
  v_payments_oid OID := 'public.payments'::regclass;
  v_status_attnum SMALLINT;
  v_con RECORD;
BEGIN
  SELECT a.attnum INTO v_status_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_payments_oid
    AND a.attname = 'status'
    AND NOT a.attisdropped;

  IF v_status_attnum IS NULL THEN
    RAISE EXCEPTION 'Compatibility failure: public.payments.status column not found.';
  END IF;

  FOR v_con IN
    SELECT c.conname, pg_catalog.pg_get_constraintdef(c.oid) AS def, c.conkey
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_payments_oid
      AND c.contype = 'c'
  LOOP
    -- Approved target 1: Explicitly named legacy/prior status constraints on status column only
    IF v_con.conname IN ('payments_status_check', 'chk_payments_status')
       AND v_con.conkey = ARRAY[v_status_attnum] THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS %I', v_con.conname);

    -- Approved target 2: Auto-named single-column enum CHECK strictly matching status IN / = ANY / = literal
    ELSIF v_con.conkey = ARRAY[v_status_attnum]
       AND v_con.def ~* '^\s*CHECK\s*\(\s*\(*\s*status(\)::text)?\s*(?:IN\s*\(|=\s*ANY\s*\(|=\s*'''')' THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS %I', v_con.conname);

    -- Fail closed if any unapproved multi-column or non-enum constraint references status
    ELSIF v_status_attnum = ANY(COALESCE(v_con.conkey, ARRAY[]::SMALLINT[])) THEN
      RAISE EXCEPTION 'Migration halt: Unapproved CHECK constraint % (%) references public.payments.status. Inspect manually before proceeding.',
        v_con.conname, v_con.def;
    END IF;
  END LOOP;
END $$;

-- Step 1B: Normalize existing payment status values AFTER incompatible legacy CHECK removal
UPDATE public.payments
SET status = LOWER(pg_catalog.btrim(status, E' \t\n\r\f\v'))
WHERE status IS NOT NULL
  AND status IS DISTINCT FROM LOWER(pg_catalog.btrim(status, E' \t\n\r\f\v'));

UPDATE public.payments
SET status = 'cancelled'
WHERE status = 'canceled';

UPDATE public.payments
SET status = 'pending'
WHERE status IS NULL;

-- Fail closed if unknown non-null statuses exist rather than silently mutating accounting history
DO $$
DECLARE
  v_bad_status_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bad_status_count
  FROM public.payments
  WHERE status NOT IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded');

  IF v_bad_status_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % public.payments row(s) with unrecognized status outside lifecycle enum. Reconcile before adding chk_payments_status.', v_bad_status_count;
  END IF;
END $$;

-- Step 1C: Add and explicitly validate the canonical payment status CHECK constraint
ALTER TABLE public.payments
  ADD CONSTRAINT chk_payments_status
  CHECK (status IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded'))
  NOT VALID;

ALTER TABLE public.payments
  VALIDATE CONSTRAINT chk_payments_status;

-- Resource Purchases: Persistent Invoice Number
ALTER TABLE public.resource_purchases
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Bookings (Consultations): Persistent Invoice Number
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- ==============================================================================
-- 2. ATOMIC SERIES, CREDIT NOTE TABLES & LEGACY COMPATIBILITY INSPECTION
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
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
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

-- Schema compatibility extensions for pre-existing tables (followed immediately by strict type/default checks)
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

-- Verify actual column types & defaults on pre-existing tables (ADD COLUMN IF NOT EXISTS never guarantees type compatibility)
DO $$
DECLARE
  v_col RECORD;
BEGIN
  -- 1. Inspect public.credit_notes critical columns
  SELECT data_type, column_default INTO v_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'id';
  IF NOT FOUND OR v_col.data_type <> 'uuid' THEN
    RAISE EXCEPTION 'Compatibility failure: public.credit_notes.id must be UUID (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;
  IF v_col.column_default IS NULL THEN
    ALTER TABLE public.credit_notes ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
  END IF;

  FOR v_col IN
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_notes'
      AND column_name IN ('amount', 'tax_amount', 'base_amount')
  LOOP
    IF v_col.data_type <> 'numeric'
       OR (v_col.numeric_scale IS NOT NULL AND v_col.numeric_scale < 2)
       OR (v_col.numeric_precision IS NOT NULL AND v_col.numeric_precision < 10) THEN
      RAISE EXCEPTION 'Compatibility failure: public.credit_notes.% must be NUMERIC(>=10, >=2) (found % precision=% scale=%).',
        v_col.column_name, v_col.data_type, v_col.numeric_precision, v_col.numeric_scale;
    END IF;
  END LOOP;

  FOR v_col IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_notes'
      AND column_name IN ('credit_note_number', 'original_invoice_number', 'payment_id', 'refund_id', 'currency', 'reason')
  LOOP
    IF v_col.data_type NOT IN ('text', 'character varying') THEN
      RAISE EXCEPTION 'Compatibility failure: public.credit_notes.% must be TEXT/VARCHAR (found %).',
        v_col.column_name, v_col.data_type;
    END IF;
  END LOOP;

  SELECT data_type INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'user_id';
  IF NOT FOUND OR v_col.data_type <> 'uuid' THEN
    RAISE EXCEPTION 'Compatibility failure: public.credit_notes.user_id must be UUID (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  SELECT data_type INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'is_partial';
  IF NOT FOUND OR v_col.data_type <> 'boolean' THEN
    RAISE EXCEPTION 'Compatibility failure: public.credit_notes.is_partial must be BOOLEAN (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  SELECT data_type INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'created_at';
  IF NOT FOUND OR v_col.data_type NOT IN ('timestamp with time zone', 'timestamp without time zone') THEN
    RAISE EXCEPTION 'Compatibility failure: public.credit_notes.created_at must be TIMESTAMPTZ/TIMESTAMP (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  SELECT data_type INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'metadata';
  IF NOT FOUND OR v_col.data_type <> 'jsonb' THEN
    RAISE EXCEPTION 'Compatibility failure: public.credit_notes.metadata must be JSONB (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  -- Explicitly set required column defaults on pre-existing credit_notes columns
  ALTER TABLE public.credit_notes
    ALTER COLUMN reason SET DEFAULT 'Course enrollment cancellation & refund',
    ALTER COLUMN currency SET DEFAULT 'INR',
    ALTER COLUMN is_partial SET DEFAULT FALSE,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

  -- 2. Inspect public.payments critical columns
  SELECT data_type INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'id';
  IF NOT FOUND OR v_col.data_type <> 'uuid' THEN
    RAISE EXCEPTION 'Compatibility failure: public.payments.id must be UUID (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  SELECT data_type INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'user_id';
  IF NOT FOUND OR v_col.data_type <> 'uuid' THEN
    RAISE EXCEPTION 'Compatibility failure: public.payments.user_id must be UUID (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  SELECT data_type, numeric_scale INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount';
  IF NOT FOUND OR v_col.data_type <> 'numeric' OR (v_col.numeric_scale IS NOT NULL AND v_col.numeric_scale < 2) THEN
    RAISE EXCEPTION 'Compatibility failure: public.payments.amount must be NUMERIC with scale >= 2 (found %).', COALESCE(v_col.data_type, 'MISSING');
  END IF;

  FOR v_col IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name IN ('status', 'currency', 'razorpay_payment_id', 'invoice_number', 'credit_note_number')
  LOOP
    IF v_col.data_type NOT IN ('text', 'character varying') THEN
      RAISE EXCEPTION 'Compatibility failure: public.payments.% must be TEXT/VARCHAR (found %).',
        v_col.column_name, v_col.data_type;
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- ZERO-DOWNTIME TWO-PHASE DEPLOYMENT ARCHITECTURE (F-03 Legacy Tag — Locking Disclosure):
-- NOTE: Phase A holds AccessExclusiveLock for catalog/trigger DDL and is NOT zero-downtime.
-- All 8 indexes execute concurrently OUTSIDE transactions in Phase B
-- (20261107000002_concurrent_indexes.sql); ZERO index DDL is executed in Phase A.
--
-- Target Concurrent Indexes executed in Phase B:
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number ON public.credit_notes (credit_note_number) WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != '';
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_refund_id ON public.credit_notes (refund_id) WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != '';
--   idx_credit_notes_payment_id, idx_credit_notes_user_id, idx_profiles_student_id,
--   idx_course_enrollments_enrollment_id, idx_payments_invoice_number, idx_payments_credit_note_number
-- ==============================================================================

-- ==============================================================================
-- 3. EXPLICIT SQL TABLE PRIVILEGES & ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.invoice_series FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.credit_note_series FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_series TO service_role, postgres;
GRANT SELECT, INSERT, UPDATE ON public.credit_note_series TO service_role, postgres;

REVOKE ALL ON public.credit_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role, postgres;

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

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon, PUBLIC;
REVOKE UPDATE (status) ON public.payments FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role, postgres;

-- ==============================================================================
-- 4. SEQUENCES & HISTORICAL SYNCHRONIZATION (INSPECTS BOTH last_value AND is_called)
-- Prevents duplicate ID when existing max equals initial START WITH value (10001)
-- while sequence has is_called = false; never rewinds an already-used sequence.
-- ==============================================================================

CREATE SEQUENCE IF NOT EXISTS public.student_id_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS public.enrollment_id_seq START WITH 10001;

DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
  v_is_called BOOLEAN;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(pg_catalog.btrim(student_id, E' \t\n\r\f\v') FROM '^DM-STU-0*([0-9]+)$')::BIGINT), 10000)
  INTO v_max_id
  FROM public.profiles
  WHERE pg_catalog.btrim(student_id, E' \t\n\r\f\v') ~ '^DM-STU-[0-9]+$';

  SELECT last_value, is_called INTO v_curr_val, v_is_called FROM public.student_id_seq;

  IF v_max_id > v_curr_val THEN
    PERFORM pg_catalog.setval('public.student_id_seq', v_max_id, true);
  ELSIF v_max_id = v_curr_val AND NOT v_is_called THEN
    PERFORM pg_catalog.setval('public.student_id_seq', v_max_id, true);
  END IF;
END $$;

DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
  v_is_called BOOLEAN;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(pg_catalog.btrim(enrollment_id, E' \t\n\r\f\v') FROM '^DM-ENR-0*([0-9]+)$')::BIGINT), 10000)
  INTO v_max_id
  FROM public.course_enrollments
  WHERE pg_catalog.btrim(enrollment_id, E' \t\n\r\f\v') ~ '^DM-ENR-[0-9]+$';

  SELECT last_value, is_called INTO v_curr_val, v_is_called FROM public.enrollment_id_seq;

  IF v_max_id > v_curr_val THEN
    PERFORM pg_catalog.setval('public.enrollment_id_seq', v_max_id, true);
  ELSIF v_max_id = v_curr_val AND NOT v_is_called THEN
    PERFORM pg_catalog.setval('public.enrollment_id_seq', v_max_id, true);
  END IF;
END $$;

-- ==============================================================================
-- 5. SECURITY DEFINER IDENTIFIER & CREDIT NOTE FUNCTIONS (SCHEMA-QUALIFIED)
-- Note: SET search_path = public, pg_temp preserved; all tables, functions, and
-- sequences explicitly schema-qualified (`public.*` / `pg_catalog.*`).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := pg_catalog.nextval('public.student_id_seq');
  IF v_next < 1000000 THEN
    RETURN 'DM-STU-' || pg_catalog.lpad(v_next::TEXT, 6, '0');
  ELSE
    RETURN 'DM-STU-' || v_next::TEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_enrollment_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := pg_catalog.nextval('public.enrollment_id_seq');
  IF v_next < 1000000 THEN
    RETURN 'DM-ENR-' || pg_catalog.lpad(v_next::TEXT, 6, '0');
  ELSE
    RETURN 'DM-ENR-' || v_next::TEXT;
  END IF;
END;
$$;

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
  v_date_ist := (COALESCE(p_date, pg_catalog.now()) AT TIME ZONE 'Asia/Kolkata');
  v_month := EXTRACT(MONTH FROM v_date_ist)::INTEGER;
  v_year := EXTRACT(YEAR FROM v_date_ist)::INTEGER;

  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_fy := pg_catalog.lpad(v_fy_start::TEXT, 2, '0') || '-' || pg_catalog.lpad(v_fy_end::TEXT, 2, '0');

  INSERT INTO public.invoice_series (financial_year, last_sequence, updated_at)
  VALUES (v_fy, 1, pg_catalog.now())
  ON CONFLICT (financial_year)
  DO UPDATE SET
    last_sequence = public.invoice_series.last_sequence + 1,
    updated_at = pg_catalog.now()
  RETURNING last_sequence INTO v_seq;

  IF v_seq > 9999999 THEN
    RAISE EXCEPTION 'Invoice sequence overflow for financial year %: maximum 16-character limit reached (limit 9,999,999 under GST Rule 46)', v_fy;
  END IF;

  IF v_seq < 10000 THEN
    v_seq_str := pg_catalog.lpad(v_seq::TEXT, 4, '0');
  ELSE
    v_seq_str := v_seq::TEXT;
  END IF;

  RETURN 'DM/' || v_fy || '/' || v_seq_str;
END;
$$;

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
  v_date_ist := (COALESCE(p_date, pg_catalog.now()) AT TIME ZONE 'Asia/Kolkata');
  v_month := EXTRACT(MONTH FROM v_date_ist)::INTEGER;
  v_year := EXTRACT(YEAR FROM v_date_ist)::INTEGER;

  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_fy := pg_catalog.lpad(v_fy_start::TEXT, 2, '0') || '-' || pg_catalog.lpad(v_fy_end::TEXT, 2, '0');

  INSERT INTO public.credit_note_series (financial_year, last_sequence, updated_at)
  VALUES (v_fy, 1, pg_catalog.now())
  ON CONFLICT (financial_year)
  DO UPDATE SET
    last_sequence = public.credit_note_series.last_sequence + 1,
    updated_at = pg_catalog.now()
  RETURNING last_sequence INTO v_seq;

  IF v_seq > 9999999 THEN
    RAISE EXCEPTION 'Credit note sequence overflow for financial year %: maximum 16-character limit reached (limit 9,999,999 under Section 34 CGST Act)', v_fy;
  END IF;

  IF v_seq < 10000 THEN
    v_seq_str := pg_catalog.lpad(v_seq::TEXT, 4, '0');
  ELSE
    v_seq_str := v_seq::TEXT;
  END IF;

  RETURN 'CN/' || v_fy || '/' || v_seq_str;
END;
$$;

-- ==============================================================================
-- 5B. HARDENED ATOMIC FINANCIAL LIMIT & CREDIT NOTE ISSUANCE FUNCTION
-- Enforces:
-- 1. Phase B unique index deployment gate (halting if idx_credit_notes_number or
--    idx_credit_notes_refund_id are absent, invalid, or unready).
-- 2. Rejects NULL, NaN, <=0, overflow, or >2-decimal refund amounts; uses one canonical
--    NUMERIC(10, 2) v_refund_amount everywhere.
-- 3. Unambiguous payment resolution + FOR UPDATE lock BEFORE idempotency checks.
-- 4. Positive payment amount check + currency policy ('INR') matching payment record.
-- 5. Fail-closed historical credit_notes integrity check (halts if orphan/NULL/blank
--    credit_notes rows prevent reliable cumulative refund calculation).
-- 6. Cross-payment refund_id rejection, caller p_user_id ownership protection, and
--    idempotent retry validation against BOTH original amount AND currency.
-- 7. Subtransaction-protected INSERT with unique_violation recovery without CN burn.
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
  v_gate_spec RECORD;
  v_gate_attnum SMALLINT;
  v_gate_idx RECORD;
  v_gate_pred_regex TEXT;
  v_candidate RECORD;
  v_payment RECORD;
  v_match_count INTEGER := 0;
  v_existing_cn RECORD;
  v_unreliable_cn_count INTEGER := 0;
  v_prior_refund_total NUMERIC(12, 2) := 0.00;
  v_remaining NUMERIC(12, 2);
  v_new_cn_num TEXT;
  v_refund_amount NUMERIC(10, 2);
  v_payment_amount NUMERIC(10, 2);
  v_base_amount NUMERIC(10, 2);
  v_tax_amount NUMERIC(10, 2);
  v_is_partial BOOLEAN;
  v_clean_pay_id TEXT := NULLIF(pg_catalog.btrim(p_payment_id, E' \t\n\r\f\v'), '');
  v_clean_rfnd_id TEXT := NULLIF(pg_catalog.btrim(p_refund_id, E' \t\n\r\f\v'), '');
  v_pay_uuid UUID := NULL;
  v_canonical_pay_id TEXT;
  v_payment_uuid_text TEXT;
  v_owner_user_id UUID;
  v_caller_currency TEXT := NULLIF(UPPER(pg_catalog.btrim(p_currency, E' \t\n\r\f\v')), '');
  v_payment_currency TEXT;
  v_effective_currency TEXT;
  v_new_id UUID;
  v_orig_inv_num TEXT;
BEGIN
  -- 0. Deployment sequencing gate: validate BOTH Phase B unique partial indexes against
  --    actual schema, target table (public.credit_notes), exact single column, uniqueness,
  --    validity/readiness, and partial BTRIM predicate (never accept name-only matches).
  FOR v_gate_spec IN
    SELECT * FROM (VALUES
      ('idx_credit_notes_number',    'credit_note_number'),
      ('idx_credit_notes_refund_id', 'refund_id')
    ) AS req(idx_name, col_name)
  LOOP
    SELECT a.attnum INTO v_gate_attnum
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class tbl ON tbl.oid = a.attrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'credit_notes'
      AND a.attname = v_gate_spec.col_name
      AND NOT a.attisdropped;

    IF v_gate_attnum IS NULL THEN
      RAISE EXCEPTION 'Credit note processing halted: Expected column public.credit_notes.% not found.', v_gate_spec.col_name;
    END IF;

    SELECT
      nt.nspname AS table_schema,
      t.relname AS table_name,
      i.indisunique,
      i.indisvalid,
      i.indisready,
      i.indkey,
      i.indexprs,
      i.indpred,
      pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS pred_expr,
      pg_catalog.pg_get_indexdef(c.oid) AS idx_def
    INTO v_gate_idx
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
    WHERE nc.nspname = 'public'
      AND c.relname = v_gate_spec.idx_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Credit note processing halted: Required Phase B unique index public.% is missing. Complete Phase B (20261107000002_concurrent_indexes.sql) before resuming refunds.',
        v_gate_spec.idx_name;
    END IF;

    IF v_gate_idx.table_schema IS DISTINCT FROM 'public'
       OR v_gate_idx.table_name IS DISTINCT FROM 'credit_notes' THEN
      RAISE EXCEPTION 'Credit note processing halted: Index public.% targets %.% instead of public.credit_notes (%). Complete Phase B or drop and recreate the index concurrently before resuming refunds.',
        v_gate_spec.idx_name, v_gate_idx.table_schema, v_gate_idx.table_name, v_gate_idx.idx_def;
    END IF;

    IF v_gate_idx.indisunique IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Credit note processing halted: Index public.% is NOT unique (%). Complete Phase B or replace the non-unique index concurrently before resuming refunds.',
        v_gate_spec.idx_name, v_gate_idx.idx_def;
    END IF;

    IF v_gate_idx.indisvalid IS DISTINCT FROM TRUE
       OR v_gate_idx.indisready IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Credit note processing halted: Required Phase B index public.% is invalid or not ready (indisvalid=%, indisready=%). Complete Phase B or rebuild concurrently before resuming refunds.',
        v_gate_spec.idx_name, v_gate_idx.indisvalid, v_gate_idx.indisready;
    END IF;

    IF v_gate_idx.indexprs IS NOT NULL
       OR v_gate_idx.indkey::SMALLINT[] IS DISTINCT FROM ARRAY[v_gate_attnum] THEN
      RAISE EXCEPTION 'Credit note processing halted: Index public.% does not exclusively index column public.credit_notes.(%) (%). Complete Phase B or correct the index definition before resuming refunds.',
        v_gate_spec.idx_name, v_gate_spec.col_name, v_gate_idx.idx_def;
    END IF;

    v_gate_pred_regex :=
      '^\s*\(*\s*' || v_gate_spec.col_name || '\s+IS\s+NOT\s+NULL\s*\)*\s+AND\s+\(*\s*(?:pg_catalog\.)?btrim\(\s*\(*\s*'
      || v_gate_spec.col_name
      || '(?:\)*(?:::text)?)\s*,\s*E?'' (?:\t|\\t|\\x09|\\011)(?:\n|\\n|\\x0a|\\012)(?:\r|\\r|\\x0d|\\015)(?:\f|\\f|\\x0c|\\014)(?:\v|\\v|\\x0b|\\013)''(?:::text)?\s*\)\s*(?:<>|!=)\s*''''(?:::text)?\s*\)*\s*$';

    IF v_gate_idx.indpred IS NULL
       OR v_gate_idx.pred_expr IS NULL
       OR v_gate_idx.pred_expr !~* v_gate_pred_regex THEN
      RAISE EXCEPTION 'Credit note processing halted: Index public.% has missing or incorrect partial predicate (%). Expected non-blank BTRIM predicate on %. Complete Phase B or correct the index definition before resuming refunds.',
        v_gate_spec.idx_name, COALESCE(v_gate_idx.pred_expr, '<none>'), v_gate_spec.col_name;
    END IF;
  END LOOP;

  -- 1. Validate inputs: reject NULL, NaN, <=0, >2 decimals, or NUMERIC(10,2) overflow
  IF p_refund_amount IS NULL
     OR p_refund_amount = 'NaN'::NUMERIC
     OR p_refund_amount <= 0
     OR p_refund_amount > 99999999.99
     OR pg_catalog.round(p_refund_amount, 2) IS DISTINCT FROM p_refund_amount THEN
    RAISE EXCEPTION 'Invalid refund amount %: Amount must be a finite positive number with at most two decimal places.', p_refund_amount;
  END IF;

  v_refund_amount := pg_catalog.round(p_refund_amount, 2)::NUMERIC(10, 2);

  IF v_clean_pay_id IS NULL THEN
    RAISE EXCEPTION 'Missing payment_id: Credit note issuance requires a non-empty payment_id.';
  END IF;

  IF v_clean_rfnd_id IS NULL THEN
    RAISE EXCEPTION 'Missing refund_id: Database idempotency requires a non-empty refund_id.';
  END IF;

  IF v_caller_currency IS NULL OR v_caller_currency NOT IN ('INR') THEN
    RAISE EXCEPTION 'Unsupported or missing currency %: DigitalMuid credit notes strictly require supported currency INR.', p_currency;
  END IF;

  IF v_clean_pay_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pay_uuid := v_clean_pay_id::UUID;
  END IF;

  -- 2. Resolve unambiguously and acquire row-level FOR UPDATE lock BEFORE idempotency checks
  FOR v_candidate IN
    SELECT p.id, p.razorpay_payment_id, p.amount, p.currency, p.status, p.invoice_number, p.user_id, p.credit_note_number
    FROM public.payments p
    WHERE pg_catalog.btrim(COALESCE(p.razorpay_payment_id, ''), E' \t\n\r\f\v') = v_clean_pay_id
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

  v_canonical_pay_id := COALESCE(
    NULLIF(pg_catalog.btrim(v_payment.razorpay_payment_id, E' \t\n\r\f\v'), ''),
    v_payment.id::TEXT
  );
  v_payment_uuid_text := v_payment.id::TEXT;

  -- Validate authoritative payment amount and currency
  IF v_payment.amount IS NULL
     OR v_payment.amount = 'NaN'::NUMERIC
     OR v_payment.amount <= 0
     OR v_payment.amount > 99999999.99
     OR pg_catalog.round(v_payment.amount, 2) IS DISTINCT FROM v_payment.amount THEN
    RAISE EXCEPTION 'Invalid payment amount % on payment %: Cannot establish refundable balance reliably.', v_payment.amount, v_canonical_pay_id;
  END IF;
  v_payment_amount := pg_catalog.round(v_payment.amount, 2)::NUMERIC(10, 2);

  v_payment_currency := NULLIF(UPPER(pg_catalog.btrim(COALESCE(v_payment.currency, ''), E' \t\n\r\f\v')), '');
  IF v_payment_currency IS NULL OR v_payment_currency NOT IN ('INR') THEN
    RAISE EXCEPTION 'Unsupported or missing payment currency % on payment %.', v_payment.currency, v_canonical_pay_id;
  END IF;

  IF v_caller_currency IS DISTINCT FROM v_payment_currency THEN
    RAISE EXCEPTION 'Currency mismatch: requested refund currency % does not match authoritative payment currency % for payment %.',
      v_caller_currency, v_payment_currency, v_canonical_pay_id;
  END IF;
  v_effective_currency := v_payment_currency;

  -- Enforce authoritative payment ownership
  IF p_user_id IS NOT NULL AND v_payment.user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_payment.user_id THEN
    RAISE EXCEPTION 'Ownership mismatch: caller user_id % does not match authoritative payment owner % for payment %.',
      p_user_id, v_payment.user_id, v_canonical_pay_id;
  END IF;
  v_owner_user_id := COALESCE(v_payment.user_id, p_user_id);

  -- Fail-closed check: refuse refund processing if historical credit_notes contain unreliable/unassociated rows
  SELECT COUNT(*) INTO v_unreliable_cn_count
  FROM public.credit_notes cn
  WHERE cn.payment_id IS NULL
     OR pg_catalog.btrim(cn.payment_id, E' \t\n\r\f\v') = ''
     OR (
       pg_catalog.btrim(cn.payment_id, E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text)
       AND (
         cn.amount IS NULL
         OR cn.amount = 'NaN'::NUMERIC
         OR cn.amount <= 0
         OR pg_catalog.round(cn.amount, 2) IS DISTINCT FROM cn.amount
         OR cn.refund_id IS NULL
         OR pg_catalog.btrim(cn.refund_id, E' \t\n\r\f\v') = ''
         OR UPPER(pg_catalog.btrim(COALESCE(cn.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_effective_currency
       )
     );

  IF v_unreliable_cn_count > 0 THEN
    RAISE EXCEPTION 'Refund processing halted: Found % corrupt or unassociated historical credit_notes row(s) impacting payment %.',
      v_unreliable_cn_count, v_canonical_pay_id;
  END IF;

  -- 3. Post-lock idempotency check (validates payment_id, refund amount, AND currency)
  SELECT cn.id, cn.credit_note_number, cn.original_invoice_number, cn.payment_id,
         cn.refund_id, cn.amount, cn.currency, cn.base_amount, cn.tax_amount, cn.is_partial
  INTO v_existing_cn
  FROM public.credit_notes cn
  WHERE pg_catalog.btrim(cn.refund_id, E' \t\n\r\f\v') = v_clean_rfnd_id
  LIMIT 1;

  IF FOUND THEN
    IF pg_catalog.btrim(COALESCE(v_existing_cn.payment_id, ''), E' \t\n\r\f\v') NOT IN (v_canonical_pay_id, v_payment_uuid_text) THEN
      RAISE EXCEPTION 'Refund ID % is already associated with another payment (%) and cannot be reused for payment %.',
        v_clean_rfnd_id, v_existing_cn.payment_id, v_canonical_pay_id;
    END IF;

    IF v_existing_cn.amount IS DISTINCT FROM v_refund_amount THEN
      RAISE EXCEPTION 'Idempotent retry mismatch for refund_id %: original amount % differs from requested amount %.',
        v_clean_rfnd_id, v_existing_cn.amount, v_refund_amount;
    END IF;

    IF UPPER(pg_catalog.btrim(COALESCE(v_existing_cn.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_effective_currency THEN
      RAISE EXCEPTION 'Idempotent retry mismatch for refund_id %: original currency % differs from requested currency %.',
        v_clean_rfnd_id, v_existing_cn.currency, v_effective_currency;
    END IF;

    SELECT COALESCE(SUM(c.amount), 0.00)
    INTO v_prior_refund_total
    FROM public.credit_notes c
    WHERE pg_catalog.btrim(COALESCE(c.payment_id, ''), E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text);

    v_remaining := GREATEST(0.00, v_payment_amount - v_prior_refund_total);

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
      v_remaining::NUMERIC,
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
  WHERE pg_catalog.btrim(COALESCE(cn.payment_id, ''), E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text);

  v_remaining := v_payment_amount - v_prior_refund_total;

  -- 5. Strict financial limit enforcement: Reject excessive refunds (NO silent clamping)
  IF v_refund_amount > v_remaining THEN
    RAISE EXCEPTION 'Refund amount % exceeds remaining eligible refundable balance of % (Original Payment: %, Cumulative Prior Refunds: %). Credit note rejected.',
      v_refund_amount, v_remaining, v_payment_amount, v_prior_refund_total;
  END IF;

  -- 6. Calculate GST tax breakdown using canonical v_refund_amount (18% inclusive)
  v_base_amount := pg_catalog.round((v_refund_amount / 1.18), 2)::NUMERIC(10, 2);
  v_tax_amount := (v_refund_amount - v_base_amount)::NUMERIC(10, 2);
  v_is_partial := (v_prior_refund_total + v_refund_amount) < v_payment_amount;
  v_orig_inv_num := COALESCE(
    NULLIF(pg_catalog.btrim(v_payment.invoice_number, E' \t\n\r\f\v'), ''),
    'DM-INV-' || SUBSTRING(v_canonical_pay_id FROM 5)
  );

  -- 7-8. Subtransaction savepoint protects credit_note_series and validates retry parity on race
  BEGIN
    v_new_cn_num := public.get_next_credit_note_number(COALESCE(p_date, pg_catalog.now()));

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
      COALESCE(NULLIF(pg_catalog.btrim(p_reason, E' \t\n\r\f\v'), ''), 'Educational course fee refund'),
      v_refund_amount,
      v_base_amount,
      v_tax_amount,
      v_effective_currency,
      v_is_partial,
      COALESCE(p_date, pg_catalog.now())
    )
    RETURNING credit_notes.id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT cn.id, cn.credit_note_number, cn.original_invoice_number, cn.payment_id,
           cn.refund_id, cn.amount, cn.currency, cn.base_amount, cn.tax_amount, cn.is_partial
    INTO v_existing_cn
    FROM public.credit_notes cn
    WHERE pg_catalog.btrim(cn.refund_id, E' \t\n\r\f\v') = v_clean_rfnd_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    IF pg_catalog.btrim(COALESCE(v_existing_cn.payment_id, ''), E' \t\n\r\f\v') NOT IN (v_canonical_pay_id, v_payment_uuid_text) THEN
      RAISE EXCEPTION 'Refund ID % is already associated with another payment (%) and cannot be reused for payment %.',
        v_clean_rfnd_id, v_existing_cn.payment_id, v_canonical_pay_id;
    END IF;

    IF v_existing_cn.amount IS DISTINCT FROM v_refund_amount THEN
      RAISE EXCEPTION 'Idempotent retry mismatch for refund_id %: original amount % differs from requested amount %.',
        v_clean_rfnd_id, v_existing_cn.amount, v_refund_amount;
    END IF;

    IF UPPER(pg_catalog.btrim(COALESCE(v_existing_cn.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_effective_currency THEN
      RAISE EXCEPTION 'Idempotent retry mismatch for refund_id %: original currency % differs from requested currency %.',
        v_clean_rfnd_id, v_existing_cn.currency, v_effective_currency;
    END IF;

    SELECT COALESCE(SUM(c.amount), 0.00)
    INTO v_prior_refund_total
    FROM public.credit_notes c
    WHERE pg_catalog.btrim(COALESCE(c.payment_id, ''), E' \t\n\r\f\v') IN (v_canonical_pay_id, v_payment_uuid_text);

    v_remaining := GREATEST(0.00, v_payment_amount - v_prior_refund_total);

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
      v_remaining::NUMERIC,
      TRUE;
    RETURN;
  END;

  -- 9. Update payment record if balance fully refunded (explicit alias avoids OUT-var ambiguity)
  IF (v_prior_refund_total + v_refund_amount) >= v_payment_amount THEN
    UPDATE public.payments AS pay
    SET status = 'refunded',
        credit_note_number = COALESCE(NULLIF(pg_catalog.btrim(pay.credit_note_number, E' \t\n\r\f\v'), ''), v_new_cn_num),
        updated_at = pg_catalog.now()
    WHERE pay.id = v_payment.id;
  END IF;

  -- 10. Return canonical credit note details
  RETURN QUERY SELECT
    v_new_id,
    v_new_cn_num,
    v_orig_inv_num,
    v_canonical_pay_id,
    v_clean_rfnd_id,
    v_refund_amount::NUMERIC,
    v_base_amount::NUMERIC,
    v_tax_amount::NUMERIC,
    v_is_partial,
    (v_remaining - v_refund_amount)::NUMERIC,
    FALSE;
END;
$$;

-- Revoke direct execute permissions on ALL generator and trigger functions from unprivileged roles
REVOKE ALL ON FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_next_credit_note_number(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_student_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_enrollment_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_credit_note_with_limit(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.get_next_credit_note_number(TIMESTAMPTZ) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.generate_student_id() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.generate_enrollment_id() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.record_credit_note_with_limit(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ) TO service_role, postgres;

-- ==============================================================================
-- 6. WHITESPACE NORMALIZATION & FAIL-CLOSED HISTORICAL CREDIT-NOTE AUDIT
-- NOTE: Large table UPDATEs acquire row locks across affected rows until COMMIT.
-- Never invent missing financial fields; halt if unreliable historical rows exist.
-- ==============================================================================

UPDATE public.profiles
SET student_id = NULLIF(pg_catalog.btrim(student_id, E' \t\n\r\f\v'), '')
WHERE student_id IS NOT NULL
  AND student_id IS DISTINCT FROM NULLIF(pg_catalog.btrim(student_id, E' \t\n\r\f\v'), '');

UPDATE public.course_enrollments
SET enrollment_id = NULLIF(pg_catalog.btrim(enrollment_id, E' \t\n\r\f\v'), '')
WHERE enrollment_id IS NOT NULL
  AND enrollment_id IS DISTINCT FROM NULLIF(pg_catalog.btrim(enrollment_id, E' \t\n\r\f\v'), '');

UPDATE public.payments
SET invoice_number = NULLIF(pg_catalog.btrim(invoice_number, E' \t\n\r\f\v'), ''),
    credit_note_number = NULLIF(pg_catalog.btrim(credit_note_number, E' \t\n\r\f\v'), '')
WHERE (invoice_number IS NOT NULL AND invoice_number IS DISTINCT FROM NULLIF(pg_catalog.btrim(invoice_number, E' \t\n\r\f\v'), ''))
   OR (credit_note_number IS NOT NULL AND credit_note_number IS DISTINCT FROM NULLIF(pg_catalog.btrim(credit_note_number, E' \t\n\r\f\v'), ''));

-- Fail-closed historical credit_notes inspection BEFORE tightening constraints or reconciling series
DO $$
DECLARE
  v_missing_fields INTEGER;
  v_bad_amounts INTEGER;
  v_orphan_count INTEGER;
  v_over_refund_count INTEGER;
BEGIN
  -- Normalize non-null whitespace cleanly (without inventing values for NULL/blank cells)
  UPDATE public.credit_notes
  SET payment_id = pg_catalog.btrim(payment_id, E' \t\n\r\f\v'),
      refund_id = pg_catalog.btrim(refund_id, E' \t\n\r\f\v'),
      credit_note_number = pg_catalog.btrim(credit_note_number, E' \t\n\r\f\v'),
      original_invoice_number = pg_catalog.btrim(original_invoice_number, E' \t\n\r\f\v'),
      currency = UPPER(pg_catalog.btrim(currency, E' \t\n\r\f\v'))
  WHERE (payment_id IS NOT NULL AND payment_id IS DISTINCT FROM pg_catalog.btrim(payment_id, E' \t\n\r\f\v'))
     OR (refund_id IS NOT NULL AND refund_id IS DISTINCT FROM pg_catalog.btrim(refund_id, E' \t\n\r\f\v'))
     OR (credit_note_number IS NOT NULL AND credit_note_number IS DISTINCT FROM pg_catalog.btrim(credit_note_number, E' \t\n\r\f\v'))
     OR (original_invoice_number IS NOT NULL AND original_invoice_number IS DISTINCT FROM pg_catalog.btrim(original_invoice_number, E' \t\n\r\f\v'))
     OR (currency IS NOT NULL AND currency IS DISTINCT FROM UPPER(pg_catalog.btrim(currency, E' \t\n\r\f\v')));

  -- 1. Halt if ANY historical row lacks payment_id, refund_id, credit_note_number, original_invoice_number, or currency
  SELECT COUNT(*) INTO v_missing_fields
  FROM public.credit_notes
  WHERE payment_id IS NULL OR payment_id = ''
     OR refund_id IS NULL OR refund_id = ''
     OR credit_note_number IS NULL OR credit_note_number = ''
     OR original_invoice_number IS NULL OR original_invoice_number = ''
     OR currency IS NULL OR currency = '';

  IF v_missing_fields > 0 THEN
    RAISE EXCEPTION 'Migration halt (fail-closed historical audit): Found % public.credit_notes row(s) with NULL or blank payment_id, refund_id, credit_note_number, original_invoice_number, or currency. Reconcile manually without inventing values.', v_missing_fields;
  END IF;

  -- 2. Halt if ANY historical row has missing, non-positive, NaN, or >2-decimal amount/tax/base
  SELECT COUNT(*) INTO v_bad_amounts
  FROM public.credit_notes
  WHERE amount IS NULL OR amount = 'NaN'::NUMERIC OR amount <= 0 OR pg_catalog.round(amount, 2) IS DISTINCT FROM amount
     OR base_amount IS NULL OR base_amount = 'NaN'::NUMERIC OR base_amount < 0 OR pg_catalog.round(base_amount, 2) IS DISTINCT FROM base_amount
     OR tax_amount IS NULL OR tax_amount = 'NaN'::NUMERIC OR tax_amount < 0 OR pg_catalog.round(tax_amount, 2) IS DISTINCT FROM tax_amount;

  IF v_bad_amounts > 0 THEN
    RAISE EXCEPTION 'Migration halt (fail-closed historical audit): Found % public.credit_notes row(s) with missing or invalid amount/base_amount/tax_amount.', v_bad_amounts;
  END IF;

  -- 3. Halt if ANY historical credit note cannot be unambiguously associated with 1 public.payments row
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.credit_notes cn
  WHERE (
    SELECT COUNT(*)
    FROM public.payments p
    WHERE pg_catalog.btrim(COALESCE(p.razorpay_payment_id, ''), E' \t\n\r\f\v') = cn.payment_id
       OR p.id::TEXT = cn.payment_id
  ) <> 1;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration halt (fail-closed historical audit): Found % orphan or ambiguously linked public.credit_notes row(s) that cannot be mapped 1-to-1 to public.payments.', v_orphan_count;
  END IF;

  -- 4. Halt if cumulative historical credit notes on any payment exceed payment amount or have currency mismatch
  SELECT COUNT(*) INTO v_over_refund_count
  FROM (
    SELECT p.id
    FROM public.payments p
    JOIN public.credit_notes cn
      ON pg_catalog.btrim(COALESCE(p.razorpay_payment_id, ''), E' \t\n\r\f\v') = cn.payment_id
      OR p.id::TEXT = cn.payment_id
    GROUP BY p.id, p.amount, p.currency
    HAVING p.amount IS NULL
        OR p.amount <= 0
        OR SUM(cn.amount) > p.amount
        OR BOOL_OR(UPPER(pg_catalog.btrim(COALESCE(p.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM cn.currency)
  ) bad_hist;

  IF v_over_refund_count > 0 THEN
    RAISE EXCEPTION 'Migration halt (fail-closed historical audit): Found % payment(s) whose historical credit_notes exceed payment amount or mismatch currency.', v_over_refund_count;
  END IF;

  -- Clean historical rows confirmed: enforce NOT NULL on pre-existing legacy credit_notes columns
  ALTER TABLE public.credit_notes
    ALTER COLUMN credit_note_number SET NOT NULL,
    ALTER COLUMN original_invoice_number SET NOT NULL,
    ALTER COLUMN payment_id SET NOT NULL,
    ALTER COLUMN refund_id SET NOT NULL,
    ALTER COLUMN amount SET NOT NULL,
    ALTER COLUMN base_amount SET NOT NULL,
    ALTER COLUMN tax_amount SET NOT NULL,
    ALTER COLUMN currency SET NOT NULL;
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
      VALUES (r.fy, r.max_seq, pg_catalog.now())
      ON CONFLICT (financial_year)
      DO UPDATE SET
        last_sequence = GREATEST(public.invoice_series.last_sequence, r.max_seq),
        updated_at = pg_catalog.now();
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
      VALUES (r.fy, r.max_seq, pg_catalog.now())
      ON CONFLICT (financial_year)
      DO UPDATE SET
        last_sequence = GREATEST(public.credit_note_series.last_sequence, r.max_seq),
        updated_at = pg_catalog.now();
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 7. BACKFILL, CONFLICT DEDUPLICATION & PRE-PHASE-B DUPLICATE CHECKS
-- ==============================================================================

-- A. Profiles Student ID Deduplication: Earliest profile retains ID; duplicates re-assigned
DO $$
DECLARE
  dup RECORD;
  dup_row RECORD;
BEGIN
  FOR dup IN
    SELECT student_id, COUNT(*) AS cnt
    FROM public.profiles
    WHERE student_id IS NOT NULL AND pg_catalog.btrim(student_id, E' \t\n\r\f\v') != ''
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
  FOR r IN SELECT id FROM public.profiles WHERE student_id IS NULL OR pg_catalog.btrim(student_id, E' \t\n\r\f\v') = '' ORDER BY created_at ASC NULLS LAST, id ASC LOOP
    UPDATE public.profiles SET student_id = public.generate_student_id() WHERE id = r.id;
  END LOOP;
END $$;

-- Defer to Phase B (20261107000002_concurrent_indexes.sql):
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id is executed concurrently in 20261107000002_concurrent_indexes.sql

-- C. Course Enrollments Enrolment ID Deduplication
DO $$
DECLARE
  dup RECORD;
  dup_row RECORD;
BEGIN
  FOR dup IN
    SELECT enrollment_id, COUNT(*) AS cnt
    FROM public.course_enrollments
    WHERE enrollment_id IS NOT NULL AND pg_catalog.btrim(enrollment_id, E' \t\n\r\f\v') != ''
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
  FOR r IN SELECT id FROM public.course_enrollments WHERE enrollment_id IS NULL OR pg_catalog.btrim(enrollment_id, E' \t\n\r\f\v') = '' ORDER BY created_at ASC NULLS LAST, id ASC LOOP
    UPDATE public.course_enrollments SET enrollment_id = public.generate_enrollment_id() WHERE id = r.id;
  END LOOP;
END $$;

-- Defer to Phase B: CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enrollments_enrollment_id

-- E. Payments Invoice Number Backfill (captured/paid/completed only; never overwrites existing numbers)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM public.payments
    WHERE status IN ('captured', 'paid', 'completed')
      AND (invoice_number IS NULL OR pg_catalog.btrim(invoice_number, E' \t\n\r\f\v') = '')
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    UPDATE public.payments
    SET invoice_number = public.get_next_invoice_number(r.created_at)
    WHERE id = r.id AND (invoice_number IS NULL OR pg_catalog.btrim(invoice_number, E' \t\n\r\f\v') = '');
  END LOOP;
END $$;

-- F. Pre-Phase-B Financial Duplicate Safety Check
DO $$
DECLARE
  v_dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT invoice_number FROM public.payments
    WHERE invoice_number IS NOT NULL AND pg_catalog.btrim(invoice_number, E' \t\n\r\f\v') != ''
    GROUP BY invoice_number HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate payments.invoice_number value(s).', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT credit_note_number FROM public.payments
    WHERE credit_note_number IS NOT NULL AND pg_catalog.btrim(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY credit_note_number HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate payments.credit_note_number value(s).', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT credit_note_number FROM public.credit_notes
    WHERE credit_note_number IS NOT NULL AND pg_catalog.btrim(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY credit_note_number HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate credit_notes.credit_note_number value(s).', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT refund_id FROM public.credit_notes
    WHERE refund_id IS NOT NULL AND pg_catalog.btrim(refund_id, E' \t\n\r\f\v') != ''
    GROUP BY refund_id HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Phase A halt: Found % duplicate credit_notes.refund_id value(s).', v_dup_count;
  END IF;
END $$;

-- ==============================================================================
-- 8. INTEGRITY TRIGGERS & TAMPERING GUARDS (SCHEMA-QUALIFIED & PRIVILEGE-SCOPED)
-- IMPORTANT: Triggers CANNOT prove Razorpay gateway capture or HMAC signature validity;
-- they enforce database role-based tampering protection & invoice immutability only.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_student_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.student_id IS NULL OR pg_catalog.btrim(NEW.student_id, E' \t\n\r\f\v') = '' THEN
    NEW.student_id := public.generate_student_id();
  ELSE
    NEW.student_id := pg_catalog.btrim(NEW.student_id, E' \t\n\r\f\v');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_student_id ON public.profiles;
CREATE TRIGGER set_profile_student_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_student_id();

CREATE OR REPLACE FUNCTION public.trigger_set_enrollment_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.enrollment_id IS NULL OR pg_catalog.btrim(NEW.enrollment_id, E' \t\n\r\f\v') = '' THEN
    NEW.enrollment_id := public.generate_enrollment_id();
  ELSE
    NEW.enrollment_id := pg_catalog.btrim(NEW.enrollment_id, E' \t\n\r\f\v');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_enrollment_id ON public.course_enrollments;
CREATE TRIGGER set_enrollment_id
  BEFORE INSERT ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_enrollment_id();

-- Invoice lifecycle enforcement across ALL payment statuses on INSERT and UPDATE:
-- 1. Preserves legitimate historical OLD.invoice_number (blocks client clearing/replacement;
--    restores OLD.invoice_number against accidental backend overwrite).
-- 2. Blocks unprivileged client roles from supplying invoice_number on INSERT.
-- 3. Normalizes NEW.status; rejects unknown statuses; clears forged invoice_number to NULL
--    on non-captured/unpaid/refunded statuses when no prior invoice was issued.
-- 4. NOTE: Does NOT verify Razorpay capture; only server/paymentRoutes & webhook do so.
CREATE OR REPLACE FUNCTION public.trigger_set_payment_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_norm_status TEXT := LOWER(pg_catalog.btrim(COALESCE(NEW.status, ''), E' \t\n\r\f\v'));
  v_has_old_inv BOOLEAN := (
    TG_OP = 'UPDATE'
    AND OLD.invoice_number IS NOT NULL
    AND pg_catalog.btrim(OLD.invoice_number, E' \t\n\r\f\v') != ''
  );
  v_clean_new_inv TEXT := NULLIF(pg_catalog.btrim(NEW.invoice_number, E' \t\n\r\f\v'), '');
  v_role TEXT := NULLIF(pg_catalog.btrim(COALESCE(auth.role(), ''), E' \t\n\r\f\v'), '');
BEGIN
  -- Canonicalize status on every INSERT/UPDATE so case/whitespace never bypasses checks
  IF v_norm_status NOT IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status %: Outside supported payment lifecycle enum.', NEW.status;
  END IF;
  NEW.status := v_norm_status;

  -- Block unprivileged roles from altering or clearing an issued invoice or spoofing on INSERT
  IF v_role IN ('authenticated', 'anon')
     OR (v_role IS NOT NULL AND v_role NOT IN ('service_role', 'supabase_admin')) THEN
    IF v_has_old_inv AND (v_clean_new_inv IS DISTINCT FROM pg_catalog.btrim(OLD.invoice_number, E' \t\n\r\f\v')) THEN
      RAISE EXCEPTION 'Unauthorized: Issued invoice_number cannot be cleared or replaced by role %.', v_role;
    END IF;
    IF TG_OP = 'INSERT' AND v_clean_new_inv IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized: invoice_number cannot be supplied directly on INSERT by role %.', v_role;
    END IF;
  END IF;

  -- Preserve legitimate historical invoice_number immutably on UPDATE
  IF v_has_old_inv THEN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      NEW.invoice_number := OLD.invoice_number;
    END IF;
  ELSE
    NEW.invoice_number := v_clean_new_inv;
  END IF;

  -- Never mint or retain forged invoice numbers on non-captured/unpaid/refunded statuses
  IF NEW.status IN ('refunded', 'failed', 'cancelled', 'pending') THEN
    IF NOT v_has_old_inv THEN
      NEW.invoice_number := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF v_norm_status IN ('created', 'authorized') THEN
    IF NOT v_has_old_inv THEN
      NEW.invoice_number := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Captured / paid / completed: mint if no invoice exists yet
  IF (v_norm_status IN ('captured', 'paid', 'completed'))
     AND (NEW.invoice_number IS NULL OR pg_catalog.btrim(NEW.invoice_number, E' \t\n\r\f\v') = '') THEN
    NEW.invoice_number := public.get_next_invoice_number(COALESCE(NEW.created_at, pg_catalog.now()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_payment_invoice_number ON public.payments;
CREATE TRIGGER set_payment_invoice_number
  BEFORE INSERT OR UPDATE OF status, invoice_number ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_payment_invoice();

-- Role-based status tampering guard ONLY (does NOT verify Razorpay capture or HMAC signatures)
CREATE OR REPLACE FUNCTION public.protect_payment_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_status TEXT := LOWER(pg_catalog.btrim(COALESCE(NEW.status, ''), E' \t\n\r\f\v'));
  v_old_status TEXT := LOWER(pg_catalog.btrim(COALESCE(OLD.status, ''), E' \t\n\r\f\v'));
  v_role TEXT := NULLIF(pg_catalog.btrim(COALESCE(auth.role(), ''), E' \t\n\r\f\v'), '');
BEGIN
  IF v_new_status IN ('captured', 'paid', 'completed', 'refunded') THEN
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
      IF auth.role() IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'Unauthorized: Status % cannot be set directly by client roles. Server-side payment/webhook handler required.', NEW.status;
      END IF;
      IF v_role IS NOT NULL AND v_role NOT IN ('service_role', 'supabase_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Status % cannot be set by unprivileged JWT role %.', NEW.status, v_role;
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

-- Revoke direct execute permissions on trigger functions from client/public roles
REVOKE ALL ON FUNCTION public.trigger_set_student_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_set_enrollment_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_set_payment_invoice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_payment_status_transitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_set_student_id() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.trigger_set_enrollment_id() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.trigger_set_payment_invoice() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.protect_payment_status_transitions() TO postgres, service_role;

-- Ensure explicit postgres function ownership when role postgres exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.generate_student_id() OWNER TO postgres;
    ALTER FUNCTION public.generate_enrollment_id() OWNER TO postgres;
    ALTER FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) OWNER TO postgres;
    ALTER FUNCTION public.get_next_credit_note_number(TIMESTAMPTZ) OWNER TO postgres;
    ALTER FUNCTION public.record_credit_note_with_limit(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ) OWNER TO postgres;
    ALTER FUNCTION public.trigger_set_student_id() OWNER TO postgres;
    ALTER FUNCTION public.trigger_set_enrollment_id() OWNER TO postgres;
    ALTER FUNCTION public.trigger_set_payment_invoice() OWNER TO postgres;
    ALTER FUNCTION public.protect_payment_status_transitions() OWNER TO postgres;
  END IF;
END $$;

COMMIT;

-- ==============================================================================
-- 9. ACCURATE LOCKING, DEPLOYMENT SEQUENCING & ROLLBACK DISCLOSURE
-- ==============================================================================
-- A. AccessExclusiveLock Operations in Phase A (NOT zero-downtime):
--    1. ALTER TABLE ... ADD COLUMN / ALTER COLUMN / DROP CONSTRAINT / ADD CONSTRAINT NOT VALID
--       acquire AccessExclusiveLock on profiles, course_enrollments, payments,
--       resource_purchases, bookings, and credit_notes, held until COMMIT.
--    2. DROP TRIGGER / CREATE TRIGGER acquire AccessExclusiveLock on target tables.
--    3. REVOKE / GRANT / ALTER POLICY acquire table locks until COMMIT.
--
-- B. Potentially Large Table UPDATE Operations Inside Transaction:
--    1. Table-wide normalization UPDATEs on profiles, course_enrollments, payments, and
--       credit_notes lock modified rows and hold prior DDL locks for the full scan duration.
--    2. Row-by-row deduplication and backfill loops on profiles, course_enrollments, and
--       payments (invoice_number) hold row locks and advance sequences across large datasets.
--
-- C. Preventing Concurrent Writes Between Phase A and Phase B Index Validation:
--    1. Application layer: Put checkout, webhook handlers (return HTTP 503 so Razorpay
--       retries cleanly), and admin refund actions into maintenance/write-freeze mode
--       before starting Phase A, and keep writes paused until Phase B passes Section 3.
--    2. Database layer: record_credit_note_with_limit() checks pg_catalog.pg_index for
--       both idx_credit_notes_number and idx_credit_notes_refund_id (indisvalid AND
--       indisready) and fails closed until Phase B finishes validating all 8 indexes.
--
-- D. Irreversible Data Changes Post-COMMIT:
--    - Normalization UPDATEs (BTRIM/lowercasing), dropped legacy constraints, reassigned
--      duplicate student_id/enrollment_id values, backfilled invoice_number values,
--      tightened NOT NULL constraints, and sequence advances (setval) CANNOT be reverted by
--      dropping columns/triggers. Always capture and test-restore a pg_dump backup prior
--      to executing Phase A.
-- ==============================================================================
