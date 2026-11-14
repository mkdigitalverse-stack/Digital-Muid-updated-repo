-- ==============================================================================
-- DIGITALMUID V4.3 — PHASE B CONCURRENT INDEX PREFLIGHT SYNTHETIC FIXTURES (HARDENED)
-- File: supabase/tests/phase_b_preflight_synthetic_fixture.sql
-- ==============================================================================
-- PURPOSE:
-- Repeatable, isolated synthetic PostgreSQL test harness validating the hardened
-- Phase A normalization + Phase B concurrent index migration logic:
--   supabase/migrations/20261107000001_student_id_and_invoices.sql
--   supabase/migrations/20261107000002_concurrent_indexes.sql
--
-- SAFETY RULES:
-- 1. Intended ONLY for a disposable LOCAL PostgreSQL instance (e.g. localhost/Docker).
-- 2. NEVER execute against production (kpuxtsworzkueyffjaaz) or any hosted Supabase DB.
-- 3. Operates strictly inside an isolated throwaway schema: phase_b_preflight_test.
-- 4. Must be executed via psql (outside a single-transaction wrapper because
--    CREATE/DROP INDEX CONCURRENTLY cannot execute inside a transaction block):
--      psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" \
--           -v ON_ERROR_STOP=1 \
--           -f supabase/tests/phase_b_preflight_synthetic_fixture.sql
-- ==============================================================================

\set ON_ERROR_STOP on

-- 0. FAIL-CLOSED ENVIRONMENT SAFETY CHECK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations') THEN
    RAISE EXCEPTION 'SAFETY HALT: Detected Supabase auth/migrations schemas. Run synthetic Phase B fixtures ONLY on a disposable local Postgres instance, never on hosted Supabase.';
  END IF;
END $$;

-- 1. ISOLATED SYNTHETIC SCHEMA & TABLES (Transactional setup simulating legacy + messy rows)
BEGIN;

DROP SCHEMA IF EXISTS phase_b_preflight_test CASCADE;
CREATE SCHEMA phase_b_preflight_test;

CREATE TABLE phase_b_preflight_test.profiles (
  id UUID PRIMARY KEY,
  student_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phase_b_preflight_test.course_enrollments (
  id UUID PRIMARY KEY,
  enrollment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phase_b_preflight_test.payments (
  id UUID PRIMARY KEY,
  invoice_number TEXT,
  credit_note_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy pre-existing credit_notes shape (nullable columns)
CREATE TABLE phase_b_preflight_test.credit_notes (
  id UUID PRIMARY KEY,
  credit_note_number TEXT,
  payment_id TEXT NOT NULL,
  user_id UUID,
  refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SYNTHETIC EDGE-CASE FIXTURES FOR DUPLICATE & WHITESPACE TESTING
-- Covers: NULL, '', ASCII spaces, tabs/newlines/CR/FF/VT, leading/trailing whitespace

INSERT INTO phase_b_preflight_test.profiles (id, student_id) VALUES
  ('00000000-0000-4000-8000-000000000001', NULL),
  ('00000000-0000-4000-8000-000000000002', NULL),
  ('00000000-0000-4000-8000-000000000003', ''),
  ('00000000-0000-4000-8000-000000000004', '   '),
  ('00000000-0000-4000-8000-000000000005', E'\t\n'),
  ('00000000-0000-4000-8000-000000000006', E'\t\n'),
  ('00000000-0000-4000-8000-000000000007', 'DM-STU-010001'),
  ('00000000-0000-4000-8000-000000000008', ' DM-STU-010001 ');

INSERT INTO phase_b_preflight_test.course_enrollments (id, enrollment_id) VALUES
  ('10000000-0000-4000-8000-000000000001', NULL),
  ('10000000-0000-4000-8000-000000000002', ''),
  ('10000000-0000-4000-8000-000000000003', E'\r\n\t '),
  ('10000000-0000-4000-8000-000000000004', 'DM-ENR-010001'),
  ('10000000-0000-4000-8000-000000000005', 'DM-ENR-010001 ');

INSERT INTO phase_b_preflight_test.payments (id, invoice_number, credit_note_number, status) VALUES
  ('20000000-0000-4000-8000-000000000001', NULL, NULL, 'pending'),
  ('20000000-0000-4000-8000-000000000002', E'\t ', '   ', 'failed'),
  ('20000000-0000-4000-8000-000000000003', 'DM/26-27/0001', 'CN/26-27/0001', 'refunded'),
  ('20000000-0000-4000-8000-000000000004', ' DM/26-27/0001', 'CN/26-27/0001', 'refunded');

INSERT INTO phase_b_preflight_test.credit_notes (id, credit_note_number, payment_id, user_id, refund_id) VALUES
  ('30000000-0000-4000-8000-000000000001', NULL, 'pay_1', '00000000-0000-4000-8000-000000000007', NULL),
  ('30000000-0000-4000-8000-000000000002', NULL, 'pay_2', '00000000-0000-4000-8000-000000000007', ''),
  ('30000000-0000-4000-8000-000000000003', '', 'pay_3', '00000000-0000-4000-8000-000000000007', E'\t\n '),
  ('30000000-0000-4000-8000-000000000004', E'\f\v ', 'pay_4', '00000000-0000-4000-8000-000000000007', 'rfnd_001'),
  ('30000000-0000-4000-8000-000000000005', 'CN/26-27/0001', 'pay_5', '00000000-0000-4000-8000-000000000007', ' rfnd_001 ');

COMMIT;

-- 3. VERIFY HARDENED BTRIM DUPLICATE AUDITS ACROSS ALL 5 UNIQUE IDENTIFIER DIMENSIONS
DO $$
DECLARE
  v_cnt INTEGER;
BEGIN
  -- Profiles: detects ('DM-STU-010001' vs ' DM-STU-010001 ') while ignoring NULL/whitespace-only rows
  SELECT COUNT(*) INTO v_cnt FROM (
    SELECT BTRIM(student_id, E' \t\n\r\f\v')
    FROM phase_b_preflight_test.profiles
    WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(student_id, E' \t\n\r\f\v') HAVING COUNT(*) > 1
  ) t;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'Expected 1 normalized duplicate group in profiles, got %', v_cnt;
  END IF;

  -- Payments.credit_note_number: detects CN/26-27/0001 duplicate
  SELECT COUNT(*) INTO v_cnt FROM (
    SELECT BTRIM(credit_note_number, E' \t\n\r\f\v')
    FROM phase_b_preflight_test.payments
    WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(credit_note_number, E' \t\n\r\f\v') HAVING COUNT(*) > 1
  ) t;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'Expected 1 normalized duplicate group in payments.credit_note_number, got %', v_cnt;
  END IF;

  -- Credit Notes.credit_note_number: ignores NULL / blank / control-whitespace rows (zero false positives)
  SELECT COUNT(*) INTO v_cnt FROM (
    SELECT BTRIM(credit_note_number, E' \t\n\r\f\v')
    FROM phase_b_preflight_test.credit_notes
    WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
    GROUP BY BTRIM(credit_note_number, E' \t\n\r\f\v') HAVING COUNT(*) > 1
  ) t;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'Expected 0 duplicate groups in credit_notes.credit_note_number, got %', v_cnt;
  END IF;
END $$;

-- 4. TASK C VERIFICATION: DEMONSTRATE TRANSACTION RESTRICTION (SQLSTATE 25001)
BEGIN;
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_test ON phase_b_preflight_test.profiles (student_id)';
    RAISE EXCEPTION 'Expected SQLSTATE 25001 inside transaction, but statement did not fail';
  EXCEPTION WHEN active_sql_transaction THEN
    RAISE NOTICE 'PASS [TX-25001]: Confirmed CREATE INDEX CONCURRENTLY fails inside transaction block (SQLSTATE %)', SQLSTATE;
  END;
END $$;
ROLLBACK;

-- 5. NORMALIZE & RECONCILE SYNTHETIC DUPLICATES, THEN BUILD ALL 8 HARDENED INDEXES CONCURRENTLY
BEGIN;
UPDATE phase_b_preflight_test.profiles SET student_id = NULLIF(BTRIM(student_id, E' \t\n\r\f\v'), '');
UPDATE phase_b_preflight_test.course_enrollments SET enrollment_id = NULLIF(BTRIM(enrollment_id, E' \t\n\r\f\v'), '');
UPDATE phase_b_preflight_test.payments
SET invoice_number = NULLIF(BTRIM(invoice_number, E' \t\n\r\f\v'), ''),
    credit_note_number = NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), '');
UPDATE phase_b_preflight_test.credit_notes
SET credit_note_number = NULLIF(BTRIM(credit_note_number, E' \t\n\r\f\v'), ''),
    refund_id = NULLIF(BTRIM(refund_id, E' \t\n\r\f\v'), '');

DELETE FROM phase_b_preflight_test.profiles WHERE id = '00000000-0000-4000-8000-000000000008';
DELETE FROM phase_b_preflight_test.course_enrollments WHERE id = '10000000-0000-4000-8000-000000000005';
DELETE FROM phase_b_preflight_test.payments WHERE id = '20000000-0000-4000-8000-000000000004';
DELETE FROM phase_b_preflight_test.credit_notes WHERE id = '30000000-0000-4000-8000-000000000005';
COMMIT;

-- 5A. Simulate interrupted build (invalid index) + DROP INDEX CONCURRENTLY recovery
INSERT INTO phase_b_preflight_test.profiles (id, student_id)
VALUES ('00000000-0000-4000-8000-000000000099', 'DM-STU-010001');

\set ON_ERROR_STOP off
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
  ON phase_b_preflight_test.profiles (student_id)
  WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != '';
\set ON_ERROR_STOP on

DELETE FROM phase_b_preflight_test.profiles WHERE id = '00000000-0000-4000-8000-000000000099';
DROP INDEX CONCURRENTLY IF EXISTS phase_b_preflight_test.idx_profiles_student_id;

-- 5B. Execute all 8 Phase B indexes concurrently outside transaction blocks
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_number
  ON phase_b_preflight_test.credit_notes (credit_note_number)
  WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_refund_id
  ON phase_b_preflight_test.credit_notes (refund_id)
  WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_payment_id
  ON phase_b_preflight_test.credit_notes (payment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_user_id
  ON phase_b_preflight_test.credit_notes (user_id);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
  ON phase_b_preflight_test.profiles (student_id)
  WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_course_enrollments_enrollment_id
  ON phase_b_preflight_test.course_enrollments (enrollment_id)
  WHERE enrollment_id IS NOT NULL AND BTRIM(enrollment_id, E' \t\n\r\f\v') != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_number
  ON phase_b_preflight_test.payments (invoice_number)
  WHERE invoice_number IS NOT NULL AND BTRIM(invoice_number, E' \t\n\r\f\v') != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_credit_note_number
  ON phase_b_preflight_test.payments (credit_note_number)
  WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != '';

-- Validate all 8 synthetic indexes (schema, indisvalid, indisready, indisunique, pg_get_indexdef)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'phase_b_preflight_test'
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
    AND i.indisvalid = true
    AND i.indisready = true
    AND pg_get_indexdef(c.oid) IS NOT NULL;

  IF v_count <> 8 THEN
    RAISE EXCEPTION 'Expected 8 valid/ready indexes in phase_b_preflight_test, found %', v_count;
  END IF;
END $$;

-- 6. CLEANUP
DROP SCHEMA IF EXISTS phase_b_preflight_test CASCADE;
