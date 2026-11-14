-- ==============================================================================
-- DIGITALMUID UNIFIED STUDENT BILLING & GST TAX INVOICE SYSTEM
-- PHASE B: ZERO-DOWNTIME NON-TRANSACTIONAL CONCURRENT INDEX DEPLOYMENT (V4.3 HARDENED)
-- Migration: 20261107000002_concurrent_indexes.sql
--
-- Compliance & Architecture Guarantees (F-03 Audit Compliance):
-- 1. Non-Transactional Execution: In PostgreSQL, CREATE/DROP INDEX CONCURRENTLY cannot run
--    inside a transaction block. Every CONCURRENTLY statement below is a standalone
--    top-level statement (never wrapped in explicit transactions or DO blocks).
-- 2. Zero-Downtime: Builds all 8 indexes (6 unique partial + 2 lookup) by reading tables
--    without ShareLock or AccessExclusiveLock, permitting uninterrupted live writes.
-- 3. Active Preflight Gate: Validates all 5 unique identifier dimensions (including
--    payments.credit_note_number and control-whitespace BTRIM normalization) and fails fast
--    on any pre-existing invalid/not-ready/mismatched index before IF NOT EXISTS can skip.
-- 4. Active Post-Deployment Validation: Verifies schema (public), uniqueness (indisunique),
--    definition (pg_get_indexdef), indisvalid = true, and indisready = true for all 8 indexes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRE-INDEX DUPLICATE DETECTION AUDIT & CATALOG PREFLIGHT GATE
-- Standalone DO block commits immediately before the concurrent statements below.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_dups INTEGER;
  v_idx RECORD;
  v_spec RECORD;
  v_alias RECORD;
BEGIN
  -- A. Check all 5 unique identifier dimensions across tables using full whitespace BTRIM
  SELECT COUNT(*) INTO v_dups
  FROM (
    SELECT BTRIM(student_id, E' \t\n\r\f\v') AS norm_val
    FROM public.profiles
    WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(student_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'Phase B preflight failed: % duplicate profiles.student_id group(s) detected. Run Phase A normalization/deduplication first.', v_dups;
  END IF;

  SELECT COUNT(*) INTO v_dups
  FROM (
    SELECT BTRIM(enrollment_id, E' \t\n\r\f\v') AS norm_val
    FROM public.course_enrollments
    WHERE enrollment_id IS NOT NULL AND BTRIM(enrollment_id, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(enrollment_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'Phase B preflight failed: % duplicate course_enrollments.enrollment_id group(s) detected. Reconcile before indexing.', v_dups;
  END IF;

  SELECT COUNT(*) INTO v_dups
  FROM (
    SELECT BTRIM(invoice_number, E' \t\n\r\f\v') AS norm_val
    FROM public.payments
    WHERE invoice_number IS NOT NULL AND BTRIM(invoice_number, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(invoice_number, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'Phase B preflight failed: % duplicate payments.invoice_number group(s) detected. Reconcile financial ledger before indexing.', v_dups;
  END IF;

  SELECT COUNT(*) INTO v_dups
  FROM (
    SELECT BTRIM(credit_note_number, E' \t\n\r\f\v') AS norm_val
    FROM public.payments
    WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(credit_note_number, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'Phase B preflight failed: % duplicate payments.credit_note_number group(s) detected. Reconcile financial ledger before indexing.', v_dups;
  END IF;

  SELECT COUNT(*) INTO v_dups
  FROM (
    SELECT BTRIM(credit_note_number, E' \t\n\r\f\v') AS norm_val
    FROM public.credit_notes
    WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(credit_note_number, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'Phase B preflight failed: % duplicate credit_notes.credit_note_number group(s) detected. Reconcile before indexing.', v_dups;
  END IF;

  SELECT COUNT(*) INTO v_dups
  FROM (
    SELECT BTRIM(refund_id, E' \t\n\r\f\v') AS norm_val
    FROM public.credit_notes
    WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(refund_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'Phase B preflight failed: % duplicate credit_notes.refund_id group(s) detected. Reconcile before indexing.', v_dups;
  END IF;

  -- B. Inspect pg_index / pg_class / pg_namespace for invalid, not-ready, wrong-def, or alias indexes
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('idx_credit_notes_number',              'credit_notes',       true,  'credit_note_number', true),
      ('idx_credit_notes_refund_id',           'credit_notes',       true,  'refund_id',          true),
      ('idx_credit_notes_payment_id',          'credit_notes',       false, 'payment_id',         false),
      ('idx_credit_notes_user_id',             'credit_notes',       false, 'user_id',            false),
      ('idx_profiles_student_id',              'profiles',           true,  'student_id',         true),
      ('idx_course_enrollments_enrollment_id', 'course_enrollments', true,  'enrollment_id',      true),
      ('idx_payments_invoice_number',          'payments',           true,  'invoice_number',     true),
      ('idx_payments_credit_note_number',      'payments',           true,  'credit_note_number', true)
    ) AS s(idx_name, tbl_name, expect_unique, col_name, expect_partial)
  LOOP
    SELECT
      c.oid,
      t.relname AS actual_table,
      i.indisvalid,
      i.indisready,
      i.indisunique,
      pg_get_indexdef(c.oid) AS idx_def
    INTO v_idx
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = v_spec.idx_name;

    IF FOUND THEN
      IF NOT v_idx.indisvalid OR NOT v_idx.indisready THEN
        RAISE EXCEPTION 'Phase B preflight failed: Index public.% exists in INVALID/UNREADY state (indisvalid=%, indisready=%). IF NOT EXISTS would skip rebuild. Run DROP INDEX CONCURRENTLY IF EXISTS public.% first.',
          v_spec.idx_name, v_idx.indisvalid, v_idx.indisready, v_spec.idx_name;
      END IF;

      IF v_idx.actual_table IS DISTINCT FROM v_spec.tbl_name
         OR v_idx.indisunique IS DISTINCT FROM v_spec.expect_unique
         OR position('(' || v_spec.col_name || ')' in v_idx.idx_def) = 0
         OR (v_spec.expect_partial AND v_idx.idx_def !~* '\mWHERE\M') THEN
        RAISE EXCEPTION 'Phase B preflight failed: Existing index public.% has mismatched definition (%). Drop with DROP INDEX CONCURRENTLY IF EXISTS public.% before rerunning Phase B.',
          v_spec.idx_name, v_idx.idx_def, v_spec.idx_name;
      END IF;
    ELSE
      -- Check for redundant alias index with a different name covering the same table & column
      SELECT c.relname AS alias_name, pg_get_indexdef(c.oid) AS alias_def
      INTO v_alias
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = v_spec.tbl_name
        AND c.relname <> v_spec.idx_name
        AND i.indisvalid = true
        AND i.indisunique = v_spec.expect_unique
        AND position('(' || v_spec.col_name || ')' in pg_get_indexdef(c.oid)) > 0
      LIMIT 1;

      IF FOUND THEN
        RAISE WARNING 'Phase B preflight notice: Table public.% already has an equivalent alias index public.% (%).',
          v_spec.tbl_name, v_alias.alias_name, v_alias.alias_def;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CONCURRENT UNIQUE INDEX CREATION (Standalone statements outside transactions)
-- ------------------------------------------------------------------------------

-- Credit Notes: Sequential credit note serial number uniqueness (partial guard skips legacy NULL/blank rows)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_number
  ON public.credit_notes (credit_note_number)
  WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != '';

-- Credit Notes: Database-enforced idempotency for refund events (Section 34 CGST Act)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_refund_id
  ON public.credit_notes (refund_id)
  WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != '';

-- Credit Notes: Lookup index by payment_id (solely created here, never in Phase A)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_payment_id
  ON public.credit_notes (payment_id);

-- Credit Notes: Lookup index by user_id (solely created here, never in Phase A)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_user_id
  ON public.credit_notes (user_id);

-- Profiles: Permanent Student ID unique partial index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
  ON public.profiles (student_id)
  WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != '';

-- Course Enrollments: Permanent Enrollment ID unique partial index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_course_enrollments_enrollment_id
  ON public.course_enrollments (enrollment_id)
  WHERE enrollment_id IS NOT NULL AND BTRIM(enrollment_id, E' \t\n\r\f\v') != '';

-- Payments: Permanent Invoice Number unique partial index (GST Rule 46)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_number
  ON public.payments (invoice_number)
  WHERE invoice_number IS NOT NULL AND BTRIM(invoice_number, E' \t\n\r\f\v') != '';

-- Payments: Primary Credit Note Number unique partial index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_credit_note_number
  ON public.payments (credit_note_number)
  WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != '';

-- ------------------------------------------------------------------------------
-- 3. POST-DEPLOYMENT INDEX VALIDATION QUERY (SEC-06 Compliance)
-- Verifies schema (public), indisvalid = true, indisready = true, indisunique,
-- and canonical pg_get_indexdef for all 8 indexes. Fails loudly if any defect exists.
-- ------------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS index_name,
  t.relname AS table_name,
  i.indisvalid AS is_valid,
  i.indisready AS is_ready,
  i.indisunique AS is_unique,
  pg_get_indexdef(c.oid) AS index_definition
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'idx_credit_notes_number',
    'idx_credit_notes_refund_id',
    'idx_credit_notes_payment_id',
    'idx_credit_notes_user_id',
    'idx_profiles_student_id',
    'idx_course_enrollments_enrollment_id',
    'idx_payments_invoice_number',
    'idx_payments_credit_note_number'
  )
ORDER BY table_name, index_name;

DO $$
DECLARE
  v_spec RECORD;
  v_row RECORD;
  v_verified INTEGER := 0;
BEGIN
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('idx_credit_notes_number',              'credit_notes',       true,  'credit_note_number', true),
      ('idx_credit_notes_refund_id',           'credit_notes',       true,  'refund_id',          true),
      ('idx_credit_notes_payment_id',          'credit_notes',       false, 'payment_id',         false),
      ('idx_credit_notes_user_id',             'credit_notes',       false, 'user_id',            false),
      ('idx_profiles_student_id',              'profiles',           true,  'student_id',         true),
      ('idx_course_enrollments_enrollment_id', 'course_enrollments', true,  'enrollment_id',      true),
      ('idx_payments_invoice_number',          'payments',           true,  'invoice_number',     true),
      ('idx_payments_credit_note_number',      'payments',           true,  'credit_note_number', true)
    ) AS s(idx_name, tbl_name, expect_unique, col_name, expect_partial)
  LOOP
    SELECT
      c.relname AS index_name,
      t.relname AS table_name,
      i.indisvalid AS is_valid,
      i.indisready AS is_ready,
      i.indisunique AS is_unique,
      pg_get_indexdef(c.oid) AS index_def
    INTO v_row
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = v_spec.idx_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Phase B validation failed: Expected index public.% was not created.', v_spec.idx_name;
    END IF;

    IF NOT v_row.is_valid OR NOT v_row.is_ready THEN
      RAISE EXCEPTION 'Phase B validation failed: Index public.% is not valid/ready (indisvalid=%, indisready=%). Execute Section 4 recovery.',
        v_spec.idx_name, v_row.is_valid, v_row.is_ready;
    END IF;

    IF v_row.table_name IS DISTINCT FROM v_spec.tbl_name
       OR v_row.is_unique IS DISTINCT FROM v_spec.expect_unique
       OR position('(' || v_spec.col_name || ')' in v_row.index_def) = 0
       OR (v_spec.expect_partial AND v_row.index_def !~* '\mWHERE\M') THEN
      RAISE EXCEPTION 'Phase B validation failed: Index public.% definition mismatch (%).', v_spec.idx_name, v_row.index_def;
    END IF;

    v_verified := v_verified + 1;
  END LOOP;

  IF v_verified <> 8 THEN
    RAISE EXCEPTION 'Phase B validation failed: Verified %/8 expected indexes.', v_verified;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. INVALID INDEX DETECTION, RECOVERY & ROLLBACK PROCEDURES (SEC-06 Compliance)
-- If a concurrent index build is interrupted by a network timeout, cancellation,
-- or transient deadlock, PostgreSQL leaves an invalid index catalog entry marked
-- with indisvalid = false. Run the cleanup commands below outside any transaction.
--
-- STEP 1: DETECT INVALID INDEXES
-- SELECT
--   c.relname AS invalid_index_name,
--   t.relname AS table_name,
--   pg_size_pretty(pg_relation_size(c.oid)) AS index_size,
--   i.indisvalid,
--   i.indisready,
--   pg_get_indexdef(c.oid) AS index_definition
-- FROM pg_index i
-- JOIN pg_class c ON c.oid = i.indexrelid
-- JOIN pg_class t ON t.oid = i.indrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND (i.indisvalid = false OR i.indisready = false);
--
-- STEP 2: DROP INVALID OR MISCONFIGURED INDEXES CONCURRENTLY (Non-blocking cleanup)
-- Never run DROP INDEX without CONCURRENTLY on live production tables.
--
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_number;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_refund_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_payment_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_user_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_profiles_student_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_course_enrollments_enrollment_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_payments_invoice_number;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_payments_credit_note_number;
--
-- STEP 3: SAFELY RERUN PHASE B
-- Once invalid or mismatched indexes are dropped, re-execute this Phase B script
-- sequentially outside any transaction block.
--
-- STEP 4: RE-VALIDATE (Schema public, indisvalid = true, indisready = true, pg_get_indexdef)
-- Re-run Section 3 validation to confirm all 8 indexes pass catalog inspection.
-- ------------------------------------------------------------------------------
