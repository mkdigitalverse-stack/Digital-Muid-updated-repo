-- =========================================================================
-- DIGITAL MUID — STEP 6B: COURSES CMS TABLE & RLS POLICIES
-- =========================================================================

-- 1. Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,

  short_outcome TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',

  level TEXT NOT NULL DEFAULT 'All Levels'
    CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All Levels')),

  delivery_mode TEXT NOT NULL DEFAULT 'Live Cohort'
    CHECK (delivery_mode IN ('Live Cohort', 'Self-Paced', 'Hybrid Masterclass')),

  duration TEXT NOT NULL DEFAULT '',

  price NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (price >= 0),

  offer_price NUMERIC(10,2)
    CHECK (offer_price IS NULL OR offer_price >= 0),

  offer_expires_at TIMESTAMPTZ,

  currency TEXT NOT NULL DEFAULT 'INR',

  instructor TEXT NOT NULL DEFAULT 'Digital Muid',
  instructor_title TEXT,
  instructor_avatar TEXT,

  thumbnail TEXT,
  cover_image TEXT,

  ai_integrated BOOLEAN NOT NULL DEFAULT false,
  ai_tools_covered TEXT[] NOT NULL DEFAULT '{}',

  featured BOOLEAN NOT NULL DEFAULT false,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  enrolled_count INTEGER NOT NULL DEFAULT 0
    CHECK (enrolled_count >= 0),

  cohort_start_date TIMESTAMPTZ,
  max_seats INTEGER
    CHECK (max_seats IS NULL OR max_seats > 0),

  curriculum JSONB NOT NULL DEFAULT '[]'::jsonb,

  highlights TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',

  related_frameworks UUID[] NOT NULL DEFAULT '{}',
  related_articles UUID[] NOT NULL DEFAULT '{}',
  related_videos UUID[] NOT NULL DEFAULT '{}',
  related_resources UUID[] NOT NULL DEFAULT '{}',

  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_slug ON public.courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_featured ON public.courses (featured);
CREATE INDEX IF NOT EXISTS idx_courses_level ON public.courses (level);
CREATE INDEX IF NOT EXISTS idx_courses_delivery_mode ON public.courses (delivery_mode);
CREATE INDEX IF NOT EXISTS idx_courses_cohort_start_date ON public.courses (cohort_start_date);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON public.courses (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 4. Drop any pre-existing policies for safe idempotent execution
DROP POLICY IF EXISTS "Public Read Published Courses" ON public.courses;
DROP POLICY IF EXISTS "Admin All Courses" ON public.courses;

-- 5. RLS Policies:
-- Public visitors can SELECT published courses only
CREATE POLICY "Public Read Published Courses"
ON public.courses
FOR SELECT
USING (status = 'published');

-- Authorized administrators have full management permissions (SELECT, INSERT, UPDATE, DELETE) using existing public.is_admin()
CREATE POLICY "Admin All Courses"
ON public.courses
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_courses_updated_at ON public.courses;
CREATE TRIGGER tr_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_courses_updated_at();
