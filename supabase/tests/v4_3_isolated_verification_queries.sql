-- ==============================================================================
-- DIGITALMUID V4.3 — ISOLATED POSTGRESQL VERIFICATION & RUNTIME TEST SUITE
-- File: supabase/tests/v4_3_isolated_verification_queries.sql
-- ==============================================================================
-- PURPOSE:
-- Fail-closed PostgreSQL inspection queries and transactional runtime tests for
-- verifying Phase A (20261107000001_student_id_and_invoices.sql) and Phase B
-- (20261107000002_concurrent_indexes.sql) inside a DISPOSABLE, ISOLATED local
-- PostgreSQL database (`digitalmuid_v43_fresh_test` OR `digitalmuid_v43_legacy_test`).
--
-- EXECUTION STAGES (Required psql variable: -v verify_stage=pre_a|post_a|post_b):
--   pre_a  -> Section 0 + Section 1 (Pre-migration constraints, schema & fixtures)
--   post_a -> Section 0 + Section 2 (Post-Phase-A, BEFORE Phase B: constraints,
--             sequences, 9 SECURITY DEFINER signatures/ACLs, Pre-Phase-B gate)
--   post_b -> Section 0 + Section 3 + Section 4 (Post-Phase-B: 8 indexes exact
--             catalog checks, fixture balance assertions, partial/full refunds,
--             idempotency, ownership, RLS, SQL grants, and payment triggers)
--
-- CRITICAL SAFETY WARNINGS:
-- 1. Execute ONLY against a disposable isolated local PostgreSQL database named
--    `digitalmuid_v43_fresh_test` or `digitalmuid_v43_legacy_test`.
-- 2. NEVER connect to or execute against production, staging, or any other
--    hosted Supabase project (including kpuxtsworzkueyffjaaz).
-- 3. Database-name, schema, role, and network checks below are defense-in-depth
--    ONLY and DO NOT BY THEMSELVES GUARANTEE SAFETY. Always verify target host,
--    port, and PGDATABASE/connection URI before invoking psql.
-- 4. NEVER apply fresh and legacy fixtures to the same database.
-- 5. Single-session SQL CANNOT test true concurrent locking/races; Section 5
--    provides the mandatory two-session concurrency test plan.
-- 6. NOT EXECUTED automatically.
-- ==============================================================================

\set ON_ERROR_STOP on

\if :{?verify_stage}
\else
  DO $$
  BEGIN
    RAISE EXCEPTION 'USAGE ERROR: Missing required -v verify_stage=pre_a | post_a | post_b';
  END $$;
\endif

SELECT pg_catalog.set_config('digitalmuid.verify_stage', :'verify_stage', false) AS configured_verify_stage;

-- ==============================================================================
-- 0. DATABASE IDENTITY & ENVIRONMENT SAFEGUARDS (Runs on every stage)
-- NOTE: Defense-in-depth only; does NOT replace operator verification of psql URI.
-- ==============================================================================
DO $$
DECLARE
  v_db_name TEXT := current_database();
  v_cur_user TEXT := current_user;
  v_sess_user TEXT := session_user;
  v_srv_addr INET := inet_server_addr();
  v_srv_port INTEGER := inet_server_port();
  v_cluster TEXT := COALESCE(NULLIF(current_setting('cluster_name', true), ''), '<unset>');
  v_stage TEXT := pg_catalog.current_setting('digitalmuid.verify_stage', true);
BEGIN
  IF v_stage IS NULL OR v_stage NOT IN ('pre_a', 'post_a', 'post_b') THEN
    RAISE EXCEPTION 'USAGE ERROR: Invalid verify_stage=%. Expected pre_a, post_a, or post_b.', COALESCE(v_stage, '<null>');
  END IF;

  -- 0A. Require explicit disposable test database name (rejects Supabase default 'postgres' DB)
  IF v_db_name NOT IN ('digitalmuid_v43_fresh_test', 'digitalmuid_v43_legacy_test') THEN
    RAISE EXCEPTION 'SAFETY HALT: Refusing execution on database "%". Allowed isolated test databases: digitalmuid_v43_fresh_test, digitalmuid_v43_legacy_test.', v_db_name;
  END IF;

  -- 0B. Reject known hosted Supabase namespaces, roles, or project identifiers
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'supabase_migrations')
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname IN ('supabase_auth_admin', 'supabase_storage_admin', 'supabase_realtime_admin', 'authenticator', 'pgbouncer')
     )
     OR v_db_name ~* 'kpuxtsworzkueyffjaaz'
     OR v_cur_user ~* 'kpuxtsworzkueyffjaaz'
     OR v_sess_user ~* 'kpuxtsworzkueyffjaaz'
     OR v_cluster ~* 'supabase|kpuxtsworzkueyffjaaz' THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase environment or forbidden project reference detected (db=%, user=%, cluster=%).', v_db_name, v_cur_user, v_cluster;
  END IF;

  -- 0C. Server network identity check: reject public/non-local routable server IPs
  --     (NULL = local Unix socket; loopback / RFC1918 permitted for local Docker/VM Postgres)
  IF v_srv_addr IS NOT NULL
     AND NOT (
       v_srv_addr << '127.0.0.0/8'::inet
       OR v_srv_addr << '::1/128'::inet
       OR v_srv_addr << '10.0.0.0/8'::inet
       OR v_srv_addr << '172.16.0.0/12'::inet
       OR v_srv_addr << '192.168.0.0/16'::inet
     ) THEN
    RAISE EXCEPTION 'SAFETY HALT: Non-local server IP %:% rejected for isolated verification.', v_srv_addr, v_srv_port;
  END IF;

  -- 0D. Verify current database user has sufficient privilege (and is not anon/authenticated)
  IF v_cur_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'SAFETY HALT: Run verification as disposable local superuser/postgres role, not "%".', v_cur_user;
  END IF;

  RAISE NOTICE 'ISOLATED ENV CHECK: db=%, stage=%, current_user=%, session_user=%, server=%:%, cluster=% (NOT a standalone safety guarantee).',
    v_db_name, v_stage, v_cur_user, v_sess_user, COALESCE(v_srv_addr::text, 'unix-socket'), COALESCE(v_srv_port::text, 'local'), v_cluster;
END $$;

SELECT
  (pg_catalog.current_setting('digitalmuid.verify_stage', true) = 'pre_a')  AS is_pre_a,
  (pg_catalog.current_setting('digitalmuid.verify_stage', true) = 'post_a') AS is_post_a,
  (pg_catalog.current_setting('digitalmuid.verify_stage', true) = 'post_b') AS is_post_b
\gset

-- ==============================================================================
-- 1. STAGE pre_a — PRE-MIGRATION SCHEMA, CONSTRAINT & SEED DIAGNOSTICS
-- ==============================================================================
\if :is_pre_a

SELECT c.conname, pg_catalog.pg_get_constraintdef(c.oid) AS def, c.convalidated
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.contype = 'c'
ORDER BY c.conname;

SELECT table_name, column_name, data_type, is_nullable, column_default, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('payments', 'credit_notes', 'profiles', 'course_enrollments')
ORDER BY table_name, ordinal_position;

DO $$
BEGIN
  IF current_database() = 'digitalmuid_v43_legacy_test' THEN
    ASSERT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.conname = 'payments_status_check'
    ), 'PRE_A FAILURE: Expected restrictive payments_status_check missing in legacy fixture.';
    ASSERT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.conname = 'chk_payments_amount_positive'
    ), 'PRE_A FAILURE: Expected unrelated chk_payments_amount_positive missing in legacy fixture.';
  END IF;
  RAISE NOTICE 'PASS [PRE_A]: Baseline schema & fixture constraints verified on %.', current_database();
END $$;

\endif

-- ==============================================================================
-- 2. STAGE post_a — POST-PHASE-A (BEFORE PHASE B) CONSTRAINTS, SEQUENCES,
--    9 SECURITY DEFINER SIGNATURES/ACLS & FAIL-CLOSED PRE-PHASE-B GATE
-- ==============================================================================
\if :is_post_a

-- 2A. Verify chk_payments_status validated, legacy payments_status_check removed,
--     and unrelated chk_payments_amount_positive preserved untouched
SELECT c.conname, c.convalidated, pg_catalog.pg_get_constraintdef(c.oid) AS def
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.contype = 'c'
ORDER BY c.conname;

DO $$
DECLARE
  v_chk_valid BOOLEAN;
  v_legacy_cnt INTEGER;
  v_amt_cnt INTEGER;
BEGIN
  SELECT c.convalidated INTO v_chk_valid
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.conname = 'chk_payments_status';

  IF v_chk_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION '2A FAILURE: chk_payments_status missing or not validated (convalidated=%).', v_chk_valid;
  END IF;

  SELECT COUNT(*) INTO v_legacy_cnt
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.conname = 'payments_status_check';

  IF v_legacy_cnt <> 0 THEN
    RAISE EXCEPTION '2A FAILURE: Legacy restrictive constraint payments_status_check was not dropped.';
  END IF;

  IF current_database() = 'digitalmuid_v43_legacy_test' THEN
    SELECT COUNT(*) INTO v_amt_cnt
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'payments' AND c.conname = 'chk_payments_amount_positive';

    IF v_amt_cnt <> 1 THEN
      RAISE EXCEPTION '2A FAILURE: Unrelated chk_payments_amount_positive was unexpectedly dropped.';
    END IF;
  END IF;

  RAISE NOTICE 'PASS [2A]: Payment status constraint migration verified.';
END $$;

-- 2B. Verify sequences (last_value and is_called) without rewinding or collision
SELECT last_value AS student_seq_last, is_called AS student_seq_called FROM public.student_id_seq;
SELECT last_value AS enrollment_seq_last, is_called AS enrollment_seq_called FROM public.enrollment_id_seq;

DO $$
DECLARE
  v_stu_last BIGINT;
  v_stu_called BOOLEAN;
  v_enr_last BIGINT;
  v_enr_called BOOLEAN;
BEGIN
  SELECT last_value, is_called INTO v_stu_last, v_stu_called FROM public.student_id_seq;
  SELECT last_value, is_called INTO v_enr_last, v_enr_called FROM public.enrollment_id_seq;

  IF current_database() = 'digitalmuid_v43_legacy_test' THEN
    -- Legacy fixture seeds DM-STU-010001 with seq (10001, is_called=false) & backfills 1 missing row -> (10002, true)
    IF v_stu_last < 10002 OR v_stu_called IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '2B FAILURE: student_id_seq expected (>=10002, is_called=true), got (%, %).', v_stu_last, v_stu_called;
    END IF;
    -- Legacy fixture seeds enrollment_id_seq at (10050, is_called=true) and reassigns 1 dup -> (10051, true)
    IF v_enr_last < 10051 OR v_enr_called IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '2B FAILURE: enrollment_id_seq rewound or mis-synced: expected (>=10051, true), got (%, %).', v_enr_last, v_enr_called;
    END IF;
  ELSE
    -- Fresh fixture backfills 2 profiles and 1 enrollment starting from 10001
    IF v_stu_last < 10002 OR v_stu_called IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '2B FAILURE: student_id_seq expected (>=10002, true), got (%, %).', v_stu_last, v_stu_called;
    END IF;
    IF v_enr_last < 10001 OR v_enr_called IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '2B FAILURE: enrollment_id_seq expected (>=10001, true), got (%, %).', v_enr_last, v_enr_called;
    END IF;
  END IF;

  RAISE NOTICE 'PASS [2B]: Sequences verified (student=(%,%), enrollment=(%,%)).',
    v_stu_last, v_stu_called, v_enr_last, v_enr_called;
END $$;

-- 2C. Verify ALL 9 SECURITY DEFINER functions by exact canonical signature,
--     prosecdef, owner, search_path, and absence of PUBLIC/anon/authenticated execute
SELECT
  n.nspname || '.' || p.proname || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')' AS canonical_signature,
  p.prosecdef,
  p.proconfig,
  pg_catalog.pg_get_userbyid(p.proowner) AS owner_role,
  EXISTS (
    SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, ARRAY[]::aclitem[])) a
    WHERE a.grantee = 0::oid AND a.privilege_type = 'EXECUTE'
  ) AS public_exec,
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
ORDER BY canonical_signature;

DO $$
DECLARE
  v_expected_sigs CONSTANT TEXT[] := ARRAY[
    'public.generate_student_id()',
    'public.generate_enrollment_id()',
    'public.get_next_invoice_number(timestamp with time zone)',
    'public.get_next_credit_note_number(timestamp with time zone)',
    'public.record_credit_note_with_limit(text, text, numeric, text, uuid, text, timestamp with time zone)',
    'public.trigger_set_student_id()',
    'public.trigger_set_enrollment_id()',
    'public.trigger_set_payment_invoice()',
    'public.protect_payment_status_transitions()'
  ];
  v_sig TEXT;
  v_rec RECORD;
  v_total_matching_names INTEGER;
  v_has_postgres_role BOOLEAN := EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres');
BEGIN
  -- Ensure zero unexpected duplicate overloads with the same function names
  SELECT COUNT(*) INTO v_total_matching_names
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
    );

  IF v_total_matching_names <> 9 THEN
    RAISE EXCEPTION '2C FAILURE: Expected exactly 9 functions in public for Phase A function names, found % (possible stale overload left behind).', v_total_matching_names;
  END IF;

  FOREACH v_sig IN ARRAY v_expected_sigs
  LOOP
    SELECT
      p.oid,
      p.prosecdef,
      p.proconfig,
      p.proacl,
      pg_catalog.pg_get_userbyid(p.proowner) AS owner_role
    INTO v_rec
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (n.nspname || '.' || p.proname || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')') = v_sig;

    IF NOT FOUND THEN
      RAISE EXCEPTION '2C FAILURE: Exact signature missing: %', v_sig;
    END IF;

    IF v_rec.prosecdef IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '2C FAILURE: Function % is not SECURITY DEFINER.', v_sig;
    END IF;

    IF v_has_postgres_role AND v_rec.owner_role IS DISTINCT FROM 'postgres' THEN
      RAISE EXCEPTION '2C FAILURE: Function % owner is %, expected postgres.', v_sig, v_rec.owner_role;
    END IF;

    IF NOT ('search_path=public, pg_temp' = ANY(COALESCE(v_rec.proconfig, ARRAY[]::TEXT[]))) THEN
      RAISE EXCEPTION '2C FAILURE: Function % lacks SET search_path = public, pg_temp (proconfig=%).', v_sig, v_rec.proconfig;
    END IF;

    IF v_rec.proacl IS NULL THEN
      RAISE EXCEPTION '2C FAILURE: Function % has NULL proacl (default PUBLIC EXECUTE grant still active).', v_sig;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_catalog.aclexplode(v_rec.proacl) a
      WHERE a.grantee = 0::oid AND a.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION '2C FAILURE: Function % still grants EXECUTE to PUBLIC.', v_sig;
    END IF;

    IF pg_catalog.has_function_privilege('anon', v_rec.oid, 'EXECUTE') THEN
      RAISE EXCEPTION '2C FAILURE: Function % is executable by anon.', v_sig;
    END IF;

    IF pg_catalog.has_function_privilege('authenticated', v_rec.oid, 'EXECUTE') THEN
      RAISE EXCEPTION '2C FAILURE: Function % is executable by authenticated.', v_sig;
    END IF;

    IF NOT pg_catalog.has_function_privilege('service_role', v_rec.oid, 'EXECUTE') THEN
      RAISE EXCEPTION '2C FAILURE: Function % is NOT executable by service_role.', v_sig;
    END IF;

    IF v_has_postgres_role AND NOT pg_catalog.has_function_privilege('postgres', v_rec.oid, 'EXECUTE') THEN
      RAISE EXCEPTION '2C FAILURE: Function % is NOT executable by postgres.', v_sig;
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS [2C]: All 9 SECURITY DEFINER signatures, search_path, owners, and strict ACLs verified.';
END $$;

-- 2D. Verify Phase A->B gate blocks credit-note issuance BEFORE Phase B runs
BEGIN;
DO $$
DECLARE
  v_target_pay_id TEXT := CASE
    WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 'pay_leg_101'
    ELSE 'pay_fresh_001'
  END;
  v_threw BOOLEAN := FALSE;
  v_sqlstate TEXT := NULL;
  v_errm TEXT := NULL;
BEGIN
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_target_pay_id, 'rfnd_pre_phase_b', 100.00);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE;
    v_sqlstate := SQLSTATE;
    v_errm := SQLERRM;
  END;

  IF NOT v_threw THEN
    RAISE EXCEPTION '2D TEST FAILURE: Phase A->B gate unexpectedly allowed credit note issuance before Phase B indexes existed.';
  END IF;

  IF v_sqlstate IS DISTINCT FROM 'P0001'
     OR v_errm !~* '^Credit note processing halted: Required Phase B unique index public\.idx_credit_notes_(number|refund_id) is missing\.' THEN
    RAISE EXCEPTION '2D TEST FAILURE: Wrong failure on pre-Phase-B gate (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;

  RAISE NOTICE 'PASS [2D]: Pre-Phase-B gate blocked refund cleanly (SQLSTATE=%: %).', v_sqlstate, v_errm;
END $$;
ROLLBACK;

\endif

-- ==============================================================================
-- 3. STAGE post_b (PART 1) — STRICT PHASE B 8-INDEX VERIFICATION
-- Asserts exact 8 indexes exist in public, zero invalid/unready indexes on target
-- tables, exact table, exact single column (pg_attribute/indkey/indexprs IS NULL),
-- exact uniqueness, indisvalid/indisready/indislive, and exact partial predicates
-- matching 20261107000002_concurrent_indexes.sql.
-- ==============================================================================
\if :is_post_b

SELECT
  nc.nspname AS index_schema,
  nt.nspname AS table_schema,
  t.relname AS table_name,
  c.relname AS index_name,
  i.indisunique,
  i.indisvalid,
  i.indisready,
  i.indislive,
  pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS partial_predicate,
  pg_catalog.pg_get_indexdef(c.oid) AS full_index_def
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
WHERE nc.nspname = 'public'
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

DO $$
DECLARE
  v_spec RECORD;
  v_row RECORD;
  v_attnum SMALLINT;
  v_pred_regex TEXT;
  v_def_regex TEXT;
  v_found_names_cnt INTEGER;
  v_invalid_on_targets INTEGER;
  v_verified INTEGER := 0;
BEGIN
  -- Assert exact count of expected 8 index names in schema public
  SELECT COUNT(*) INTO v_found_names_cnt
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
  JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
  WHERE nc.nspname = 'public'
    AND c.relname IN (
      'idx_credit_notes_number',
      'idx_credit_notes_refund_id',
      'idx_credit_notes_payment_id',
      'idx_credit_notes_user_id',
      'idx_profiles_student_id',
      'idx_course_enrollments_enrollment_id',
      'idx_payments_invoice_number',
      'idx_payments_credit_note_number'
    );

  IF v_found_names_cnt <> 8 THEN
    RAISE EXCEPTION '3 FAILURE: Expected exact 8 Phase B indexes in schema public, found %.', v_found_names_cnt;
  END IF;

  -- Fail if ANY index on the 4 target tables in public is invalid, unready, or dead
  SELECT COUNT(*) INTO v_invalid_on_targets
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
  JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
  WHERE nt.nspname = 'public'
    AND t.relname IN ('credit_notes', 'profiles', 'course_enrollments', 'payments')
    AND (NOT i.indisvalid OR NOT i.indisready OR NOT i.indislive);

  IF v_invalid_on_targets > 0 THEN
    RAISE EXCEPTION '3 FAILURE: Found % invalid/unready/dead index(es) on Phase B target tables.', v_invalid_on_targets;
  END IF;

  FOR v_spec IN
    SELECT * FROM (VALUES
      ('idx_credit_notes_number',              'credit_notes',       TRUE,  'credit_note_number', TRUE),
      ('idx_credit_notes_refund_id',           'credit_notes',       TRUE,  'refund_id',          TRUE),
      ('idx_credit_notes_payment_id',          'credit_notes',       FALSE, 'payment_id',         FALSE),
      ('idx_credit_notes_user_id',             'credit_notes',       FALSE, 'user_id',            FALSE),
      ('idx_profiles_student_id',              'profiles',           TRUE,  'student_id',         TRUE),
      ('idx_course_enrollments_enrollment_id', 'course_enrollments', TRUE,  'enrollment_id',      TRUE),
      ('idx_payments_invoice_number',          'payments',           TRUE,  'invoice_number',     TRUE),
      ('idx_payments_credit_note_number',      'payments',           TRUE,  'credit_note_number', TRUE)
    ) AS s(idx_name, tbl_name, expect_unique, col_name, expect_partial)
  LOOP
    SELECT a.attnum INTO v_attnum
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class tbl ON tbl.oid = a.attrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = v_spec.tbl_name
      AND a.attname = v_spec.col_name
      AND NOT a.attisdropped;

    IF v_attnum IS NULL THEN
      RAISE EXCEPTION '3 FAILURE: Expected column public.%.% not found.', v_spec.tbl_name, v_spec.col_name;
    END IF;

    SELECT
      nt.nspname AS table_schema,
      t.relname AS table_name,
      i.indisunique,
      i.indisvalid,
      i.indisready,
      i.indislive,
      i.indkey,
      i.indexprs,
      i.indpred,
      pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS pred_expr,
      pg_catalog.pg_get_indexdef(c.oid) AS idx_def
    INTO v_row
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
    JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
    WHERE nc.nspname = 'public'
      AND c.relname = v_spec.idx_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION '3 FAILURE: Missing Phase B index public.%.', v_spec.idx_name;
    END IF;

    IF v_row.table_schema IS DISTINCT FROM 'public'
       OR v_row.table_name IS DISTINCT FROM v_spec.tbl_name THEN
      RAISE EXCEPTION '3 FAILURE: Index public.% belongs to %.%, expected public.% (%).',
        v_spec.idx_name, v_row.table_schema, v_row.table_name, v_spec.tbl_name, v_row.idx_def;
    END IF;

    IF v_row.indisunique IS DISTINCT FROM v_spec.expect_unique THEN
      RAISE EXCEPTION '3 FAILURE: Index public.% indisunique=%, expected % (%).',
        v_spec.idx_name, v_row.indisunique, v_spec.expect_unique, v_row.idx_def;
    END IF;

    IF v_row.indisvalid IS DISTINCT FROM TRUE
       OR v_row.indisready IS DISTINCT FROM TRUE
       OR v_row.indislive IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '3 FAILURE: Index public.% not valid/ready/live (valid=%, ready=%, live=%).',
        v_spec.idx_name, v_row.indisvalid, v_row.indisready, v_row.indislive;
    END IF;

    IF v_row.indexprs IS NOT NULL
       OR v_row.indkey::SMALLINT[] IS DISTINCT FROM ARRAY[v_attnum] THEN
      RAISE EXCEPTION '3 FAILURE: Index public.% does not exclusively index column public.%.(%) (%).',
        v_spec.idx_name, v_spec.tbl_name, v_spec.col_name, v_row.idx_def;
    END IF;

    v_pred_regex :=
      '^\s*\(*\s*' || v_spec.col_name || '\s+IS\s+NOT\s+NULL\s*\)*\s+AND\s+\(*\s*(?:pg_catalog\.)?btrim\(\s*\(*\s*'
      || v_spec.col_name
      || '(?:\)*(?:::text)?)\s*,\s*E?'' (?:\t|\\t|\\x09|\\011)(?:\n|\\n|\\x0a|\\012)(?:\r|\\r|\\x0d|\\015)(?:\f|\\f|\\x0c|\\014)(?:\v|\\v|\\x0b|\\013)''(?:::text)?\s*\)\s*(?:<>|!=)\s*''''(?:::text)?\s*\)*\s*$';

    IF v_spec.expect_partial THEN
      IF v_row.indpred IS NULL OR v_row.pred_expr IS NULL OR v_row.pred_expr !~* v_pred_regex THEN
        RAISE EXCEPTION '3 FAILURE: Index public.% partial predicate mismatch: got %, expected non-blank BTRIM predicate on %.',
          v_spec.idx_name, COALESCE(v_row.pred_expr, '<none>'), v_spec.col_name;
      END IF;
      v_def_regex := '^CREATE UNIQUE INDEX ' || v_spec.idx_name || ' ON public\.' || v_spec.tbl_name || ' USING btree \(' || v_spec.col_name || '\) WHERE ';
    ELSE
      IF v_row.indpred IS NOT NULL OR v_row.pred_expr IS NOT NULL THEN
        RAISE EXCEPTION '3 FAILURE: Non-partial index public.% unexpectedly has predicate %.', v_spec.idx_name, v_row.pred_expr;
      END IF;
      v_def_regex := '^CREATE INDEX ' || v_spec.idx_name || ' ON public\.' || v_spec.tbl_name || ' USING btree \(' || v_spec.col_name || '\)$';
    END IF;

    IF v_row.idx_def !~ v_def_regex THEN
      RAISE EXCEPTION '3 FAILURE: pg_get_indexdef mismatch on public.%: got "%".', v_spec.idx_name, v_row.idx_def;
    END IF;

    v_verified := v_verified + 1;
  END LOOP;

  IF v_verified <> 8 THEN
    RAISE EXCEPTION '3 FAILURE: Verified %/8 Phase B indexes.', v_verified;
  END IF;

  RAISE NOTICE 'PASS [3]: All 8/8 Phase B indexes match table, column, uniqueness, btree def, indisvalid/ready/live, and partial predicates.';
END $$;

-- ==============================================================================
-- 4. STAGE post_b (PART 2) — FIXTURE BALANCE ASSERTIONS, FUNCTIONAL REFUND SUITE,
--    IDEMPOTENCY, SQLSTATE 42702 CHECK, RLS, SQL GRANTS & TRIGGER ENFORCEMENT
-- ==============================================================================
BEGIN;

-- ------------------------------------------------------------------------------
-- 4.0 Verify Exact Synthetic Fixture Balances, Owners, Currencies & Historical Sums
--     BEFORE Running Any Refund Assertions
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_stu1 UUID := '10000000-0000-4000-8000-000000000001'::uuid;
  v_stu2 UUID := '10000000-0000-4000-8000-000000000002'::uuid;
  v_p1 RECORD;
  v_p2 RECORD;
  v_p3 RECORD;
  v_p4 RECORD;
  v_cn1_sum NUMERIC;
  v_cn2_sum NUMERIC;
  v_cn3_sum NUMERIC;
  v_rls_pay BOOLEAN;
  v_rls_cn BOOLEAN;
BEGIN
  ASSERT EXISTS (SELECT 1 FROM auth.users WHERE id = v_stu1 AND email = 'student1.synthetic@example.test'),
    'FIXTURE FAILURE: Missing Student 1 in auth.users';
  ASSERT EXISTS (SELECT 1 FROM auth.users WHERE id = v_stu2 AND email = 'student2.synthetic@example.test'),
    'FIXTURE FAILURE: Missing Student 2 in auth.users';

  SELECT relrowsecurity INTO v_rls_pay FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'payments';
  SELECT relrowsecurity INTO v_rls_cn  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'credit_notes';
  ASSERT v_rls_pay IS TRUE, 'RLS FAILURE: public.payments does not have ROW LEVEL SECURITY enabled.';
  ASSERT v_rls_cn IS TRUE,  'RLS FAILURE: public.credit_notes does not have ROW LEVEL SECURITY enabled.';

  IF current_database() = 'digitalmuid_v43_legacy_test' THEN
    -- Expected legacy fixture payment rows & cumulative prior refund totals:
    --   pay_leg_101: amount=1000.00 INR, owner=Student1, status='captured', invoice='DM/26-27/0003', prior CN sum=400.00 -> rem=600.00
    --   pay_leg_102: amount=2000.00 INR, owner=Student2, status='captured', invoice='DM/26-27/0004', prior CN sum=500.00 -> rem=1500.00
    --   pay_leg_103: amount=500.00  INR, owner=Student1, status='refunded', invoice='DM/26-27/0005', prior CN sum=500.00 -> rem=0.00
    --   pay_leg_104: amount=999.00  INR, owner=Student2, status='failed',   invoice=NULL
    SELECT * INTO v_p1 FROM public.payments WHERE razorpay_payment_id = 'pay_leg_101';
    ASSERT FOUND AND v_p1.amount = 1000.00 AND v_p1.currency = 'INR' AND v_p1.user_id = v_stu1 AND v_p1.status = 'captured' AND v_p1.invoice_number = 'DM/26-27/0003',
      'FIXTURE FAILURE: pay_leg_101 does not match expected baseline (1000.00 INR, Student1, captured, DM/26-27/0003).';

    SELECT * INTO v_p2 FROM public.payments WHERE razorpay_payment_id = 'pay_leg_102';
    ASSERT FOUND AND v_p2.amount = 2000.00 AND v_p2.currency = 'INR' AND v_p2.user_id = v_stu2 AND v_p2.status = 'captured' AND v_p2.invoice_number = 'DM/26-27/0004',
      'FIXTURE FAILURE: pay_leg_102 does not match expected baseline (2000.00 INR, Student2, captured, DM/26-27/0004).';

    SELECT * INTO v_p3 FROM public.payments WHERE razorpay_payment_id = 'pay_leg_103';
    ASSERT FOUND AND v_p3.amount = 500.00 AND v_p3.currency = 'INR' AND v_p3.user_id = v_stu1 AND v_p3.status = 'refunded' AND v_p3.credit_note_number = 'CN/26-27/0009',
      'FIXTURE FAILURE: pay_leg_103 does not match expected baseline (500.00 INR, Student1, refunded, CN/26-27/0009).';

    SELECT * INTO v_p4 FROM public.payments WHERE razorpay_payment_id = 'pay_leg_104';
    ASSERT FOUND AND v_p4.amount = 999.00 AND v_p4.currency = 'INR' AND v_p4.user_id = v_stu2 AND v_p4.status = 'failed' AND v_p4.invoice_number IS NULL,
      'FIXTURE FAILURE: pay_leg_104 does not match expected baseline (999.00 INR, Student2, failed, NULL invoice).';

    SELECT COALESCE(SUM(amount), 0.00) INTO v_cn1_sum FROM public.credit_notes WHERE payment_id IN ('pay_leg_101', v_p1.id::text);
    SELECT COALESCE(SUM(amount), 0.00) INTO v_cn2_sum FROM public.credit_notes WHERE payment_id IN ('pay_leg_102', v_p2.id::text);
    SELECT COALESCE(SUM(amount), 0.00) INTO v_cn3_sum FROM public.credit_notes WHERE payment_id IN ('pay_leg_103', v_p3.id::text);

    ASSERT v_cn1_sum = 400.00, 'FIXTURE FAILURE: pay_leg_101 prior credit_notes sum expected 400.00, got ' || v_cn1_sum;
    ASSERT v_cn2_sum = 500.00, 'FIXTURE FAILURE: pay_leg_102 prior credit_notes sum expected 500.00, got ' || v_cn2_sum;
    ASSERT v_cn3_sum = 500.00, 'FIXTURE FAILURE: pay_leg_103 prior credit_notes sum expected 500.00, got ' || v_cn3_sum;
  ELSE
    -- Expected fresh fixture payment rows:
    --   pay_fresh_001: amount=1180.00 INR, owner=Student1, status='captured', prior CN sum=0.00 -> rem=1180.00
    --   pay_fresh_002: amount=590.00  INR, owner=Student2, status='paid',     prior CN sum=0.00 -> rem=590.00
    SELECT * INTO v_p1 FROM public.payments WHERE razorpay_payment_id = 'pay_fresh_001';
    ASSERT FOUND AND v_p1.amount = 1180.00 AND v_p1.currency = 'INR' AND v_p1.user_id = v_stu1 AND v_p1.status = 'captured' AND v_p1.invoice_number IS NOT NULL,
      'FIXTURE FAILURE: pay_fresh_001 does not match expected baseline (1180.00 INR, Student1, captured, non-null invoice).';

    SELECT * INTO v_p2 FROM public.payments WHERE razorpay_payment_id = 'pay_fresh_002';
    ASSERT FOUND AND v_p2.amount = 590.00 AND v_p2.currency = 'INR' AND v_p2.user_id = v_stu2 AND v_p2.status = 'paid' AND v_p2.invoice_number IS NOT NULL,
      'FIXTURE FAILURE: pay_fresh_002 does not match expected baseline (590.00 INR, Student2, paid, non-null invoice).';

    SELECT COALESCE(SUM(amount), 0.00) INTO v_cn1_sum FROM public.credit_notes WHERE payment_id IN ('pay_fresh_001', v_p1.id::text);
    SELECT COALESCE(SUM(amount), 0.00) INTO v_cn2_sum FROM public.credit_notes WHERE payment_id IN ('pay_fresh_002', v_p2.id::text);
    ASSERT v_cn1_sum = 0.00, 'FIXTURE FAILURE: pay_fresh_001 expected 0.00 prior credit notes, got ' || v_cn1_sum;
    ASSERT v_cn2_sum = 0.00, 'FIXTURE FAILURE: pay_fresh_002 expected 0.00 prior credit notes, got ' || v_cn2_sum;
  END IF;

  RAISE NOTICE 'PASS [4.0]: Synthetic fixture rows, owners, currencies, RLS flags, and historical refund balances verified.';
END $$;

-- ------------------------------------------------------------------------------
-- 4A–4C. Input Validation, Idempotency, Cross-Payment & Ownership Rejection,
--        Partial Refund Math, and Full Refund `UPDATE public.payments AS pay`
-- NOTE: Every negative test uses `v_threw` + SQLSTATE + SQLERRM validation OUTSIDE
--       the inner `EXCEPTION` block so unexpected success CANNOT pass.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_is_legacy BOOLEAN := (current_database() = 'digitalmuid_v43_legacy_test');
  v_pay1 TEXT := CASE WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 'pay_leg_101' ELSE 'pay_fresh_001' END;
  v_pay2 TEXT := CASE WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 'pay_leg_102' ELSE 'pay_fresh_002' END;
  v_stu2 UUID := '10000000-0000-4000-8000-000000000002'::uuid;
  v_part_amt NUMERIC(10, 2) := CASE WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 200.00 ELSE 500.00 END;
  v_exp_rem_after_part NUMERIC(10, 2) := CASE WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 400.00 ELSE 680.00 END;
  v_full_rem_amt NUMERIC(10, 2) := CASE WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 400.00 ELSE 680.00 END;
  v_exp_part_base NUMERIC(10, 2) := ROUND((CASE WHEN current_database() = 'digitalmuid_v43_legacy_test' THEN 200.00 ELSE 500.00 END / 1.18), 2);
  v_exp_part_tax NUMERIC(10, 2);
  v_res RECORD;
  v_pay_after RECORD;
  v_orig_inv TEXT;
  v_threw BOOLEAN;
  v_sqlstate TEXT;
  v_errm TEXT;
BEGIN
  v_exp_part_tax := v_part_amt - v_exp_part_base;
  SELECT invoice_number INTO v_orig_inv FROM public.payments WHERE razorpay_payment_id = v_pay1;

  -- 4A.1 Reject NaN refund amount
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_nan', 'NaN'::NUMERIC);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4A.1 TEST FAILURE: NaN refund amount was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Invalid refund amount .*finite positive number' THEN
    RAISE EXCEPTION '4A.1 TEST FAILURE: Unexpected error on NaN (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4A.1 NAN]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4A.2 Reject non-positive (0.00) refund amount
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_zero', 0.00);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4A.2 TEST FAILURE: Zero refund amount was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Invalid refund amount .*finite positive number' THEN
    RAISE EXCEPTION '4A.2 TEST FAILURE: Unexpected error on 0.00 (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4A.2 ZERO]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4A.3 Reject >2 decimal places (10.123)
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_3dec', 10.123);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4A.3 TEST FAILURE: >2-decimal refund amount was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Invalid refund amount .*at most two decimal places' THEN
    RAISE EXCEPTION '4A.3 TEST FAILURE: Unexpected error on >2 decimals (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4A.3 >2DEC]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4A.4 Reject unsupported currency ('USD')
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_usd', 100.00, 'test', NULL, 'USD');
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4A.4 TEST FAILURE: Unsupported currency USD was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Unsupported or missing currency USD:' THEN
    RAISE EXCEPTION '4A.4 TEST FAILURE: Unexpected error on USD currency (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4A.4 USD]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4B.1 Partial refund succeeds with exact base/tax breakdown and exact remaining balance
  SELECT * INTO v_res FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_part_new_1', v_part_amt);
  ASSERT v_res.is_idempotent_duplicate = FALSE, '4B.1 FAILURE: Expected fresh partial credit note.';
  ASSERT v_res.amount = v_part_amt, '4B.1 FAILURE: Returned amount mismatch.';
  ASSERT v_res.base_amount = v_exp_part_base, '4B.1 FAILURE: Expected base_amount=' || v_exp_part_base || ', got ' || v_res.base_amount;
  ASSERT v_res.tax_amount = v_exp_part_tax, '4B.1 FAILURE: Expected tax_amount=' || v_exp_part_tax || ', got ' || v_res.tax_amount;
  ASSERT v_res.is_partial = TRUE, '4B.1 FAILURE: Expected is_partial=TRUE.';
  ASSERT v_res.remaining_balance = v_exp_rem_after_part,
    '4B.1 FAILURE: Expected remaining_balance=' || v_exp_rem_after_part || ', got ' || v_res.remaining_balance;

  -- 4B.2 Exact idempotent replay returns same CN number & remaining balance without extra deduction
  SELECT * INTO v_res FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_part_new_1', v_part_amt);
  ASSERT v_res.is_idempotent_duplicate = TRUE, '4B.2 FAILURE: Expected is_idempotent_duplicate=TRUE.';
  ASSERT v_res.remaining_balance = v_exp_rem_after_part,
    '4B.2 FAILURE: Replay remaining_balance mismatch: ' || v_res.remaining_balance;

  -- 4B.3 Idempotent retry with DIFFERENT amount MUST fail closed
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_part_new_1', v_part_amt + 50.00);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4B.3 TEST FAILURE: Mismatched idempotent retry amount was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Idempotent retry mismatch for refund_id rfnd_part_new_1:' THEN
    RAISE EXCEPTION '4B.3 TEST FAILURE: Unexpected error on retry amount mismatch (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4B.3 RETRY AMOUNT MISMATCH]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4B.4 Cross-payment refund_id reuse MUST be rejected
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay2, 'rfnd_part_new_1', v_part_amt);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4B.4 TEST FAILURE: Cross-payment refund_id reuse was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Refund ID rfnd_part_new_1 is already associated with another payment' THEN
    RAISE EXCEPTION '4B.4 TEST FAILURE: Unexpected error on cross-payment reuse (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4B.4 CROSS-PAY]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4B.5 Ownership hijack (caller p_user_id != authoritative payment owner) MUST be rejected
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_hijack', 100.00, 'test', v_stu2);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4B.5 TEST FAILURE: Caller p_user_id ownership hijack was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Ownership mismatch: caller user_id' THEN
    RAISE EXCEPTION '4B.5 TEST FAILURE: Unexpected error on ownership hijack (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4B.5 OWNERSHIP]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4B.6 Over-refund beyond remaining balance (remaining + 0.01) MUST be rejected (no clamping)
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_over_limit', v_full_rem_amt + 0.01);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION '4B.6 TEST FAILURE: Over-refund exceeding remaining balance was unexpectedly accepted.';
  END IF;
  IF v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Refund amount .* exceeds remaining eligible refundable balance' THEN
    RAISE EXCEPTION '4B.6 TEST FAILURE: Unexpected error on over-refund (SQLSTATE=%, ERRM=%).', v_sqlstate, v_errm;
  END IF;
  RAISE NOTICE 'PASS [4B.6 OVER-REFUND]: SQLSTATE=% %', v_sqlstate, v_errm;

  -- 4C. Remaining balance full refund — exercises `UPDATE public.payments AS pay`
  --     and proves SQLSTATE 42702 (ambiguous credit_note_number / id) does NOT occur
  SELECT * INTO v_res FROM public.record_credit_note_with_limit(v_pay1, 'rfnd_full_rem_1', v_full_rem_amt);
  ASSERT v_res.is_idempotent_duplicate = FALSE, '4C FAILURE: Expected fresh full-balance credit note.';
  ASSERT v_res.is_partial = FALSE, '4C FAILURE: Expected is_partial=FALSE when full balance cleared.';
  ASSERT v_res.remaining_balance = 0.00, '4C FAILURE: Expected remaining_balance=0.00, got ' || v_res.remaining_balance;

  SELECT * INTO v_pay_after FROM public.payments WHERE razorpay_payment_id = v_pay1;
  ASSERT v_pay_after.status = 'refunded', '4C FAILURE: Payment status did not transition to refunded.';
  ASSERT v_pay_after.credit_note_number = v_res.credit_note_number,
    '4C FAILURE: Payment credit_note_number (' || COALESCE(v_pay_after.credit_note_number, '<null>') || ') != ' || v_res.credit_note_number;
  ASSERT v_pay_after.invoice_number = v_orig_inv,
    '4C FAILURE: Original invoice_number was mutated across full refund!';

  -- Ensure Student 2 also owns >=1 credit note in fresh DB before RLS cross-tenant checks in 4D
  IF NOT v_is_legacy THEN
    PERFORM * FROM public.record_credit_note_with_limit(v_pay2, 'rfnd_fresh_s2_seed', 100.00);
  END IF;

  RAISE NOTICE 'PASS [4C FULL REFUND]: Credit note % cleared balance cleanly without SQLSTATE 42702 (invoice % preserved).',
    v_res.credit_note_number, v_pay_after.invoice_number;
END $$;

-- ------------------------------------------------------------------------------
-- 4D. RLS, SQL Grant Enforcement & Direct Trigger Tampering Tests
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_stu1 UUID := '10000000-0000-4000-8000-000000000001'::uuid;
  v_stu2 UUID := '10000000-0000-4000-8000-000000000002'::uuid;
  v_stu1_cn_total INTEGER;
  v_stu2_cn_total INTEGER;
  v_visible_own_cn INTEGER;
  v_visible_all_cn INTEGER;
  v_visible_other_cn INTEGER;
  v_visible_own_pay INTEGER;
  v_visible_other_pay INTEGER;
  v_pay1_id UUID;
  v_pay2_id UUID;
  v_threw BOOLEAN;
  v_sqlstate TEXT;
  v_errm TEXT;
BEGIN
  -- 1. Pre-check BEFORE role switch: verify both synthetic users & their credit notes exist
  ASSERT EXISTS (SELECT 1 FROM auth.users WHERE id = v_stu1 AND email = 'student1.synthetic@example.test'),
    '4D PRECHECK FAILURE: Student 1 missing.';
  ASSERT EXISTS (SELECT 1 FROM auth.users WHERE id = v_stu2 AND email = 'student2.synthetic@example.test'),
    '4D PRECHECK FAILURE: Student 2 missing.';

  SELECT COUNT(*) INTO v_stu1_cn_total FROM public.credit_notes WHERE user_id = v_stu1;
  SELECT COUNT(*) INTO v_stu2_cn_total FROM public.credit_notes WHERE user_id = v_stu2;
  ASSERT v_stu1_cn_total >= 1, '4D PRECHECK FAILURE: Student 1 has 0 credit_notes.';
  ASSERT v_stu2_cn_total >= 1, '4D PRECHECK FAILURE: Student 2 has 0 credit_notes.';

  SELECT id INTO v_pay1_id FROM public.payments WHERE user_id = v_stu1 ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_pay2_id FROM public.payments WHERE user_id = v_stu2 ORDER BY created_at ASC LIMIT 1;
  ASSERT v_pay1_id IS NOT NULL AND v_pay2_id IS NOT NULL, '4D PRECHECK FAILURE: Missing seeded payments for Student 1/2.';

  -- 2. Verify SQL table GRANTs catalog metadata (one privilege per call)
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.payments', 'INSERT'),
    '4D GRANT FAILURE: authenticated must NOT have INSERT on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.payments', 'UPDATE'),
    '4D GRANT FAILURE: authenticated must NOT have UPDATE on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.payments', 'DELETE'),
    '4D GRANT FAILURE: authenticated must NOT have DELETE on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.payments', 'SELECT'),
    '4D GRANT FAILURE: anon must NOT have SELECT on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.payments', 'INSERT'),
    '4D GRANT FAILURE: anon must NOT have INSERT on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.payments', 'UPDATE'),
    '4D GRANT FAILURE: anon must NOT have UPDATE on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.payments', 'DELETE'),
    '4D GRANT FAILURE: anon must NOT have DELETE on public.payments.';
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.credit_notes', 'INSERT'),
    '4D GRANT FAILURE: authenticated must NOT have INSERT on public.credit_notes.';
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.credit_notes', 'UPDATE'),
    '4D GRANT FAILURE: authenticated must NOT have UPDATE on public.credit_notes.';
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.credit_notes', 'DELETE'),
    '4D GRANT FAILURE: authenticated must NOT have DELETE on public.credit_notes.';

  -- 3. Switch to real non-superuser `authenticated` role as Student 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"student1.synthetic@example.test"}', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 3a. RLS POSITIVE: Student 1 reads own credit notes (exact match) & own payments
  SELECT COUNT(*) INTO v_visible_own_cn FROM public.credit_notes WHERE user_id = v_stu1;
  SELECT COUNT(*) INTO v_visible_all_cn FROM public.credit_notes;
  SELECT COUNT(*) INTO v_visible_other_cn FROM public.credit_notes WHERE user_id = v_stu2;
  ASSERT v_visible_own_cn = v_stu1_cn_total,
    '4D RLS FAILURE: Student 1 expected ' || v_stu1_cn_total || ' own credit notes, saw ' || v_visible_own_cn;
  ASSERT v_visible_all_cn = v_visible_own_cn,
    '4D RLS FAILURE: Total visible credit notes (' || v_visible_all_cn || ') != own credit notes (' || v_visible_own_cn || ').';
  ASSERT v_visible_other_cn = 0,
    '4D RLS FAILURE: Student 1 saw ' || v_visible_other_cn || ' Student 2 credit notes.';

  SELECT COUNT(*) INTO v_visible_own_pay FROM public.payments WHERE user_id = v_stu1;
  SELECT COUNT(*) INTO v_visible_other_pay FROM public.payments WHERE user_id = v_stu2;
  ASSERT v_visible_own_pay >= 1, '4D RLS FAILURE: Student 1 could not read own payment rows.';
  ASSERT v_visible_other_pay = 0, '4D RLS FAILURE: Student 1 saw Student 2 payment rows.';

  -- 3b. GRANT NEGATIVE: authenticated cannot INSERT into public.payments (SQLSTATE 42501)
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status)
    VALUES (v_stu1, 'course', 'c_attack', 'Forged Payment', 1.00, 'INR', 'ord_atk_1', 'pay_atk_1', 'captured');
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION '4D GRANT FAILURE [INSERT payments]: Expected 42501, got threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  -- 3c. GRANT NEGATIVE: authenticated cannot UPDATE public.payments or set status='captured' (SQLSTATE 42501)
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    UPDATE public.payments SET status = 'captured', item_title = 'Tampered' WHERE id = v_pay1_id;
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION '4D GRANT FAILURE [UPDATE payments]: Expected 42501, got threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  -- 3d. GRANT NEGATIVE: authenticated cannot DELETE public.payments (SQLSTATE 42501)
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    DELETE FROM public.payments WHERE id = v_pay1_id;
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION '4D GRANT FAILURE [DELETE payments]: Expected 42501, got threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  -- 3e. GRANT NEGATIVE: authenticated cannot SELECT invoice_series or execute credit-note RPC (SQLSTATE 42501)
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.invoice_series LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION '4D GRANT FAILURE [SELECT invoice_series]: Expected 42501, got threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('pay_atk_none', 'rfnd_atk_rpc', 10.00);
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION '4D GRANT FAILURE [EXEC RPC]: Expected 42501, got threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  RESET ROLE;

  -- 4. Exercise TRIGGER guards directly (as owner/service connection while JWT role='authenticated')
  --    Verifies defense-in-depth inside trg_protect_payment_status & set_payment_invoice_number
  PERFORM set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 4a. Trigger blocks privileged status 'captured' on INSERT with JWT role='authenticated'
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status)
    VALUES (v_stu1, 'course', 'c_trg', 'Trigger Status Block', 100.00, 'INR', 'ord_trg_cap', 'pay_trg_cap', 'captured');
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Unauthorized: Status captured cannot be set directly' THEN
    RAISE EXCEPTION '4D TRIGGER FAILURE [INSERT captured]: threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  -- 4b. Trigger blocks status transition to 'refunded' on UPDATE with JWT role='authenticated'
  --     (v_pay2_id is 'captured' on legacy or 'paid' on fresh, ensuring OLD.status IS DISTINCT FROM 'refunded')
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    UPDATE public.payments SET status = 'refunded' WHERE id = v_pay2_id;
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Unauthorized: Status refunded cannot be set directly' THEN
    RAISE EXCEPTION '4D TRIGGER FAILURE [UPDATE refunded]: threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  -- 4b-bis. On legacy fixture, also verify 'failed' -> 'captured' status escalation is blocked
  IF current_database() = 'digitalmuid_v43_legacy_test' THEN
    v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
    BEGIN
      UPDATE public.payments SET status = 'captured' WHERE razorpay_payment_id = 'pay_leg_104';
    EXCEPTION WHEN OTHERS THEN
      v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
    END;
    IF NOT v_threw OR v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Unauthorized: Status captured cannot be set directly' THEN
      RAISE EXCEPTION '4D TRIGGER FAILURE [UPDATE failed->captured]: threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
    END IF;
  END IF;

  -- 4c. Trigger blocks forged invoice_number on INSERT ('pending') with JWT role='authenticated'
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, invoice_number)
    VALUES (v_stu1, 'course', 'c_trg', 'Forged Inv Pending', 100.00, 'INR', 'ord_trg_inv', 'pay_trg_inv', 'pending', 'DM/26-27/FORGED');
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Unauthorized: invoice_number cannot be supplied directly on INSERT' THEN
    RAISE EXCEPTION '4D TRIGGER FAILURE [INSERT forged invoice]: threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  -- 4d. Trigger blocks tampering with an already-issued invoice_number with JWT role='authenticated'
  v_threw := FALSE; v_sqlstate := NULL; v_errm := NULL;
  BEGIN
    UPDATE public.payments SET invoice_number = 'DM/26-27/TAMPER' WHERE id = v_pay1_id;
  EXCEPTION WHEN OTHERS THEN
    v_threw := TRUE; v_sqlstate := SQLSTATE; v_errm := SQLERRM;
  END;
  IF NOT v_threw OR v_sqlstate IS DISTINCT FROM 'P0001' OR v_errm !~* '^Unauthorized: Issued invoice_number cannot be cleared or replaced' THEN
    RAISE EXCEPTION '4D TRIGGER FAILURE [UPDATE invoice_number]: threw=% SQLSTATE=% ERRM=%', v_threw, v_sqlstate, v_errm;
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  RAISE NOTICE 'PASS [4D]: RLS isolation (% own CN / 0 other), 42501 grants, and P0001 trigger protections verified.', v_visible_own_cn;
END $$;

ROLLBACK;

\endif

-- ==============================================================================
-- 5. MULTI-SESSION CONCURRENCY TEST PLAN (NOT EXECUTABLE IN ONE SESSION)
-- ==============================================================================
-- Single-transaction SQL CANNOT observe lock waits, uncommitted MVCC snapshots,
-- or concurrent unique-index collisions. Run these 4 two-session tests in
-- separate `psql` terminals against a freshly seeded `digitalmuid_v43_legacy_test`
-- after Phase A + Phase B complete (`verify_stage=post_b` passed).
-- Reset test rows cleanly or re-seed `v4_3_isolated_legacy_fixture.sql` +
-- Phase A + Phase B between runs.
--
-- ------------------------------------------------------------------------------
-- SCENARIO C1: Same payment (`pay_leg_101`), two DIFFERENT `refund_id`s concurrently
-- Baseline: pay_leg_101 amount=1000.00, prior=400.00 -> remaining=600.00
-- ------------------------------------------------------------------------------
-- -- [Session A]
--   BEGIN;
--   SELECT credit_note_number, amount, remaining_balance, is_idempotent_duplicate
--   FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_c1_a', 250.00);
--   -- Expected immediately in A: remaining_balance = 350.00, is_idempotent_duplicate = false
--   -- PAUSE before COMMIT!
--
-- -- [Session B] (while Session A is open before COMMIT)
--   BEGIN;
--   SELECT credit_note_number, amount, remaining_balance, is_idempotent_duplicate
--   FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_c1_b', 150.00);
--   -- Expected: Session B BLOCKS waiting on FOR UPDATE lock on pay_leg_101.
--
-- -- [Session A]
--   COMMIT;
--   -- Expected unblocked Session B output: remaining_balance = 200.00 (600 - 250 - 150),
--   -- is_idempotent_duplicate = false, DISTINCT credit_note_number.
-- -- [Session B]
--   COMMIT;
--
-- ------------------------------------------------------------------------------
-- SCENARIO C2: Same payment + SAME `refund_id` submitted concurrently
-- ------------------------------------------------------------------------------
-- -- [Session A]
--   BEGIN;
--   SELECT credit_note_number, is_idempotent_duplicate, remaining_balance
--   FROM public.record_credit_note_with_limit('pay_leg_102', 'rfnd_c2_same', 300.00);
--   -- PAUSE before COMMIT! (Note current credit_note_series.last_sequence)
--
-- -- [Session B] (while Session A is open before COMMIT)
--   BEGIN;
--   SELECT credit_note_number, is_idempotent_duplicate, remaining_balance
--   FROM public.record_credit_note_with_limit('pay_leg_102', 'rfnd_c2_same', 300.00);
--   -- Expected: Session B BLOCKS on FOR UPDATE lock (no duplicate sequence advance yet).
--
-- -- [Session A]
--   COMMIT;
--   -- Expected unblocked Session B output: IDENTICAL credit_note_number to A,
--   -- is_idempotent_duplicate = TRUE, remaining_balance identical to A (1200.00),
--   -- credit_note_series incremented ONLY ONCE across both sessions.
-- -- [Session B]
--   COMMIT;
--
-- ------------------------------------------------------------------------------
-- SCENARIO C3: Same `refund_id` concurrently submitted for TWO DIFFERENT payments
-- ------------------------------------------------------------------------------
-- -- [Session A]
--   BEGIN;
--   SELECT * FROM public.record_credit_note_with_limit('pay_leg_101', 'rfnd_c3_cross', 100.00);
--   -- COMMIT Session A first (or run concurrently using a second payment lock order)
--   COMMIT;
--
-- -- [Session B]
--   BEGIN;
--   SELECT * FROM public.record_credit_note_with_limit('pay_leg_102', 'rfnd_c3_cross', 100.00);
--   -- Expected FAILURE (SQLSTATE P0001):
--   -- "Refund ID rfnd_c3_cross is already associated with another payment (pay_leg_101)
--   --  and cannot be reused for payment pay_leg_102."
--   ROLLBACK;
--
-- -- True concurrent race variant (Session A holds lock on pay_leg_102, OR two txns race
-- -- into unique_violation on idx_credit_notes_refund_id):
-- -- Session A inserts 'rfnd_c3_race' on pay_leg_101 and commits while Session B locked
-- -- pay_leg_102 first -> Session B hits EXCEPTION WHEN unique_violation, recovers row,
-- -- sees payment_id='pay_leg_101' != 'pay_leg_102', and raises P0001 cross-payment error!
--
-- ------------------------------------------------------------------------------
-- SCENARIO C4: Concurrent partial refunds whose COMBINED amount exceeds payment total
-- Baseline on pay_leg_102: amount=2000.00, prior=500.00 (+ C2 300 if not reset)
-- Assuming clean baseline (remaining = 1500.00):
-- ------------------------------------------------------------------------------
-- -- [Session A]
--   BEGIN;
--   SELECT credit_note_number, amount, remaining_balance
--   FROM public.record_credit_note_with_limit('pay_leg_102', 'rfnd_c4_over_a', 900.00);
--   -- Expected in A: remaining_balance = 600.00. PAUSE before COMMIT!
--
-- -- [Session B] (while Session A holds FOR UPDATE lock on pay_leg_102)
--   BEGIN;
--   SELECT credit_note_number, amount, remaining_balance
--   FROM public.record_credit_note_with_limit('pay_leg_102', 'rfnd_c4_over_b', 800.00);
--   -- Combined 900 + 800 = 1700 > 1500 remaining! Session B BLOCKS waiting on lock.
--
-- -- [Session A]
--   COMMIT;
--   -- Expected unblocked Session B FAILURE (SQLSTATE P0001):
--   -- "Refund amount 800.00 exceeds remaining eligible refundable balance of 600.00 ..."
--   -- Verify total credit_notes sum for pay_leg_102 <= 2000.00.
-- -- [Session B]
--   ROLLBACK;
