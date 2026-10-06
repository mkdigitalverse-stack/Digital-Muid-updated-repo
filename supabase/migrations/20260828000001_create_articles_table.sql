-- =========================================================================
-- DIGITAL MUID — STEP 5A: ARTICLES CMS TABLE & RLS POLICIES
-- =========================================================================

-- 1. Create articles table
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Digital Growth',
  author TEXT NOT NULL DEFAULT 'Digital Muid',
  featured_image TEXT,
  reading_time_minutes INTEGER NOT NULL DEFAULT 5 CHECK (reading_time_minutes > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON public.articles (slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_is_featured ON public.articles (is_featured);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 4. Drop any pre-existing policies to allow safe repeated migration execution
DROP POLICY IF EXISTS "Public Read Published Articles" ON public.articles;
DROP POLICY IF EXISTS "Admin All Articles" ON public.articles;

-- 5. RLS Policies:
-- Public visitors can SELECT published articles only
CREATE POLICY "Public Read Published Articles"
ON public.articles
FOR SELECT
USING (status = 'published');

-- Authenticated admins have full management permissions (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin All Articles"
ON public.articles
FOR ALL
USING (auth.role() = 'authenticated');
