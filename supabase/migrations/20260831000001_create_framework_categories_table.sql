-- =========================================================================
-- DIGITAL MUID — STEP 5E-1: FRAMEWORK CATEGORIES TABLE & RLS POLICIES
-- =========================================================================

-- 1. Create framework_categories table
CREATE TABLE IF NOT EXISTS public.framework_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance & uniqueness indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_categories_slug ON public.framework_categories (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_categories_name ON public.framework_categories (name);
CREATE INDEX IF NOT EXISTS idx_framework_categories_sort_order ON public.framework_categories (sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_framework_categories_is_active ON public.framework_categories (is_active);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.framework_categories ENABLE ROW LEVEL SECURITY;

-- 4. Drop any pre-existing policies to allow safe repeated migration execution
DROP POLICY IF EXISTS "Public Read Active Framework Categories" ON public.framework_categories;
DROP POLICY IF EXISTS "Admin All Framework Categories" ON public.framework_categories;

-- 5. RLS Policies:
-- Public visitors can SELECT active framework categories only
CREATE POLICY "Public Read Active Framework Categories"
ON public.framework_categories
FOR SELECT
USING (is_active = true);

-- Authorized administrators have full management permissions (SELECT, INSERT, UPDATE, DELETE) using public.is_admin()
CREATE POLICY "Admin All Framework Categories"
ON public.framework_categories
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_framework_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_framework_categories_updated_at ON public.framework_categories;
CREATE TRIGGER tr_framework_categories_updated_at
  BEFORE UPDATE ON public.framework_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_framework_categories_updated_at();

-- 7. Seed Initial Categories (Idempotent: insert only if not existing)
INSERT INTO public.framework_categories (name, slug, description, sort_order, is_active)
VALUES
  ('Digital Growth', 'digital-growth', 'Scalable digital acquisition, retention, and expansion frameworks.', 1, true),
  ('AI & Automation', 'ai-and-automation', 'Architectures for implementing artificial intelligence and autonomous workflows.', 2, true),
  ('Personal Branding', 'personal-branding', 'Methodologies for codifying expertise, executive presence, and market authority.', 3, true),
  ('Modern Marketing', 'modern-marketing', 'Next-generation demand generation, attribution, and multi-channel engines.', 4, true),
  ('Consulting & Leadership', 'consulting-and-leadership', 'High-impact advisory, change management, and executive leadership architectures.', 5, true),
  ('Systems & Architecture', 'systems-and-architecture', 'Technical, operational, and organizational infrastructure blueprints.', 6, true),
  ('Business Transformation', 'business-transformation', 'Enterprise reinvention, digital pivot, and scalable modernization models.', 7, true)
ON CONFLICT (slug) DO NOTHING;
