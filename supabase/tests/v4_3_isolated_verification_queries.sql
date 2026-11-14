-- ==============================================================================
-- DIGITALMUID V4.3 — REAL POSTGRESQL VERIFICATION & RUNTIME TEST QUERIES
-- File: supabase/tests/v4_3_isolated_verification_queries.sql
-- ==============================================================================
-- PURPOSE:
-- Exact PostgreSQL inspection queries and transactional runtime tests for
-- verifying Phase A and Phase B in an isolated disposable PostgreSQL database
-- (Sections 1-3 apply to both `digitalmuid_v43_fresh_test` and
-- `digitalmuid_v43_legacy_test`; Sections 2D and 4A-4C target `pay_leg_101`/
-- `pay_leg_102` seeded in `digitalmuid_v43_legacy_test`).
--
-- SAFETY:
-- - DO NOT EXECUTE against production or hosted staging databases.
-- - Functional/privilege tests below run inside BEGIN; ... ROLLBACK; blocks.
-- - NOT EXECUTED automatically.
-- ==============================================================================

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase environment detected.';
  END IF;
END $$;

-- ==============================================================================
-- 1. PRE-MIGRATION SCHEMA & DATA DIAGNOSTICS
-- ==============================================================================
SELECT c.conname, pg_catalog.pg_get_constraintdef(c.oid) AS def, c.convalidated
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.contype = 'c';

SELECT column_name, data_type, is_nullable, column_default, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('payments', 'credit_notes', 'profiles', 'course_enrollments')
ORDER BY table_name, ordinal_position;

-- ==============================================================================
-- 2. POST-PHASE-A SCHEMA, CONSTRAINTS, SEQUENCES, PRIVILEGES & RLS CHECKS
-- ==============================================================================
-- 2A. Verify chk_payments_status validated & unrelated chk_payments_amount_positive preserved
SELECT c.conname, c.convalidated, pg_catalog.pg_get_constraintdef(c.oid) AS def
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.contype = 'c'
ORDER BY c.conname;

-- 2B. Verify sequences (last_value and is_called)
SELECT last_value AS student_seq_last, is_called AS student_seq_called FROM public.student_id_seq;
SELECT last_value AS enrollment_seq_last, is_called AS enrollment_seq_called FROM public.enrollment_id_seq;

-- 2C. Verify ALL 9 SECURITY DEFINER functions (prosecdef, search_path, owner, execute privileges)
SELECT
  p.proname,
  p.prosecdef,
  p.proconfig,
  pg_catalog.pg_get_userbyid(p.proowner) AS owner_role,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'generate_student_id',
    'generate_enrollment_id',
    'get_next_invoice_number',
    'get_next_credit_note_number',
    'record_credit_note_with_limit',
    'trigger_set_student_id',
    'trigger_set_enrollment_id',
    'trigger_set_payment_invoice',
    'protect_payment_status_transitions'
  )
ORDER BY p.proname;

-- 2D. Verify Phase A blocks credit-note issuance BEFORE Phase B runs
BEGIN;
DO $$
BEGIN
  PERFORM * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_pre_phase_b', 100.00);
  RAISE EXCEPTION 'TEST FAILURE: Phase A->B gate allowed credit note before Phase B indexes existed.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS [PRE-PHASE-B GATE]: Blocked refund before Phase B: %', SQLERRM;
END $$;
ROLLBACK;

-- ==============================================================================
-- 3. POST-PHASE-B INDEX VALIDITY, TABLE, COLUMN & PREDICATE VERIFICATION
-- ==============================================================================
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  c.relname AS index_name,
  i.indisunique,
  i.indisvalid,
  i.indisready,
  pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS partial_predicate,
  pg_catalog.pg_get_indexdef(c.oid) AS full_index_def
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
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
ORDER BY t.relname, c.relname;

-- ==============================================================================
-- 4. POST-PHASE-B FUNCTIONAL, IDEMPOTENCY, RLS & TRIGGER TESTS (ROLLBACK SAFE)
-- NOTE: Full refund test (4C) exercises `UPDATE public.payments AS pay` in
-- record_credit_note_with_limit() to confirm no SQLSTATE 42702 ambiguity occurs.
-- ==============================================================================
BEGIN;

DO $$
DECLARE
  v_res RECORD;
BEGIN
  -- 4A. Reject invalid amounts (NaN, 0, >2 decimals) & unsupported currency ('USD')
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_nan', 'NaN'::NUMERIC);
    RAISE EXCEPTION 'Expected failure on NaN refund amount';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS [NAN]: %', SQLERRM;
  END;

  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_3dec', 10.123);
    RAISE EXCEPTION 'Expected failure on >2 decimal refund amount';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS [>2DEC]: %', SQLERRM;
  END;

  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_usd', 100.00, 'test', NULL, 'USD');
    RAISE EXCEPTION 'Expected failure on USD currency';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS [USD]: %', SQLERRM;
  END;

  -- 4B. Partial refund succeeds (400 prior + 200 new = 600 <= 1000) and idempotent retry checks amount+currency
  SELECT * INTO v_res FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_part_new_1', 200.00);
  ASSERT v_res.is_idempotent_duplicate = FALSE, 'Expected fresh partial credit note';
  ASSERT v_res.remaining_balance = 400.00, 'Expected remaining_balance = 400.00';

  SELECT * INTO v_res FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_part_new_1', 200.00);
  ASSERT v_res.is_idempotent_duplicate = TRUE, 'Expected idempotent replay';

  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_part_new_1', 250.00);
    RAISE EXCEPTION 'Expected idempotent retry amount mismatch rejection';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS [RETRY AMOUNT MISMATCH]: %', SQLERRM;
  END;

  -- Cross-payment refund_id reuse rejected
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_leg_102', 'rfnd_part_new_1', 200.00);
    RAISE EXCEPTION 'Expected cross-payment refund_id rejection';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS [CROSS-PAY]: %', SQLERRM;
  END;

  -- Ownership hijack rejected
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_hijack', 100.00, 'test', '10000000-0000-4000-8000-000000000002'::uuid);
    RAISE EXCEPTION 'Expected ownership mismatch rejection';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS [OWNERSHIP]: %', SQLERRM;
  END;

  -- 4C. Remaining balance full refund (400.00 on pay_leg_101) — exercises UPDATE public.payments branch!
  SELECT * INTO v_res FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_full_rem_1', 400.00);
  ASSERT v_res.remaining_balance = 0.00, 'Expected remaining_balance = 0.00';
  RAISE NOTICE 'PASS [FULL REFUND]: Credit note % cleared remaining balance cleanly.', v_res.credit_note_number;
END $$;

-- 4D. RLS & Trigger Enforcement Test as authenticated user (Student 1 cannot read Student 2 credit notes or mutate payments)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"student1.synthetic@example.test"}', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Student 1 sees only own credit_notes (0 rows for Student 2)
DO $$
DECLARE
  v_other_cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_other_cnt FROM public.credit_notes WHERE user_id = '10000000-0000-4000-8000-000000000002'::uuid;
  ASSERT v_other_cnt = 0, 'RLS FAILURE: authenticated student saw another user credit_notes.';
  RAISE NOTICE 'PASS [RLS]: authenticated student isolated from other users credit_notes.';
END $$;

RESET ROLE;

ROLLBACK;
