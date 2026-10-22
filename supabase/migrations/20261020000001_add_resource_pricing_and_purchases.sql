-- =========================================================================
-- DIGITAL MUID — RESOURCE ACCESS TYPE (FREE/PAID) & PURCHASES LEDGER
-- Migration: 20261020000001_add_resource_pricing_and_purchases.sql
-- =========================================================================

-- 1. Safely add access_type, price, and currency columns to public.resources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'access_type'
  ) THEN
    ALTER TABLE public.resources
    ADD COLUMN access_type TEXT NOT NULL DEFAULT 'free' CHECK (access_type IN ('free', 'paid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'price'
  ) THEN
    ALTER TABLE public.resources
    ADD COLUMN price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.resources
    ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
  END IF;
END $$;

-- 2. Performance indexes for resource access and pricing
CREATE INDEX IF NOT EXISTS idx_resources_access_type ON public.resources (access_type);
CREATE INDEX IF NOT EXISTS idx_resources_price ON public.resources (price);

-- 3. Create public.resource_purchases table to record verified customer access
CREATE TABLE IF NOT EXISTS public.resource_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_resource_purchase UNIQUE (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_purchases_user_id ON public.resource_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_resource_id ON public.resource_purchases (resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_status ON public.resource_purchases (status);

-- 4. Enable Row Level Security (RLS) on resource_purchases
ALTER TABLE public.resource_purchases ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies on resource_purchases:
-- Users can view their own purchases or admins can view all
DROP POLICY IF EXISTS "Users can view own resource purchases" ON public.resource_purchases;
CREATE POLICY "Users can view own resource purchases"
  ON public.resource_purchases FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Only admins / server-side processes can insert or manage resource purchases
DROP POLICY IF EXISTS "Admin All Resource Purchases" ON public.resource_purchases;
CREATE POLICY "Admin All Resource Purchases"
  ON public.resource_purchases FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Ensure all pre-existing resources default to 'free' and 0 price safely without overwriting non-null prices
UPDATE public.resources
SET access_type = 'free'
WHERE access_type IS NULL;

UPDATE public.resources
SET price = 0.00
WHERE price IS NULL;

-- 7. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
