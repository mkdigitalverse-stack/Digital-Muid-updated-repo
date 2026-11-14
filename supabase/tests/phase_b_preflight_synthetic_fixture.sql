-- ==============================================================================
-- DIGITALMUID V4.3 — PHASE B CONCURRENT INDEX PREFLIGHT SYNTHETIC FIXTURES
-- File: supabase/tests/phase_b_preflight_synthetic_fixture.sql
-- ==============================================================================
-- PURPOSE:
-- Repeatable, isolated synthetic PostgreSQL test harness for Phase B migration:
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

-- 1. ISOLATED SYNTHETIC SCHEMA & TABLES (Transactional setup)
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
  status TEXT NOT NULL DEFAULT 'captured',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phase_b_preflight_test.credit_notes (
  id UUID PRIMARY KEY,
  credit_note_number TEXT,
  payment_id TEXT NOT NULL,
  user_id UUID,
  refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SYNTHETIC EDGE-CASE FIXTURES FOR DUPLICATE & WHITESPACE TESTING
-- Covers: NULL, '', ASCII spaces, tabs/newlines, leading/trailing spaces, case variants

INSERT INTO phase_b_preflight_test.profiles (id, student_id) VALUES
  ('00000000-0000-4000-8000-000000000001', NULL),
  ('00000000-0000-4000-8000-000000000002', NULL),
  ('00000000-0000-4000-8000-000000000003', ''),
  ('00000000-0000-4000-8000-000000000004', '   '),
  ('00000000-0000-4000-8000-000000000005', E'\t\n'),
  ('00000000-0000-4000-8000-000000000006', E'\t\n'),       -- Duplicate control-whitespace!
  ('00000000-0000-4000-8000-000000000007', 'DM-STU-010001'),
  ('00000000-0000-4000-8000-000000000008', ' DM-STU-010001 '); -- Duplicate after TRIM!

INSERT INTO phase_b_preflight_test.course_enrollments (id, enrollment_id) VALUES
  ('10000000-0000-4000-8000-000000000001', NULL),
  ('10000000-0000-4000-8000-000000000002', ''),
  ('10000000-0000-4000-8000-000000000003', '   '),
  ('10000000-0000-4000-8000-000000000004', 'DM-ENR-010001'),
  ('10000000-0000-4000-8000-000000000005', 'DM-ENR-010001 '); -- Trailing space!

INSERT INTO phase_b_preflight_test.payments (id, invoice_number, credit_note_number, status) VALUES
  ('20000000-0000-4000-8000-000000000001', NULL, NULL, 'pending'),
  ('20000000-0000-4000-8000-000000000002', '', '   ', 'failed'),
  ('20000000-0000-4000-8000-000000000003', 'DM/26-27/0001', 'CN/26-27/0001', 'refunded'),
  ('20000000-0000-4000-8000-000000000004', ' DM/26-27/0001', 'CN/26-27/0001', 'refunded'); -- Exact CN dup + trimmed INV dup!

INSERT INTO phase_b_preflight_test.credit_notes (id, credit_note_number, payment_id, user_id, refund_id) VALUES
  ('30000000-0000-4000-8000-000000000001', NULL, 'pay_1', '00000000-0000-4000-8000-000000000007', NULL),
  ('30000000-0000-4000-8000-000000000002', NULL, 'pay_2', '00000000-0000-4000-8000-000000000007', ''),
  ('30000000-0000-4000-8000-000000000003', '', 'pay_3', '00000000-0000-4000-8000-000000000007', '   '),
  ('30000000-0000-4000-8000-000000000004', '', 'pay_4', '00000000-0000-4000-8000-000000000007', 'rfnd_001'), -- Duplicate empty CN string!
  ('30000000-0000-4000-8000-000000000005', 'CN/26-27/0001', 'pay_5', '00000000-0000-4000-8000-000000000007', ' rfnd_001 ');

COMMIT;

-- 3. TASK B VERIFICATION: COMPARE CURRENT AUDIT QUERIES VS HARDENED NORMALIZED AUDIT QUERIES
-- Expected observations:
--   - Current Phase B audit query for profiles (GROUP BY student_id WHERE TRIM(student_id) != '')
--     detects E'\t\n' (2 rows!) only because TRIM strips spaces, NOT tabs/newlines,
--     AND misses 'DM-STU-010001' vs ' DM-STU-010001 '!
--   - Current Phase B audit query for credit_notes.credit_note_number (GROUP BY credit_note_number)
--     flags (NULL, 2) false positive!
--   - Current Phase B omits payments.credit_note_number duplicate check completely!

SELECT 'AUDIT_CURRENT_PROFILES' AS check_name, student_id, COUNT(*) AS cnt
FROM phase_b_preflight_test.profiles
WHERE student_id IS NOT NULL AND TRIM(student_id) != ''
GROUP BY student_id HAVING COUNT(*) > 1;

SELECT 'AUDIT_HARDENED_PROFILES' AS check_name,
       BTRIM(student_id, E' \t\n\r\f\v') AS normalized_id,
       COUNT(*) AS cnt
FROM phase_b_preflight_test.profiles
WHERE student_id IS NOT NULL AND BTRIM(student_id, E' \t\n\r\f\v') != ''
GROUP BY BTRIM(student_id, E' \t\n\r\f\v') HAVING COUNT(*) > 1;

SELECT 'AUDIT_CURRENT_PAYMENTS_CN_MISSING' AS check_name, credit_note_number, COUNT(*) AS cnt
FROM phase_b_preflight_test.payments
WHERE credit_note_number IS NOT NULL AND BTRIM(credit_note_number, E' \t\n\r\f\v') != ''
GROUP BY credit_note_number HAVING COUNT(*) > 1;

-- 4. TASK C VERIFICATION: DEMONSTRATE TRANSACTION RESTRICTION (SQLSTATE 25001)
-- Inside a transaction, CREATE INDEX CONCURRENTLY MUST raise SQLSTATE 25001.
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

-- 5. TASK A + C VERIFICATION (OUTSIDE TRANSACTION):
-- Reconcile synthetic duplicates first so concurrent builds succeed cleanly
DELETE FROM phase_b_preflight_test.profiles
WHERE id IN ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000008');

DELETE FROM phase_b_preflight_test.course_enrollments
WHERE id = '10000000-0000-4000-8000-000000000005';

DELETE FROM phase_b_preflight_test.payments
WHERE id = '20000000-0000-4000-8000-000000000004';

DELETE FROM phase_b_preflight_test.credit_notes
WHERE id IN ('30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000005');

-- 5A. Simulate Scenario A3: Invalid pre-existing index trapped by IF NOT EXISTS
-- First intentionally fail a CONCURRENTLY build or simulate invalid state:
-- Re-insert temporary duplicate, run CREATE UNIQUE INDEX CONCURRENTLY (will fail & leave invalid index):
INSERT INTO phase_b_preflight_test.profiles (id, student_id)
VALUES ('00000000-0000-4000-8000-000000000099', 'DM-STU-010001');

\set ON_ERROR_STOP off
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
  ON phase_b_preflight_test.profiles (student_id)
  WHERE student_id IS NOT NULL AND TRIM(student_id) != '';
\set ON_ERROR_STOP on

-- Verify invalid index now exists in phase_b_preflight_test (indisvalid = false)
SELECT c.relname, i.indisvalid, i.indisready
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'phase_b_preflight_test'
  AND c.relname = 'idx_profiles_student_id';

-- Reconcile duplicate row, then rerun CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS:
-- PostgreSQL skips it with NOTICE and leaves indisvalid = false!
DELETE FROM phase_b_preflight_test.profiles WHERE id = '00000000-0000-4000-8000-000000000099';
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
  ON phase_b_preflight_test.profiles (student_id)
  WHERE student_id IS NOT NULL AND TRIM(student_id) != '';

-- Clean recovery: DROP INDEX CONCURRENTLY IF EXISTS then recreate cleanly
DROP INDEX CONCURRENTLY IF EXISTS phase_b_preflight_test.idx_profiles_student_id;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id
  ON phase_b_preflight_test.profiles (student_id)
  WHERE student_id IS NOT NULL AND TRIM(student_id) != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_number
  ON phase_b_preflight_test.credit_notes (credit_note_number);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_refund_id
  ON phase_b_preflight_test.credit_notes (refund_id)
  WHERE refund_id IS NOT NULL AND TRIM(refund_id) != '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_payment_id
  ON phase_b_preflight_test.credit_notes (payment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_user_id
  ON phase_b_preflight_test.credit_notes (user_id);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_course_enrollments_enrollment_id
  ON phase_b_preflight_test.course_enrollments (enrollment_id)
  WHERE enrollment_id IS NOT NULL AND TRIM(enrollment_id) != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_number
  ON phase_b_preflight_test.payments (invoice_number)
  WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_credit_note_number
  ON phase_b_preflight_test.payments (credit_note_number)
  WHERE credit_note_number IS NOT NULL AND TRIM(credit_note_number) != '';

-- Validate all 8 synthetic indexes have indisvalid = true AND indisready = true
SELECT c.relname AS index_name, t.relname AS table_name, i.indisvalid, i.indisready, i.indisunique
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'phase_b_preflight_test'
ORDER BY t.relname, c.relname;

-- 6. CLEANUP
DROP SCHEMA IF EXISTS phase_b_preflight_test CASCADE;
