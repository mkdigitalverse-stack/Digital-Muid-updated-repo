-- ==============================================================================
-- DIGITALMUID V4.3 — DISPOSABLE CI POSTGRESQL 17 CHRONOLOGICAL BOOTSTRAP
-- File: supabase/tests/ci_bootstrap_prerequisites.sql
-- ==============================================================================
-- PURPOSE:
-- Initializes ONLY the minimal PostgreSQL extensions, Supabase-compatible roles
-- & auth stubs, pre-20260830000002 public.is_admin() dependency stub, and the 5
-- undocumented pre-20260826 tables missing from supabase/migrations/ so the full
-- 28-file chronological sequence (20260826..20261116) can be replayed cleanly inside
-- a disposable local/CI PostgreSQL 17 container.
--
-- IMPORTANT SCHEMA UNCERTAINTY DISCLOSURE:
--   - public.bookings and public.crm_leads DO NOT have CREATE TABLE statements in
--     supabase/migrations/. This bootstrap uses a DISPOSABLE TEST SCHEMA ASSUMPTION
--     derived from supabase/schema.sql and post-reconciliation expectations.
--   - Passing tests against this disposable fixture DOES NOT prove that live
--     pre-V4.3 Supabase public.bookings or public.crm_leads matches these types/columns.
--
-- ASSUMED TEST SCHEMA (pre-20260826 baseline):
--   - public.bookings:
--       id TEXT PRIMARY KEY, booking_code VARCHAR(30) UNIQUE NOT NULL,
--       customer_name TEXT NOT NULL, customer_email TEXT NOT NULL,
--       customer_phone VARCHAR(30) NOT NULL, business_name TEXT NOT NULL,
--       primary_challenge TEXT NOT NULL, desired_outcome TEXT NOT NULL,
--       website TEXT, linkedin TEXT, instagram TEXT,
--       booking_date DATE NOT NULL, booking_time VARCHAR(20) NOT NULL,
--       duration_minutes INTEGER NOT NULL DEFAULT 30,
--       base_amount NUMERIC(10,2) NOT NULL, gst_rate NUMERIC(4,2) NOT NULL,
--       gst_amount NUMERIC(10,2) NOT NULL, total_amount NUMERIC(10,2) NOT NULL,
--       currency VARCHAR(3) NOT NULL DEFAULT 'INR',
--       payment_id TEXT, razorpay_order_id TEXT,
--       meeting_link TEXT, status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
--       notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
--       (Omits legacy meet_url / payment_status / calendar_event_id;
--        user_id is added by 20260918000001; invoice_number by 20261107000001.)
--   - public.crm_leads:
--       id TEXT PRIMARY KEY (schema.sql assumption; 20261116000001/03 inspect
--       information_schema dynamically for UUID vs TEXT),
--       name TEXT NOT NULL, email TEXT NOT NULL, phone VARCHAR(30),
--       source VARCHAR(50) NOT NULL, interest TEXT NOT NULL, notes TEXT,
--       status VARCHAR(20) NOT NULL DEFAULT 'New', amount NUMERIC(10,2),
--       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
--
-- SAFETY GUARD DIVISION OF ENFORCEMENT:
--   1. GitHub Actions Workflow (.github/workflows/postgres-v4-3-migration-tests.yml):
--      - Enforces PGHOST=127.0.0.1, PGPORT=5432, PGUSER=postgres, PGDATABASE=digitalmuid_ci_chronological_replay
--      - Starts isolated Docker service container `postgres:17` and drops CI DB under `if: always()`.
--   2. Node Concurrency Runner (supabase/tests/v4_3_postgres_concurrency_test.mjs):
--      - Enforces strict loopback client host (127.0.0.1 / localhost / ::1) and exact DB name.
--   3. SQL Bootstrap Guard (this file, enforced inside PostgreSQL):
--      - Requires exact current_database() = 'digitalmuid_ci_chronological_replay'.
--      - Requires PostgreSQL major version 17 (server_version_num BETWEEN 170000 AND 179999).
--      - Rejects hosted Supabase schemas/roles/identifiers (kpuxtsworzkueyffjaaz / supabase).
--      - Allows ONLY local Unix socket OR TCP connections where BOTH inet_server_addr() and
--        pg_stat_activity.client_addr are loopback (127.0.0.0/8, ::1) or private container
--        bridge ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7); rejects all
--        publicly routable, CGNAT (100.64.0.0/10), and link-local/metadata (169.254.0.0/16, fe80::/10) IPs.
-- ==============================================================================

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_db_name TEXT := NULLIF(pg_catalog.btrim(pg_catalog.current_database()::text), '');
  v_cur_user TEXT := NULLIF(pg_catalog.btrim(current_user::text), '');
  v_srv_version TEXT := NULLIF(pg_catalog.btrim(pg_catalog.version()), '');
  v_srv_ver_num INTEGER := pg_catalog.current_setting('server_version_num')::integer;
  v_srv_addr INET := pg_catalog.inet_server_addr();
  v_client_addr INET;
  v_backend_type TEXT;
  v_cluster TEXT := COALESCE(NULLIF(pg_catalog.btrim(pg_catalog.current_setting('cluster_name', true)), ''), '<unset>');
  v_srv_is_local_or_private BOOLEAN;
  v_cli_is_local_or_private BOOLEAN;
BEGIN
  IF v_db_name IS DISTINCT FROM 'digitalmuid_ci_chronological_replay' THEN
    RAISE EXCEPTION 'SAFETY HALT: ci_bootstrap_prerequisites.sql requires database "digitalmuid_ci_chronological_replay", got "%".',
      COALESCE(v_db_name, '<null>');
  END IF;

  IF v_srv_version IS NULL
     OR v_srv_version !~ '^PostgreSQL 17(\.| |$)'
     OR v_srv_ver_num < 170000
     OR v_srv_ver_num >= 180000 THEN
    RAISE EXCEPTION 'SAFETY HALT: CI requires PostgreSQL major version 17, got "%" (server_version_num=%).',
      COALESCE(v_srv_version, '<null>'), v_srv_ver_num;
  END IF;

  SELECT sa.client_addr, sa.backend_type
  INTO v_client_addr, v_backend_type
  FROM pg_catalog.pg_stat_activity sa
  WHERE sa.pid = pg_catalog.pg_backend_pid();

  IF NOT FOUND OR v_backend_type IS DISTINCT FROM 'client backend' THEN
    RAISE EXCEPTION 'SAFETY HALT: Unable to verify local PostgreSQL backend identity.';
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
     OR COALESCE(v_cur_user, '') ~* 'kpuxtsworzkueyffjaaz'
     OR v_cluster ~* 'supabase|kpuxtsworzkueyffjaaz' THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase namespace, role, or forbidden project identifier detected.';
  END IF;

  -- Connection locality check:
  --  1) Unix domain socket: both inet_server_addr() and client_addr are NULL.
  --  2) Loopback or Docker/GitHub Actions service-container private bridge TCP:
  --     both inet_server_addr() and client_addr are non-NULL and strictly inside
  --     loopback (127.0.0.0/8, ::1) or RFC1918 / RFC4193 private ranges, and NOT link-local/metadata.
  IF v_srv_addr IS NULL AND v_client_addr IS NULL THEN
    NULL; -- Local Unix domain socket permitted
  ELSIF v_srv_addr IS NOT NULL AND v_client_addr IS NOT NULL THEN
    v_srv_is_local_or_private := (
      v_srv_addr << '127.0.0.0/8'::inet
      OR v_srv_addr = '::1'::inet
      OR v_srv_addr << '10.0.0.0/8'::inet
      OR v_srv_addr << '172.16.0.0/12'::inet
      OR v_srv_addr << '192.168.0.0/16'::inet
      OR v_srv_addr << 'fc00::/7'::inet
    ) AND NOT (
      v_srv_addr << '169.254.0.0/16'::inet
      OR v_srv_addr << 'fe80::/10'::inet
      OR v_srv_addr << '100.64.0.0/10'::inet
    );

    v_cli_is_local_or_private := (
      v_client_addr << '127.0.0.0/8'::inet
      OR v_client_addr = '::1'::inet
      OR v_client_addr << '10.0.0.0/8'::inet
      OR v_client_addr << '172.16.0.0/12'::inet
      OR v_client_addr << '192.168.0.0/16'::inet
      OR v_client_addr << 'fc00::/7'::inet
    ) AND NOT (
      v_client_addr << '169.254.0.0/16'::inet
      OR v_client_addr << 'fe80::/10'::inet
      OR v_client_addr << '100.64.0.0/10'::inet
    );

    IF NOT (v_srv_is_local_or_private AND v_cli_is_local_or_private) THEN
      RAISE EXCEPTION 'SAFETY HALT: Disposable CI bootstrap permits Unix socket, loopback, or private container-bridge addresses only (srv=%, client=%).',
        v_srv_addr, v_client_addr;
    END IF;
  ELSE
    RAISE EXCEPTION 'SAFETY HALT: Ambiguous connection address state (srv=%, client=%). Refusing bootstrap.',
      COALESCE(v_srv_addr::text, '<null>'), COALESCE(v_client_addr::text, '<null>');
  END IF;

  IF v_cur_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'SAFETY HALT: Bootstrap must run as local postgres admin role, not "%".', v_cur_user;
  END IF;

  RAISE NOTICE 'CI BOOTSTRAP GUARD PASSED: db=%, ver_num=%, srv=%, client=%',
    v_db_name, v_srv_ver_num, COALESCE(v_srv_addr::text, 'unix-socket'), COALESCE(v_client_addr::text, 'unix-socket');
END $$;

BEGIN;

-- 1. Minimal required extensions (gen_random_uuid() is built-in in PG13+, uuid-ossp/pgcrypto parity)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Minimal Supabase-compatible roles (strictly NOLOGIN, no extra superuser grants)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- 3. Minimal auth schema & JWT helper stubs
CREATE SCHEMA IF NOT EXISTS auth;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Minimal service_role default privileges for server-side verification queries
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
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
      NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
      auth.jwt() ->> 'role',
      CASE
        WHEN current_user IN ('anon', 'authenticated', 'service_role') THEN current_user
        ELSE NULL
      END
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION auth.jwt() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role, postgres;

-- 4. Bootstrap stub for public.is_admin() (required before 20260830000002_create_resources_table.sql;
--    overwritten cleanly by 20260918000002 and hardened by 20261029000001)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role, postgres;

-- 5. Undocumented pre-20260826 baseline tables missing from supabase/migrations/
--    NOTE: These represent DISPOSABLE TEST SCHEMA ASSUMPTIONS, not live DB proof.

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  booking_code VARCHAR(30) UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  business_name TEXT NOT NULL,
  primary_challenge TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,
  website TEXT,
  linkedin TEXT,
  instagram TEXT,
  booking_date DATE NOT NULL,
  booking_time VARCHAR(20) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  base_amount NUMERIC(10,2) NOT NULL,
  gst_rate NUMERIC(4,2) NOT NULL,
  gst_amount NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_id TEXT,
  razorpay_order_id TEXT,
  meeting_link TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone VARCHAR(30),
  source VARCHAR(50) NOT NULL,
  interest TEXT NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'New',
  amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availability_rules (
  id TEXT PRIMARY KEY DEFAULT 'primary_availability_rules',
  working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time VARCHAR(5) NOT NULL DEFAULT '11:00',
  end_time VARCHAR(5) NOT NULL DEFAULT '20:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  break_periods JSONB NOT NULL DEFAULT '[{"start":"14:00","end":"15:00","name":"Strategic Break"}]'::jsonb,
  blocked_dates TEXT[] NOT NULL DEFAULT '{}',
  blocked_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_notice_hours INTEGER NOT NULL DEFAULT 4,
  max_advance_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  source VARCHAR(100) NOT NULL DEFAULT 'Homepage Brief',
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'primary_site_settings',
  admin_email TEXT NOT NULL,
  razorpay_key_id TEXT,
  razorpay_test_mode BOOLEAN NOT NULL DEFAULT true,
  google_calendar_connected BOOLEAN NOT NULL DEFAULT true,
  google_meet_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_email TEXT NOT NULL,
  phone_contact VARCHAR(30) NOT NULL,
  location_city TEXT NOT NULL,
  social_linkedin TEXT,
  social_instagram TEXT,
  social_facebook TEXT,
  social_youtube TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
