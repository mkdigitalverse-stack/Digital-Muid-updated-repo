-- =========================================================================
-- DIGITAL MUID — STEP 5D: FRAMEWORKS CMS TABLE & RLS POLICIES
-- =========================================================================

-- 1. Create frameworks table
CREATE TABLE IF NOT EXISTS public.frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,

  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',

  category TEXT NOT NULL DEFAULT 'Digital Growth',

  author TEXT NOT NULL DEFAULT 'Digital Muid',

  cover_image TEXT,

  problem_statement TEXT NOT NULL DEFAULT '',
  solution_statement TEXT NOT NULL DEFAULT '',

  framework_content JSONB NOT NULL DEFAULT '[]'::jsonb,

  who_is_it_for TEXT NOT NULL DEFAULT '',
  when_to_use TEXT NOT NULL DEFAULT '',

  related_articles UUID[] NOT NULL DEFAULT '{}',
  related_videos UUID[] NOT NULL DEFAULT '{}',
  related_resources UUID[] NOT NULL DEFAULT '{}',

  tags TEXT[] NOT NULL DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  is_featured BOOLEAN NOT NULL DEFAULT false,

  seo_title TEXT,
  seo_description TEXT,

  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_frameworks_slug ON public.frameworks (slug);
CREATE INDEX IF NOT EXISTS idx_frameworks_status ON public.frameworks (status);
CREATE INDEX IF NOT EXISTS idx_frameworks_published_at ON public.frameworks (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_frameworks_category ON public.frameworks (category);
CREATE INDEX IF NOT EXISTS idx_frameworks_is_featured ON public.frameworks (is_featured);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.frameworks ENABLE ROW LEVEL SECURITY;

-- 4. Drop any pre-existing policies to allow safe repeated migration execution
DROP POLICY IF EXISTS "Public Read Published Frameworks" ON public.frameworks;
DROP POLICY IF EXISTS "Admin All Frameworks" ON public.frameworks;

-- 5. RLS Policies:
-- Public visitors can SELECT published frameworks only
CREATE POLICY "Public Read Published Frameworks"
ON public.frameworks
FOR SELECT
USING (status = 'published');

-- Authorized administrators have full management permissions (SELECT, INSERT, UPDATE, DELETE) using public.is_admin()
CREATE POLICY "Admin All Frameworks"
ON public.frameworks
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_frameworks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_frameworks_updated_at ON public.frameworks;
CREATE TRIGGER tr_frameworks_updated_at
  BEFORE UPDATE ON public.frameworks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_frameworks_updated_at();
