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
-- ==============================================================================

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase environment detected. Execute isolated legacy fixture ONLY in a disposable local PostgreSQL instance.';
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

-- 2. Clean standalone legacy reset
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
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
