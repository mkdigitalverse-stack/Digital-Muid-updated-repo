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
-- ==============================================================================

\set ON_ERROR_STOP on

-- 0. FAIL-CLOSED ENVIRONMENT GUARD
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase environment detected. Execute isolated test fixtures ONLY in a disposable local PostgreSQL instance.';
  END IF;
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
