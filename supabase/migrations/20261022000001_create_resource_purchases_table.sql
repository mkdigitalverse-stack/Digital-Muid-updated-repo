-- ==============================================================================
-- DIGITAL MUID — RESOURCE PURCHASES TABLE & GUEST FULFILLMENT
-- Migration: 20261022000001_create_resource_purchases_table.sql
-- ==============================================================================

-- 1. Create public.resource_purchases table supporting authenticated & guest checkouts
CREATE TABLE IF NOT EXISTS public.resource_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email TEXT,
  customer_phone TEXT,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for performance and idempotency
CREATE INDEX IF NOT EXISTS idx_resource_purchases_user_id ON public.resource_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_resource_id ON public.resource_purchases (resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_order_id ON public.resource_purchases (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_status ON public.resource_purchases (status);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_email ON public.resource_purchases (customer_email);

-- Unique index to prevent duplicate purchase for same user and resource
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_resource_purchase 
  ON public.resource_purchases (user_id, resource_id) 
  WHERE user_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE public.resource_purchases ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies:
-- Authenticated users can view their own purchases
DROP POLICY IF EXISTS "Users can view own resource purchases" ON public.resource_purchases;
CREATE POLICY "Users can view own resource purchases"
  ON public.resource_purchases FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Administrators have full management access
DROP POLICY IF EXISTS "Admin All Resource Purchases" ON public.resource_purchases;
CREATE POLICY "Admin All Resource Purchases"
  ON public.resource_purchases FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
