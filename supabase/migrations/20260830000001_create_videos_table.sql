-- =========================================================================
-- DIGITAL MUID — STEP 5B: VIDEOS & WATCH CMS TABLE & RLS POLICIES
-- =========================================================================

-- 1. Create videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Digital Growth',
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT,
  thumbnail_url TEXT,
  duration TEXT,
  creator TEXT NOT NULL DEFAULT 'Digital Muid',
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_slug ON public.videos (slug);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos (status);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_is_featured ON public.videos (is_featured);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- 4. Drop any pre-existing policies to allow safe repeated migration execution
DROP POLICY IF EXISTS "Public Read Published Videos" ON public.videos;
DROP POLICY IF EXISTS "Admin All Videos" ON public.videos;

-- 5. RLS Policies:
-- Public visitors can SELECT published videos only
CREATE POLICY "Public Read Published Videos"
ON public.videos
FOR SELECT
USING (status = 'published');

-- Authenticated admins have full management permissions (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin All Videos"
ON public.videos
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
