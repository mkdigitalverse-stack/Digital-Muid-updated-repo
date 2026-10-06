-- ==============================================================================
-- Migration: 20260926000001_create_consultation_products_table.sql
-- Description: Creates public.consultation_products table for consultation
-- pricing & catalog persistence with secure RLS policies and baseline seeding.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Business Growth Consultation',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 499.00,
  gst_rate NUMERIC(4,2) NOT NULL DEFAULT 0.18,
  currency TEXT NOT NULL DEFAULT 'INR',
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_consultation_products_active ON public.consultation_products(active);
CREATE INDEX IF NOT EXISTS idx_consultation_products_updated ON public.consultation_products(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.consultation_products ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Public visitors and authenticated students can read active products. Admins can view all.
DROP POLICY IF EXISTS "Public can view active consultation products" ON public.consultation_products;
CREATE POLICY "Public can view active consultation products"
  ON public.consultation_products
  FOR SELECT
  USING (
    active = true
    OR
    (SELECT public.is_admin())
  );

-- 2. INSERT: Only administrative accounts can insert consultation products.
DROP POLICY IF EXISTS "Admins can insert consultation products" ON public.consultation_products;
CREATE POLICY "Admins can insert consultation products"
  ON public.consultation_products
  FOR INSERT
  WITH CHECK (
    (SELECT public.is_admin())
  );

-- 3. UPDATE: Only administrative accounts can update consultation products.
DROP POLICY IF EXISTS "Admins can update consultation products" ON public.consultation_products;
CREATE POLICY "Admins can update consultation products"
  ON public.consultation_products
  FOR UPDATE
  USING (
    (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT public.is_admin())
  );

-- 4. DELETE: Only administrative accounts can delete consultation products.
DROP POLICY IF EXISTS "Admins can delete consultation products" ON public.consultation_products;
CREATE POLICY "Admins can delete consultation products"
  ON public.consultation_products
  FOR DELETE
  USING (
    (SELECT public.is_admin())
  );

-- Seed canonical baseline production consultation product idempotently
INSERT INTO public.consultation_products (
  id,
  name,
  duration_minutes,
  base_price,
  gst_rate,
  currency,
  active,
  description,
  features
) VALUES (
  '31bbb9bf-ce10-4da4-a517-dfc673f9b875',
  'Business Growth Consultation',
  30,
  499.00,
  0.18,
  'INR',
  true,
  'Bring one pivotal business or marketing challenge. Receive high-velocity strategic clarity, tactical roadmaps, and actionable next steps.',
  '["30-minute private 1-on-1 strategic session with Digital Muid", "Focused deep-dive into your specific growth or AI bottleneck", "Actionable framework implementation guidance", "Session recording and post-consultation summary notes", "Dedicated Google Meet link generated instantly"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  updated_at = now();

-- Grant permissions to standard roles
GRANT SELECT ON public.consultation_products TO anon, authenticated;
GRANT ALL ON public.consultation_products TO authenticated;
