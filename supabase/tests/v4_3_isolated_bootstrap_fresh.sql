-- ==============================================================================
-- DIGITALMUID V4.3 — ISOLATED POSTGRESQL FRESH-SCHEMA FIXTURE
-- File: supabase/tests/v4_3_isolated_bootstrap_fresh.sql
-- ==============================================================================
-- PURPOSE:
-- Initializes a clean, isolated PostgreSQL database (digitalmuid_v43_fresh_test)
-- with minimal auth stubs, roles, helper functions, baseline tables, and clean
-- synthetic data so 20261107000001_student_id_and_invoices.sql (Phase A) and
-- 20261107000002_concurrent_indexes.sql (Phase B) can be tested from scratch.
--
-- EXECUTION TARGET:
-- Run ONLY inside dedicated fresh test database `digitalmuid_v43_fresh_test`.
-- NEVER apply this fixture and v4_3_isolated_legacy_fixture.sql to the same database.
--
-- SAFETY:
-- - DO NOT RUN against production or any hosted Supabase project.
-- - Uses 100% synthetic UUIDs, @example.test emails, and pay_fresh_* IDs.
-- - NOT EXECUTED automatically. Run ONLY inside a disposable local database.
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

  -- 0B. Require EXACT fresh test database name
  IF v_db_name IS DISTINCT FROM 'digitalmuid_v43_fresh_test' THEN
    RAISE EXCEPTION 'SAFETY HALT: v4_3_isolated_bootstrap_fresh.sql requires current_database() = "digitalmuid_v43_fresh_test", got "%". Refusing execution.',
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

  RAISE NOTICE 'ISOLATED FRESH GUARD PASSED: db=%, current_user=%, session_user=%, server=%:%, client=%, docker_opt_in=%, cluster=% (NOT a standalone safety guarantee).',
    v_db_name, v_cur_user, v_sess_user,
    COALESCE(v_srv_addr::text, 'unix-socket'), COALESCE(v_srv_port::text, 'local'),
    COALESCE(v_client_addr::text, 'unix-socket'), v_allow_docker, v_cluster;
END $$;

BEGIN;

-- 1. Extensions & Roles
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- 2. Reset public & auth schemas cleanly for deterministic fresh run
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

-- 3. Minimal Supabase-compatible auth schema stubs (JWT GUC driven for RLS/trigger tests)
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
        WHEN current_user IN ('anon', 'authenticated', 'service_role', 'supabase_admin') THEN current_user
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

-- 4. Fresh V4.2 Baseline Tables (pre-Phase A shape)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'course',
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'captured',
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 5. Clean Synthetic Seed Data (100% fictitious)
INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-4000-8000-000000000001', 'student1.synthetic@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'student2.synthetic@example.test'),
  ('10000000-0000-4000-8000-000000000009', 'admin.synthetic@example.test');

INSERT INTO public.profiles (id, full_name, role) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Student One', 'student'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic Student Two', 'student');

INSERT INTO public.course_enrollments (id, user_id, course_id, status) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'active');

INSERT INTO public.payments (id, user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at) VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'course', '90000000-0000-4000-8000-000000000001', 'Synthetic Course Alpha', 1180.00, 'INR', 'order_fresh_001', 'pay_fresh_001', 'captured', '2026-05-10T10:00:00Z'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'course', '90000000-0000-4000-8000-000000000001', 'Synthetic Course Alpha', 590.00,  'INR', 'order_fresh_002', 'pay_fresh_002', 'paid',     '2026-05-11T10:00:00Z');

COMMIT;
