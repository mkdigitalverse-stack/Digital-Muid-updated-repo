-- =========================================================================
-- DIGITAL MUID — STEP 5C: RESOURCES CMS TABLE & RLS POLICIES
-- =========================================================================

-- 1. Create resources table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource_type TEXT NOT NULL DEFAULT 'Guide',
  category TEXT NOT NULL DEFAULT 'Digital Growth',
  file_url TEXT,
  external_url TEXT,
  thumbnail_url TEXT,
  author TEXT NOT NULL DEFAULT 'Digital Muid',
  file_type TEXT,
  file_size TEXT,
  reading_time_minutes INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  preview_points TEXT[] DEFAULT '{}',
  what_is_included TEXT[] DEFAULT '{}',
  lead_capture_required BOOLEAN NOT NULL DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_slug ON public.resources (slug);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources (status);
CREATE INDEX IF NOT EXISTS idx_resources_published_at ON public.resources (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources (category);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON public.resources (resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_is_featured ON public.resources (is_featured);
CREATE INDEX IF NOT EXISTS idx_resources_download_count ON public.resources (download_count DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- 4. Drop any pre-existing policies to allow safe repeated migration execution
DROP POLICY IF EXISTS "Public Read Published Resources" ON public.resources;
DROP POLICY IF EXISTS "Admin All Resources" ON public.resources;

-- 5. RLS Policies:
-- Public visitors can SELECT published resources only
CREATE POLICY "Public Read Published Resources"
ON public.resources
FOR SELECT
USING (status = 'published');

-- Authorized administrators have full management permissions (SELECT, INSERT, UPDATE, DELETE) using public.is_admin()
CREATE POLICY "Admin All Resources"
ON public.resources
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_resources_updated_at ON public.resources;
CREATE TRIGGER tr_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_resources_updated_at();

-- 7. Atomic function to increment download counter
CREATE OR REPLACE FUNCTION public.increment_resource_downloads(resource_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.resources
  SET download_count = download_count + 1
  WHERE id = resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
