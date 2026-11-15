-- ==============================================================================
-- DIGITALMUID V4.3 — ISOLATED NEGATIVE & CORRUPTION FIXTURES (MANUAL TEST SUITE)
-- File: supabase/tests/v4_3_isolated_negative_fixtures.sql
-- ==============================================================================
-- PURPOSE:
-- Manual, isolated negative scenarios verifying that Phase A migration, Phase B
-- preflight, and the Phase A credit-note RPC FAIL CLOSED on corrupted historical
-- data, unapproved status constraints, invalid RPC inputs, and misconfigured
-- pre-existing indexes.
--
-- IMPORTANT — MANUAL EXECUTION ONLY:
-- - Every test case (N1a–N5f) below is commented out by design as a MANUAL test.
-- - Sourcing this file directly ONLY runs Section 0 (fail-closed environment guard)
--   and performs ZERO mutations and ZERO automatic negative test assertions.
-- - NEVER apply two negative scenarios on top of each other. Before running any
--   single scenario, reset `digitalmuid_v43_legacy_test` cleanly with:
--     psql ... -d digitalmuid_v43_legacy_test -f supabase/tests/v4_3_isolated_legacy_fixture.sql
--   so every scenario starts from the exact clean legacy baseline.
--
-- SAFETY:
-- - Run ONLY inside dedicated disposable local DB `digitalmuid_v43_legacy_test`.
-- - NEVER execute against production, staging, or any hosted Supabase DB.
-- - LOCAL DOCKER BRIDGE OPT-IN (Optional, disabled by default):
--   By default ONLY local Unix domain sockets or loopback (127.0.0.0/8, ::1) are
--   permitted; private RFC1918 VPC/RDS/cloud IPs are REJECTED fail-closed.
--   If connecting over a local Docker bridge network ONLY, pass BOTH flags:
--     -v allow_local_docker_bridge=true -v local_docker_cidr=172.17.0.0/16
-- ==============================================================================

\set ON_ERROR_STOP on

\if :{?allow_local_docker_bridge}
  SELECT pg_catalog.set_config('digitalmuid.allow_local_docker_bridge', :'allow_local_docker_bridge', false) AS docker_bridge_opt_in;
\else
  SELECT pg_catalog.set_config('digitalmuid.allow_local_docker_bridge', 'false', false) AS docker_bridge_opt_in;
\endif

\if :{?local_docker_cidr}
  SELECT pg_catalog.set_config('digitalmuid.local_docker_cidr', :'local_docker_cidr', false) AS docker_bridge_cidr;
\else
  SELECT pg_catalog.set_config('digitalmuid.local_docker_cidr', '', false) AS docker_bridge_cidr;
\endif

-- 0. FAIL-CLOSED ENVIRONMENT & DATABASE IDENTITY GUARD (RUNS ALWAYS; NON-DESTRUCTIVE)
DO $$
DECLARE
  v_db_name TEXT := NULLIF(pg_catalog.btrim(pg_catalog.current_database()::text), '');
  v_cur_user TEXT := NULLIF(pg_catalog.btrim(current_user::text), '');
  v_sess_user TEXT := NULLIF(pg_catalog.btrim(session_user::text), '');
  v_srv_version TEXT := NULLIF(pg_catalog.btrim(pg_catalog.version()), '');
  v_srv_addr INET := pg_catalog.inet_server_addr();
  v_srv_port INTEGER := pg_catalog.inet_server_port();
  v_client_addr INET;
  v_backend_type TEXT;
  v_cluster TEXT := COALESCE(NULLIF(pg_catalog.btrim(pg_catalog.current_setting('cluster_name', true)), ''), '<unset>');
  v_allow_docker TEXT := pg_catalog.current_setting('digitalmuid.allow_local_docker_bridge', true);
  v_docker_cidr_txt TEXT := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('digitalmuid.local_docker_cidr', true)), '');
  v_docker_cidr CIDR := NULL;
BEGIN
  IF v_db_name IS NULL OR v_cur_user IS NULL OR v_sess_user IS NULL OR v_srv_version IS NULL THEN
    RAISE EXCEPTION 'SAFETY HALT: Cannot establish required PostgreSQL identity (db=%, current_user=%, session_user=%, version=%).',
      COALESCE(v_db_name, '<null>'), COALESCE(v_cur_user, '<null>'), COALESCE(v_sess_user, '<null>'), COALESCE(v_srv_version, '<null>');
  END IF;

  IF v_srv_version !~ '^PostgreSQL ' THEN
    RAISE EXCEPTION 'SAFETY HALT: Unexpected server version "%".', v_srv_version;
  END IF;

  IF v_allow_docker IS NULL OR v_allow_docker NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'SAFETY HALT: Transport policy (digitalmuid.allow_local_docker_bridge=%) missing or invalid. Run via psql with ON_ERROR_STOP=1.',
      COALESCE(v_allow_docker, '<null>');
  END IF;

  SELECT sa.client_addr, sa.backend_type
  INTO v_client_addr, v_backend_type
  FROM pg_catalog.pg_stat_activity sa
  WHERE sa.pid = pg_catalog.pg_backend_pid();

  IF NOT FOUND OR v_backend_type IS NULL OR v_backend_type <> 'client backend' THEN
    RAISE EXCEPTION 'SAFETY HALT: Cannot verify current backend identity in pg_catalog.pg_stat_activity (pid=%).',
      pg_catalog.pg_backend_pid();
  END IF;

  IF v_db_name IS DISTINCT FROM 'digitalmuid_v43_legacy_test' THEN
    RAISE EXCEPTION 'SAFETY HALT: v4_3_isolated_negative_fixtures.sql requires current_database() = "digitalmuid_v43_legacy_test", got "%". Refusing execution.',
      v_db_name;
  END IF;

  IF EXISTS (
       SELECT 1 FROM pg_catalog.pg_namespace
       WHERE nspname IN (
         'supabase_migrations', 'supabase_functions', 'realtime',
         'storage', 'vault', 'graphql', 'graphql_public', 'pgsodium'
       )
     )
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname IN (
         'supabase_auth_admin', 'supabase_storage_admin', 'supabase_realtime_admin',
         'supabase_read_only_user', 'supabase_replication_admin', 'authenticator',
         'pgbouncer', 'cli_login_postgres'
       )
     )
     OR v_db_name ~* 'kpuxtsworzkueyffjaaz|supabase'
     OR v_cur_user ~* 'kpuxtsworzkueyffjaaz'
     OR v_sess_user ~* 'kpuxtsworzkueyffjaaz'
     OR v_cluster ~* 'supabase|kpuxtsworzkueyffjaaz' THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase environment or forbidden project reference detected (db=%, user=%, cluster=%).',
      v_db_name, v_cur_user, v_cluster;
  END IF;

  IF (v_srv_addr IS NULL) IS DISTINCT FROM (v_srv_port IS NULL) THEN
    RAISE EXCEPTION 'SAFETY HALT: Inconsistent server endpoint identity (addr=%, port=%).',
      COALESCE(v_srv_addr::text, '<null>'), COALESCE(v_srv_port::text, '<null>');
  END IF;

  IF v_srv_addr IS NULL THEN
    IF v_client_addr IS NOT NULL THEN
      RAISE EXCEPTION 'SAFETY HALT: Inconsistent Unix socket identity (server addr NULL, client_addr=%).', v_client_addr;
    END IF;
  ELSE
    IF v_srv_port < 1 OR v_srv_port > 65535 THEN
      RAISE EXCEPTION 'SAFETY HALT: Invalid server TCP port %.', v_srv_port;
    END IF;

    IF v_srv_addr << '127.0.0.0/8'::inet OR v_srv_addr = '::1'::inet THEN
      IF v_client_addr IS NULL OR NOT (v_client_addr << '127.0.0.0/8'::inet OR v_client_addr = '::1'::inet) THEN
        RAISE EXCEPTION 'SAFETY HALT: Loopback server %:% received non-loopback client_addr %.',
          v_srv_addr, v_srv_port, COALESCE(v_client_addr::text, '<null>');
      END IF;
    ELSIF v_allow_docker = 'true' THEN
      IF v_docker_cidr_txt IS NULL THEN
        RAISE EXCEPTION 'SAFETY HALT: allow_local_docker_bridge=true requires explicit -v local_docker_cidr=<CIDR> (e.g. 172.17.0.0/16).';
      END IF;

      BEGIN
        v_docker_cidr := v_docker_cidr_txt::cidr;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'SAFETY HALT: Invalid local_docker_cidr "%" (%).', v_docker_cidr_txt, SQLERRM;
      END;

      IF pg_catalog.masklen(v_docker_cidr) < 16
         OR NOT (
           v_docker_cidr <<= '172.16.0.0/12'::inet
           OR v_docker_cidr <<= '192.168.0.0/16'::inet
           OR v_docker_cidr <<= '10.0.0.0/8'::inet
         ) THEN
        RAISE EXCEPTION 'SAFETY HALT: local_docker_cidr "%" must be an explicit RFC1918 subnet with prefix >= /16.', v_docker_cidr;
      END IF;

      IF NOT (v_srv_addr <<= v_docker_cidr) THEN
        RAISE EXCEPTION 'SAFETY HALT: Server IP %:% is outside approved local_docker_cidr %.',
          v_srv_addr, v_srv_port, v_docker_cidr;
      END IF;

      IF v_client_addr IS NULL
         OR NOT (
           v_client_addr << '127.0.0.0/8'::inet
           OR v_client_addr = '::1'::inet
           OR v_client_addr <<= v_docker_cidr
         ) THEN
        RAISE EXCEPTION 'SAFETY HALT: Docker bridge server %:% rejected non-local client_addr %.',
          v_srv_addr, v_srv_port, COALESCE(v_client_addr::text, '<null>');
      END IF;
    ELSE
      RAISE EXCEPTION 'SAFETY HALT: Server IP %:% is NOT Unix socket or loopback (127.0.0.0/8, ::1). Private RFC1918 IPs are blocked by default. For local Docker bridge only, pass -v allow_local_docker_bridge=true -v local_docker_cidr=<subnet/prefix>.',
        v_srv_addr, v_srv_port;
    END IF;
  END IF;

  IF v_cur_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'SAFETY HALT: Execute fixture as local superuser/postgres role, not "%".', v_cur_user;
  END IF;

  RAISE NOTICE 'NEGATIVE FIXTURE SUITE GUARD PASSED: db=% (no commented manual test executed automatically).', v_db_name;
END $$;

-- ==============================================================================
-- LEGACY FIXTURE REFERENCE IDS (from supabase/tests/v4_3_isolated_legacy_fixture.sql)
--   Student 1: 10000000-0000-4000-8000-000000000001
--   Student 2: 10000000-0000-4000-8000-000000000002
--   pay_leg_101 (id=30000000-0000-4000-8000-000000000101): user=stu1, 1000.00 INR, inv=' DM/26-27/0003 ', prior=400.00 INR
--   pay_leg_102 (id=30000000-0000-4000-8000-000000000102): user=stu2, 2000.00 INR, inv='DM/26-27/0004', prior=500.00 INR
--   pay_leg_103 (id=30000000-0000-4000-8000-000000000103): user=stu1,  500.00 INR, inv='DM/26-27/0005', prior=500.00 INR (refunded)
--   pay_leg_104 (id=30000000-0000-4000-8000-000000000104): user=stu2,  999.00 INR, inv=NULL, status='failed'
-- ==============================================================================

-- ==============================================================================
-- CASE N1: BLANK / NULL / NaN / >2-DECIMAL HISTORICAL DATA & INVALID RPC PRECISION
-- (MANUAL TESTS — RUN ONE SUB-SCENARIO PER CLEAN BASELINE)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MANUAL TEST N1a: Blank payment_id in historical credit_notes
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 1):
--   "Migration halt (fail-closed historical audit): Found 1 public.credit_notes
--    row(s) with NULL or blank payment_id, refund_id, credit_note_number,
--    original_invoice_number, or currency."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '41000000-0000-4000-8000-000000000001', 'CN/26-27/0091', 'DM/26-27/0003', '   ',
--   '10000000-0000-4000-8000-000000000001', 'rfnd_bad_blank_pid', 'Manual test N1a blank payment_id',
--   100.00, 84.75, 15.25, 'INR', true, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N1b: Explicit NULL amount in historical credit_notes
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 2):
--   "Migration halt (fail-closed historical audit): Found 1 public.credit_notes
--    row(s) with missing or invalid amount/base_amount/tax_amount."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '41000000-0000-4000-8000-000000000004', 'CN/26-27/0098', 'DM/26-27/0003', 'pay_leg_101',
--   '10000000-0000-4000-8000-000000000001', 'rfnd_bad_null_amt', 'Manual test N1b NULL amount',
--   NULL, 84.75, 15.25, 'INR', true, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N1c: NaN amount in historical credit_notes
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 2):
--   "Migration halt (fail-closed historical audit): Found 1 public.credit_notes
--    row(s) with missing or invalid amount/base_amount/tax_amount."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '41000000-0000-4000-8000-000000000002', 'CN/26-27/0092', 'DM/26-27/0003', 'pay_leg_101',
--   '10000000-0000-4000-8000-000000000001', 'rfnd_bad_nan', 'Manual test N1c NaN amount',
--   'NaN'::NUMERIC, 84.75, 15.25, 'INR', true, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N1d: Invalid >2-decimal historical credit_notes.amount (wider scale)
-- Note: Standard legacy credit_notes.amount is NUMERIC(10,2), which silently rounds
--       10.125 to 10.13 on INSERT. This isolated test widens ONLY credit_notes.amount
--       to NUMERIC(12,4) (still passes Phase A Section 2 precision>=10, scale>=2)
--       so 10.1250 reaches Phase A Section 6 Step 2 unrounded.
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 2):
--   "Migration halt (fail-closed historical audit): Found 1 public.credit_notes
--    row(s) with missing or invalid amount/base_amount/tax_amount."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.credit_notes
--   ALTER COLUMN amount TYPE NUMERIC(12, 4);
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '41000000-0000-4000-8000-000000000003', 'CN/26-27/0093', 'DM/26-27/0003', 'pay_leg_101',
--   '10000000-0000-4000-8000-000000000001', 'rfnd_bad_hist_3dec', 'Manual test N1d 3-decimal historical amount',
--   10.1250, 8.58, 1.55, 'INR', true, '2026-04-20T10:00:00Z'
-- );
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM public.credit_notes
--     WHERE id = '41000000-0000-4000-8000-000000000003'
--       AND amount = 10.1250
--       AND pg_catalog.round(amount, 2) IS DISTINCT FROM amount
--   ) THEN
--     RAISE EXCEPTION 'SETUP FAILURE N1d: Expected unrounded 10.1250 in credit_notes.amount.';
--   END IF;
-- END $$;
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N1e: Invalid >2-decimal RPC input precision (Post-Phase-A + Post-Phase-B)
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql -> Phase A -> Phase B.
-- Expected Runtime Failure (SQLSTATE P0001 in record_credit_note_with_limit):
--   "Invalid refund amount 10.125: Amount must be a finite positive number with
--    at most two decimal places."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- SELECT * FROM public.record_credit_note_with_limit(
--   'pay_leg_101',
--   'rfnd_bad_rpc_3dec',
--   10.125,
--   'Manual test N1e 3-decimal RPC input'
-- );
-- ROLLBACK;


-- ==============================================================================
-- CASE N2: ORPHANED & AMBIGUOUSLY LINKED HISTORICAL credit_notes ROWS
-- (MANUAL TESTS — RUN ONE SUB-SCENARIO PER CLEAN BASELINE)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MANUAL TEST N2a: Orphaned historical credit note (payment_id missing in payments)
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 3):
--   "Migration halt (fail-closed historical audit): Found 1 orphan or ambiguously
--    linked public.credit_notes row(s) that cannot be mapped 1-to-1 to public.payments."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '42000000-0000-4000-8000-000000000001', 'CN/26-27/0094', 'DM/26-27/0003', 'pay_orphan_missing',
--   '10000000-0000-4000-8000-000000000001', 'rfnd_orphan_1', 'Manual test N2a orphan payment_id',
--   100.00, 84.75, 15.25, 'INR', true, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N2b: Ambiguous payment collision (razorpay_payment_id collides with pay_leg_101 UUID)
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 3):
--   "Migration halt (fail-closed historical audit): Found 1 orphan or ambiguously
--    linked public.credit_notes row(s) that cannot be mapped 1-to-1 to public.payments."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.payments (
--   id, user_id, item_type, item_id, item_title, amount, currency,
--   razorpay_order_id, razorpay_payment_id, invoice_number, status, created_at
-- ) VALUES (
--   '30000000-0000-4000-8000-000000000199', '10000000-0000-4000-8000-000000000001',
--   'course', '90000000-0000-4000-8000-000000000001', 'Ambiguous Collision Row',
--   500.00, 'INR', 'order_ambig', '30000000-0000-4000-8000-000000000101', 'DM/26-27/0099',
--   'captured', '2026-04-19T10:00:00Z'
-- );
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '42000000-0000-4000-8000-000000000002', 'CN/26-27/0095', 'DM/26-27/0003',
--   '30000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001',
--   'rfnd_ambig_1', 'Manual test N2b ambiguous UUID collision',
--   100.00, 84.75, 15.25, 'INR', true, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;


-- ==============================================================================
-- CASE N3: CUMULATIVE OVER-REFUND vs. CURRENCY MISMATCH (SEPARATE SCENARIOS)
-- (MANUAL TESTS — RUN ONE SUB-SCENARIO PER CLEAN BASELINE)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MANUAL TEST N3a: Cumulative historical over-refund ONLY (matching INR currency)
-- Baseline: pay_leg_101 = 1000.00 INR, prior refund = 400.00 INR. Adding 700.00 INR
--           yields cumulative 1100.00 INR > 1000.00 INR.
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 4):
--   "Migration halt (fail-closed historical audit): Found 1 payment(s) whose
--    historical credit_notes exceed payment amount or mismatch currency."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '43000000-0000-4000-8000-000000000001', 'CN/26-27/0096', 'DM/26-27/0003', 'pay_leg_101',
--   '10000000-0000-4000-8000-000000000001', 'rfnd_over_1', 'Manual test N3a cumulative over-refund',
--   700.00, 593.22, 106.78, 'INR', false, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N3b: Historical currency mismatch ONLY (within payment balance)
-- Baseline: pay_leg_102 = 2000.00 INR, prior refund = 500.00 INR (remaining 1500.00).
--           Adding 100.00 USD stays numerically <= 2000.00 so ONLY currency mismatches.
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 6 Step 4):
--   "Migration halt (fail-closed historical audit): Found 1 payment(s) whose
--    historical credit_notes exceed payment amount or mismatch currency."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (
--   id, credit_note_number, original_invoice_number, payment_id, user_id,
--   refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
-- ) VALUES (
--   '43000000-0000-4000-8000-000000000002', 'CN/26-27/0097', 'DM/26-27/0004', 'pay_leg_102',
--   '10000000-0000-4000-8000-000000000002', 'rfnd_curr_mismatch', 'Manual test N3b currency mismatch',
--   100.00, 84.75, 15.25, 'USD', true, '2026-04-20T10:00:00Z'
-- );
-- COMMIT;


-- ==============================================================================
-- CASE N4: UNAPPROVED MULTI-COLUMN CHECK vs. UNRECOGNIZED STATUS (SEPARATE TESTS)
-- (MANUAL TESTS — RUN ONE SUB-SCENARIO PER CLEAN BASELINE)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MANUAL TEST N4a: Unapproved multi-column status CHECK constraint ONLY
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 1 Step 1A):
--   "Migration halt: Unapproved CHECK constraint chk_unapproved_status_amount (...)
--    references public.payments.status. Inspect manually before proceeding."
--   Entire Phase A transaction rolls back atomically; no constraints are left dropped.
-- ------------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.payments
--   ADD CONSTRAINT chk_unapproved_status_amount CHECK (status <> 'captured' OR amount > 0);
-- COMMIT;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N4b: Unrecognized legacy payments.status value ONLY
-- Target row: pay_leg_104 (30000000-0000-4000-8000-000000000104, status='failed').
-- Prerequisite: Clean v4_3_isolated_legacy_fixture.sql (BEFORE Phase A).
-- Expected Phase A Failure (Section 1 Step 1B):
--   "Migration halt: Found 1 public.payments row(s) with unrecognized status outside
--    lifecycle enum. Reconcile before adding chk_payments_status."
-- ------------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
-- UPDATE public.payments
-- SET status = 'chargeback_manual'
-- WHERE id = '30000000-0000-4000-8000-000000000104'
--   AND razorpay_payment_id = 'pay_leg_104';
-- COMMIT;


-- ==============================================================================
-- CASE N5: MISCONFIGURED PRE-EXISTING INDEXES (PHASE B PREFLIGHT & RPC GATE)
-- (MANUAL TESTS — RUN ONE SUB-SCENARIO PER CLEAN BASELINE)
-- ==============================================================================
-- CLARIFICATION OF PHASE A vs. PHASE B FAILURE BOUNDARIES:
-- 1. Phase A MIGRATION execution (20261107000001_student_id_and_invoices.sql)
--    does NOT validate Phase B indexes while applying DDL/backfill/functions.
-- 2. Phase B MIGRATION preflight (20261107000002_concurrent_indexes.sql, Sec. 1B)
--    validates ALL 8 intended indexes BEFORE CREATE [UNIQUE] INDEX CONCURRENTLY and
--    HALTS on wrong table, wrong column, wrong uniqueness, expression index, invalid/
--    unready state, or missing/wrong partial BTRIM predicate.
-- 3. Phase A RPC runtime gate (public.record_credit_note_with_limit(), lines 623–701)
--    validates BOTH critical credit-note gate indexes (`idx_credit_notes_number` and
--    `idx_credit_notes_refund_id`) at RUNTIME and HALTS if either is missing/wrong.
--
-- Recommended order per N5* sub-scenario:
--   Reset with v4_3_isolated_legacy_fixture.sql -> Run Phase A migration (succeeds) ->
--   Uncomment & run ONE N5* DDL statement -> Verify BOTH Phase B preflight fails AND
--   (for N5a–N5e) record_credit_note_with_limit() fails at runtime!
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MANUAL TEST N5a: Wrong target table for idx_credit_notes_refund_id (on payments)
-- Expected Failures:
--   - Phase B preflight: HALTS ("Existing index public.idx_credit_notes_refund_id
--     has mismatched table/column/uniqueness/predicate").
--   - Phase A RPC runtime gate: HALTS ("Index public.idx_credit_notes_refund_id
--     targets public.payments instead of public.credit_notes").
-- ------------------------------------------------------------------------------
-- CREATE UNIQUE INDEX idx_credit_notes_refund_id
--   ON public.payments (razorpay_payment_id)
--   WHERE razorpay_payment_id IS NOT NULL AND BTRIM(razorpay_payment_id, E' \t\n\r\f\v') != '';

-- ------------------------------------------------------------------------------
-- MANUAL TEST N5b: Wrong column for idx_credit_notes_number (original_invoice_number)
-- Note: Uses original_invoice_number (unique across the 3 seeded legacy credit_notes)
--       so CREATE UNIQUE INDEX succeeds and the column check is exercised cleanly.
-- Expected Failures:
--   - Phase B preflight: HALTS ("Existing index public.idx_credit_notes_number
--     has mismatched table/column/uniqueness/predicate").
--   - Phase A RPC runtime gate: HALTS ("Index public.idx_credit_notes_number
--     does not exclusively index column public.credit_notes.(credit_note_number)").
-- ------------------------------------------------------------------------------
-- CREATE UNIQUE INDEX idx_credit_notes_number
--   ON public.credit_notes (original_invoice_number)
--   WHERE original_invoice_number IS NOT NULL AND BTRIM(original_invoice_number, E' \t\n\r\f\v') != '';

-- ------------------------------------------------------------------------------
-- MANUAL TEST N5c: Non-unique index where UNIQUE is required (idx_credit_notes_refund_id)
-- Expected Failures:
--   - Phase B preflight: HALTS ("mismatched table/column/uniqueness/predicate").
--   - Phase A RPC runtime gate: HALTS ("Index public.idx_credit_notes_refund_id is NOT unique").
-- ------------------------------------------------------------------------------
-- CREATE INDEX idx_credit_notes_refund_id
--   ON public.credit_notes (refund_id)
--   WHERE refund_id IS NOT NULL AND BTRIM(refund_id, E' \t\n\r\f\v') != '';

-- ------------------------------------------------------------------------------
-- MANUAL TEST N5d: Full unique index missing partial predicate (idx_credit_notes_refund_id)
-- Expected Failures:
--   - Phase B preflight: HALTS ("mismatched table/column/uniqueness/predicate").
--   - Phase A RPC runtime gate: HALTS ("has missing or incorrect partial predicate (<none>)").
-- ------------------------------------------------------------------------------
-- CREATE UNIQUE INDEX idx_credit_notes_refund_id
--   ON public.credit_notes (refund_id);

-- ------------------------------------------------------------------------------
-- MANUAL TEST N5e: Incomplete partial predicate (IS NOT NULL without BTRIM != '')
-- Expected Failures:
--   - Phase B preflight: HALTS ("mismatched table/column/uniqueness/predicate").
--   - Phase A RPC runtime gate: HALTS ("has missing or incorrect partial predicate").
-- ------------------------------------------------------------------------------
-- CREATE UNIQUE INDEX idx_credit_notes_refund_id
--   ON public.credit_notes (refund_id)
--   WHERE refund_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- MANUAL TEST N5f: Misconfigured non-gate Phase B index (idx_payments_invoice_number)
-- Demonstrates Phase B preflight validates all 8 indexes while Phase A RPC runtime
-- gate enforces only idx_credit_notes_number and idx_credit_notes_refund_id.
-- Expected Failure:
--   - Phase B preflight: HALTS ("Existing index public.idx_payments_invoice_number
--     has mismatched table/column/uniqueness/predicate").
--   - Phase A RPC runtime gate: Checks idx_credit_notes_number & idx_credit_notes_refund_id
--     only (will report missing Phase B credit-note indexes if they are not yet built).
-- ------------------------------------------------------------------------------
-- CREATE UNIQUE INDEX idx_payments_invoice_number
--   ON public.payments (invoice_number)
--   WHERE invoice_number IS NOT NULL;
