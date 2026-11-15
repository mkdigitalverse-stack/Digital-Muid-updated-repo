-- ==============================================================================
-- DIGITALMUID V4.3 — ISOLATED POSTGRESQL LEGACY-SCHEMA FIXTURE (STANDALONE)
-- File: supabase/tests/v4_3_isolated_legacy_fixture.sql
-- ==============================================================================
-- PURPOSE:
-- Standalone legacy-database initializer for dedicated database
-- `digitalmuid_v43_legacy_test` simulating an existing pre-V4.3 staging DB:
--   1. Minimal auth schema, roles, public.is_admin(), resource_purchases & bookings.
--   2. Restrictive inline CHECK constraint: payments_status_check
--      CHECK (status IN ('captured', 'refunded', 'failed'))
--   3. Unrelated CHECK constraint (chk_payments_amount_positive) that MUST remain intact.
--   4. Legacy nullable public.credit_notes table missing column defaults and NOT NULLs.
--   5. Valid historical payments & credit notes (control whitespace, mixed UUID/pay_*
--      payment_id linkage, lowercase currency) + sequence edge cases covering BOTH
--      is_called = false (10001) and is_called = true (10050).
--
-- EXECUTION TARGET:
-- Run ONLY inside dedicated legacy test database `digitalmuid_v43_legacy_test`.
-- NEVER apply v4_3_isolated_bootstrap_fresh.sql and this fixture to the same database.
-- NEVER execute against production or any hosted Supabase DB.
-- LOCAL DOCKER BRIDGE OPT-IN (Optional, disabled by default):
-- By default ONLY local Unix domain sockets or loopback (127.0.0.0/8, ::1) are
-- permitted; private RFC1918 VPC/RDS/cloud IPs are REJECTED fail-closed.
-- If connecting over a local Docker bridge network ONLY, pass BOTH flags:
--   -v allow_local_docker_bridge=true -v local_docker_cidr=172.17.0.0/16
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

-- 0. FAIL-CLOSED ENVIRONMENT & DATABASE IDENTITY GUARD (BEFORE ANY DDL/DROP/EXTENSION)
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
  -- 0A. Fail closed if required session or server identity cannot be established
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

  -- 0B. Require EXACT legacy test database name
  IF v_db_name IS DISTINCT FROM 'digitalmuid_v43_legacy_test' THEN
    RAISE EXCEPTION 'SAFETY HALT: v4_3_isolated_legacy_fixture.sql requires current_database() = "digitalmuid_v43_legacy_test", got "%". Refusing execution.',
      v_db_name;
  END IF;

  -- 0C. Deny hosted Supabase namespaces, roles, and project identifiers
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

  -- 0D. Strict server identity check (Unix socket or loopback ONLY; no automatic RFC1918 trust)
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

  -- 0E. Reject unprivileged runtime roles
  IF v_cur_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'SAFETY HALT: Execute fixture as local superuser/postgres role, not "%".', v_cur_user;
  END IF;

  RAISE NOTICE 'ISOLATED LEGACY GUARD PASSED: db=%, current_user=%, session_user=%, server=%:%, client=%, docker_opt_in=%, cluster=% (NOT a standalone safety guarantee).',
    v_db_name, v_cur_user, v_sess_user,
    COALESCE(v_srv_addr::text, 'unix-socket'), COALESCE(v_srv_port::text, 'local'),
    COALESCE(v_client_addr::text, 'unix-socket'), v_allow_docker, v_cluster;
END $$;

BEGIN;

-- 1. Cluster-Wide Role Validation & Creation (Fail Closed; Never Modify Shared Roles)
-- Pass 1 validates ALL existing cluster roles BEFORE creating any missing role,
-- loading extensions, or dropping any schema/table.
DO $$
DECLARE
  v_spec RECORD;
  v_role RECORD;
BEGIN
  -- Pass 1: Validate any pre-existing roles without mutating anything
  FOR v_spec IN
    SELECT * FROM (
      VALUES
        ('anon',           FALSE, FALSE, FALSE),
        ('authenticated',  FALSE, FALSE, FALSE),
        ('service_role',   FALSE, FALSE, TRUE),
        ('supabase_admin', FALSE, FALSE, TRUE)
    ) AS t(role_name, exp_login, exp_super, exp_bypassrls)
  LOOP
    SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls
    INTO v_role
    FROM pg_catalog.pg_roles r
    WHERE r.rolname = v_spec.role_name;

    IF FOUND THEN
      IF v_role.rolcanlogin IS DISTINCT FROM v_spec.exp_login
         OR v_role.rolsuper IS DISTINCT FROM v_spec.exp_super
         OR v_role.rolbypassrls IS DISTINCT FROM v_spec.exp_bypassrls THEN
        RAISE EXCEPTION 'SAFETY HALT: Existing cluster role "%" has incompatible attributes (rolcanlogin=%, rolsuper=%, rolbypassrls=%). Expected (rolcanlogin=%, rolsuper=%, rolbypassrls=%). Refusing to modify shared cluster roles automatically.',
          v_spec.role_name,
          v_role.rolcanlogin, v_role.rolsuper, v_role.rolbypassrls,
          v_spec.exp_login, v_spec.exp_super, v_spec.exp_bypassrls;
      END IF;
    END IF;
  END LOOP;

  -- Pass 2: Create only missing roles with exact least-privilege attributes
  FOR v_spec IN
    SELECT * FROM (
      VALUES
        ('anon',           FALSE, FALSE, FALSE),
        ('authenticated',  FALSE, FALSE, FALSE),
        ('service_role',   FALSE, FALSE, TRUE),
        ('supabase_admin', FALSE, FALSE, TRUE)
    ) AS t(role_name, exp_login, exp_super, exp_bypassrls)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = v_spec.role_name) THEN
      EXECUTE pg_catalog.format(
        'CREATE ROLE %I %s %s %s',
        v_spec.role_name,
        CASE WHEN v_spec.exp_login THEN 'LOGIN' ELSE 'NOLOGIN' END,
        CASE WHEN v_spec.exp_super THEN 'SUPERUSER' ELSE 'NOSUPERUSER' END,
        CASE WHEN v_spec.exp_bypassrls THEN 'BYPASSRLS' ELSE 'NOBYPASSRLS' END
      );
    END IF;
  END LOOP;
END $$;

-- 2. Extensions & Clean Standalone Legacy Reset (Deterministic on Re-Runs)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.record_credit_note_with_limit(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_credit_note_number(TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_invoice_number(TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.generate_student_id() CASCADE;
DROP FUNCTION IF EXISTS public.generate_enrollment_id() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_set_student_id() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_set_enrollment_id() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_set_payment_invoice() CASCADE;
DROP FUNCTION IF EXISTS public.protect_payment_status_transitions() CASCADE;

DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA auth;

DROP TABLE IF EXISTS public.credit_notes CASCADE;
DROP TABLE IF EXISTS public.credit_note_series CASCADE;
DROP TABLE IF EXISTS public.invoice_series CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.resource_purchases CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.course_enrollments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP SEQUENCE IF EXISTS public.student_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.enrollment_id_seq CASCADE;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- 3. Minimal Supabase-compatible auth stubs + public.is_admin()
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      auth.jwt() ->> 'sub'
    ),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.role', true), ''),
      auth.jwt() ->> 'role',
      CASE
        WHEN current_user::text IN ('anon', 'authenticated', 'service_role', 'supabase_admin') THEN current_user::text
        ELSE NULL
      END
    ),
    ''
  );
$$;

GRANT EXECUTE ON FUNCTION auth.jwt() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.role() TO PUBLIC;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() ->> 'email') IN ('admin.synthetic@example.test')
    )
  );
END;
$$;

-- 4. Legacy Profiles, Course Enrollments, Resource Purchases & Bookings
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student',
  student_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  enrollment_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.resource_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_code VARCHAR(30) NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  payment_id TEXT,
  razorpay_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Legacy payments with restrictive payments_status_check + unrelated amount CHECK
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable user_id matches staging_baseline_review.sql & ON DELETE SET NULL audit retention (never CASCADE);
  -- RLS (auth.uid() = user_id) still evaluates UNKNOWN/denied whenever user_id IS NULL.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'course',
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  invoice_number TEXT,
  credit_note_number TEXT,
  status TEXT NOT NULL DEFAULT 'captured',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_status_check CHECK (status IN ('captured', 'refunded', 'failed')),
  CONSTRAINT chk_payments_amount_positive CHECK (amount > 0)
);

-- 6. Legacy pre-existing credit_notes with nullable required columns and missing defaults
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT,
  original_invoice_number TEXT,
  payment_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_id TEXT,
  reason TEXT,
  amount NUMERIC(10, 2),
  tax_amount NUMERIC(10, 2),
  base_amount NUMERIC(10, 2),
  currency TEXT,
  is_partial BOOLEAN,
  created_at TIMESTAMPTZ,
  metadata JSONB
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 7. Sequences covering BOTH is_called = false (equals existing max 10001) and is_called = true (higher 10050)
CREATE SEQUENCE public.student_id_seq START WITH 10001;
-- Leaves student_id_seq at (last_value = 10001, is_called = false)

CREATE SEQUENCE public.enrollment_id_seq START WITH 10001;
SELECT pg_catalog.setval('public.enrollment_id_seq', 10050, true);
-- Leaves enrollment_id_seq at (last_value = 10050, is_called = true)

-- 8. Seed synthetic auth users, legacy profiles, enrollments, payments & credit_notes
INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-4000-8000-000000000001', 'student1.synthetic@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'student2.synthetic@example.test'),
  ('10000000-0000-4000-8000-000000000009', 'admin.synthetic@example.test');

INSERT INTO public.profiles (id, full_name, role, student_id, created_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Legacy User 1', 'student', '  DM-STU-010001  ', '2026-04-05T08:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'Legacy User 2 (Missing ID)', 'student', NULL, '2026-04-06T08:00:00Z');

INSERT INTO public.course_enrollments (id, user_id, course_id, enrollment_id, status, created_at) VALUES
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'DM-ENR-010010', 'active', '2026-04-05T09:00:00Z'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', E'\tDM-ENR-010010\n', 'active', '2026-04-06T09:00:00Z');

INSERT INTO public.payments (
  id, user_id, item_type, item_id, item_title, amount, currency,
  razorpay_order_id, razorpay_payment_id, invoice_number, credit_note_number, status, created_at
) VALUES
  ('30000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'course', '90000000-0000-4000-8000-000000000001', 'Legacy Course A', 1000.00, 'INR', 'order_leg_101', 'pay_leg_101', ' DM/26-27/0003 ', NULL, 'captured', '2026-04-10T10:00:00Z'),
  ('30000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000002', 'course', '90000000-0000-4000-8000-000000000001', 'Legacy Course B', 2000.00, 'INR', 'order_leg_102', 'pay_leg_102', 'DM/26-27/0004', NULL, 'captured', '2026-04-11T10:00:00Z'),
  ('30000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', 'course', '90000000-0000-4000-8000-000000000002', 'Legacy Course C', 500.00, 'INR', 'order_leg_103', 'pay_leg_103', 'DM/26-27/0005', 'CN/26-27/0009', 'refunded', '2026-04-12T10:00:00Z'),
  ('30000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000002', 'course', '90000000-0000-4000-8000-000000000001', 'Legacy Course Failed', 999.00, 'INR', 'order_leg_104', 'pay_leg_104', NULL, NULL, 'failed', '2026-04-13T10:00:00Z');

INSERT INTO public.credit_notes (
  id, credit_note_number, original_invoice_number, payment_id, user_id,
  refund_id, reason, amount, base_amount, tax_amount, currency, is_partial, created_at
) VALUES
  ('40000000-0000-4000-8000-000000000101', ' CN/26-27/0001 ', 'DM/26-27/0003', ' pay_leg_101 ', '10000000-0000-4000-8000-000000000001', ' rfnd_leg_101 ', 'Historical partial refund', 400.00, 338.98, 61.02, ' inr ', true, '2026-04-14T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000102', 'CN/26-27/0002', 'DM/26-27/0004', '30000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000002', 'rfnd_leg_102', 'Historical UUID-linked partial refund', 500.00, 423.73, 76.27, 'INR', true, '2026-04-15T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000103', 'CN/26-27/0009', 'DM/26-27/0005', 'pay_leg_103', '10000000-0000-4000-8000-000000000001', 'rfnd_leg_103', 'Historical full refund', 500.00, 423.73, 76.27, 'INR', false, '2026-04-16T10:00:00Z');

COMMIT;
