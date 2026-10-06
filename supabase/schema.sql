-- =========================================================================
-- DIGITAL MUID — COMPLETE SUPABASE DATABASE SCHEMA
-- Generated for Step 3B / 3C / 3E Implementation
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONSULTATION PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS consultation_products (
  id TEXT PRIMARY KEY DEFAULT 'prod-consultation-30',
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 499.00,
  gst_rate NUMERIC(4,2) NOT NULL DEFAULT 0.18,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. AVAILABILITY RULES TABLE
CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY DEFAULT 'primary_availability_rules',
  working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time VARCHAR(5) NOT NULL DEFAULT '11:00',
  end_time VARCHAR(5) NOT NULL DEFAULT '20:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  break_periods JSONB NOT NULL DEFAULT '[{"start":"14:00","end":"15:00","name":"Strategic Break"}]'::jsonb,
  blocked_dates TEXT[] NOT NULL DEFAULT '{}',
  blocked_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_notice_hours INTEGER NOT NULL DEFAULT 4,
  max_advance_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_code VARCHAR(30) UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  business_name TEXT NOT NULL,
  primary_challenge TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,
  website TEXT,
  linkedin TEXT,
  instagram TEXT,
  booking_date DATE NOT NULL,
  booking_time VARCHAR(20) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  base_amount NUMERIC(10,2) NOT NULL,
  gst_rate NUMERIC(4,2) NOT NULL,
  gst_amount NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_id TEXT,
  razorpay_order_id TEXT,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
  calendar_event_id TEXT,
  meet_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE CONSTRAINT / INDEX FOR PREVENTING DUPLICATE ACTIVE BOOKINGS
-- Exact Index Name: idx_unique_active_booking_slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_slot
ON bookings (booking_date, booking_time)
WHERE status IN ('confirmed', 'rescheduled');

CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings (booking_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings (customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);

-- 4. CRM LEADS TABLE
CREATE TABLE IF NOT EXISTS crm_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone VARCHAR(30),
  source VARCHAR(50) NOT NULL,
  interest TEXT NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'New',
  amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON crm_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON crm_leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON crm_leads (status);

-- 5. NEWSLETTER SUBSCRIBERS TABLE
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  source VARCHAR(100) NOT NULL DEFAULT 'Homepage Brief',
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers (email);

-- 6. CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone VARCHAR(30),
  inquiry_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages (email);

-- 7. SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'primary_site_settings',
  admin_email TEXT NOT NULL,
  razorpay_key_id TEXT,
  razorpay_test_mode BOOLEAN NOT NULL DEFAULT true,
  google_calendar_connected BOOLEAN NOT NULL DEFAULT true,
  google_meet_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_email TEXT NOT NULL,
  phone_contact VARCHAR(30) NOT NULL,
  location_city TEXT NOT NULL,
  social_linkedin TEXT,
  social_instagram TEXT,
  social_facebook TEXT,
  social_youtube TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ARTICLES TABLE (CMS)
CREATE TABLE IF NOT EXISTS articles (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles (slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_is_featured ON articles (is_featured);

-- 9. VIDEOS TABLE (CMS)
CREATE TABLE IF NOT EXISTS videos (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_slug ON videos (slug);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_is_featured ON videos (is_featured);

-- 10. RESOURCES TABLE (CMS)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource_type TEXT NOT NULL DEFAULT 'guide',
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
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_slug ON resources (slug);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources (status);
CREATE INDEX IF NOT EXISTS idx_resources_published_at ON resources (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources (category);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON resources (resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_is_featured ON resources (is_featured);

-- 11. FRAMEWORKS TABLE (CMS)
CREATE TABLE IF NOT EXISTS frameworks (
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
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_frameworks_slug ON frameworks (slug);
CREATE INDEX IF NOT EXISTS idx_frameworks_status ON frameworks (status);
CREATE INDEX IF NOT EXISTS idx_frameworks_published_at ON frameworks (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_frameworks_category ON frameworks (category);
CREATE INDEX IF NOT EXISTS idx_frameworks_is_featured ON frameworks (is_featured);

-- 12. FRAMEWORK CATEGORIES TABLE (CMS)
CREATE TABLE IF NOT EXISTS framework_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_categories_slug ON framework_categories (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_categories_name ON framework_categories (name);
CREATE INDEX IF NOT EXISTS idx_framework_categories_sort_order ON framework_categories (sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_framework_categories_is_active ON framework_categories (is_active);

-- 13. COURSES TABLE (CMS)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_outcome TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'All Levels' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All Levels')),
  delivery_mode TEXT NOT NULL DEFAULT 'Live Cohort' CHECK (delivery_mode IN ('Live Cohort', 'Self-Paced', 'Hybrid Masterclass')),
  duration TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  offer_price NUMERIC(10,2) CHECK (offer_price IS NULL OR offer_price >= 0),
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
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  enrolled_count INTEGER NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  cohort_start_date TIMESTAMPTZ,
  max_seats INTEGER CHECK (max_seats IS NULL OR max_seats > 0),
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_slug ON courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses (featured);
CREATE INDEX IF NOT EXISTS idx_courses_level ON courses (level);
CREATE INDEX IF NOT EXISTS idx_courses_delivery_mode ON courses (delivery_mode);
CREATE INDEX IF NOT EXISTS idx_courses_cohort_start_date ON courses (cohort_start_date);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses (created_at DESC);

-- =========================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- =========================================================================

-- Admin check helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND
    (
      auth.jwt() ->> 'email' IN ('mkdigitalverse@gmail.com', 'admin@digitalmuid.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Updated at timestamp handler for courses
CREATE OR REPLACE FUNCTION public.handle_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_courses_updated_at ON courses;
CREATE TRIGGER tr_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_courses_updated_at();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE consultation_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Articles: Public read only published, Admin ALL
DROP POLICY IF EXISTS "Public Read Published Articles" ON articles;
DROP POLICY IF EXISTS "Admin All Articles" ON articles;
CREATE POLICY "Public Read Published Articles" ON articles FOR SELECT USING (status = 'published');
CREATE POLICY "Admin All Articles" ON articles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Videos: Public read only published, Admin ALL
DROP POLICY IF EXISTS "Public Read Published Videos" ON videos;
DROP POLICY IF EXISTS "Admin All Videos" ON videos;
CREATE POLICY "Public Read Published Videos" ON videos FOR SELECT USING (status = 'published');
CREATE POLICY "Admin All Videos" ON videos FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Resources: Public read only published, Admin ALL
DROP POLICY IF EXISTS "Public Read Published Resources" ON resources;
DROP POLICY IF EXISTS "Admin All Resources" ON resources;
CREATE POLICY "Public Read Published Resources" ON resources FOR SELECT USING (status = 'published');
CREATE POLICY "Admin All Resources" ON resources FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Frameworks: Public read only published, Admin ALL
DROP POLICY IF EXISTS "Public Read Published Frameworks" ON frameworks;
DROP POLICY IF EXISTS "Admin All Frameworks" ON frameworks;
CREATE POLICY "Public Read Published Frameworks" ON frameworks FOR SELECT USING (status = 'published');
CREATE POLICY "Admin All Frameworks" ON frameworks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Framework Categories: Public read active, Admin ALL
DROP POLICY IF EXISTS "Public Read Active Framework Categories" ON framework_categories;
DROP POLICY IF EXISTS "Admin All Framework Categories" ON framework_categories;
CREATE POLICY "Public Read Active Framework Categories" ON framework_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admin All Framework Categories" ON framework_categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Courses: Public read only published, Admin ALL
DROP POLICY IF EXISTS "Public Read Published Courses" ON courses;
DROP POLICY IF EXISTS "Admin All Courses" ON courses;
CREATE POLICY "Public Read Published Courses" ON courses FOR SELECT USING (status = 'published');
CREATE POLICY "Admin All Courses" ON courses FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Consultation Products: Public read, Admin write
DROP POLICY IF EXISTS "Public Read Consultation Products" ON consultation_products;
DROP POLICY IF EXISTS "Admin All Consultation Products" ON consultation_products;
CREATE POLICY "Public Read Consultation Products" ON consultation_products FOR SELECT USING (true);
CREATE POLICY "Admin All Consultation Products" ON consultation_products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Availability Rules: Public read, Admin write
DROP POLICY IF EXISTS "Public Read Availability Rules" ON availability_rules;
DROP POLICY IF EXISTS "Admin All Availability Rules" ON availability_rules;
CREATE POLICY "Public Read Availability Rules" ON availability_rules FOR SELECT USING (true);
CREATE POLICY "Admin All Availability Rules" ON availability_rules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Bookings: Public Insert, Student View Own, Admin All
DROP POLICY IF EXISTS "Public Insert Bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Admin All Bookings" ON bookings;
CREATE POLICY "Public Insert Bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.role() = 'authenticated' AND customer_email = (auth.jwt() ->> 'email')) OR
  public.is_admin()
);
CREATE POLICY "Admin All Bookings" ON bookings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- CRM Leads: Public Insert, Admin All
DROP POLICY IF EXISTS "Public Insert CRM Leads" ON crm_leads;
DROP POLICY IF EXISTS "Admin All CRM Leads" ON crm_leads;
CREATE POLICY "Public Insert CRM Leads" ON crm_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin All CRM Leads" ON crm_leads FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Newsletter Subscribers: Public Insert/Upsert, Admin All
DROP POLICY IF EXISTS "Public Insert Subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Admin All Subscribers" ON newsletter_subscribers;
CREATE POLICY "Public Insert Subscribers" ON newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin All Subscribers" ON newsletter_subscribers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Contact Messages: Public Insert, Admin All
DROP POLICY IF EXISTS "Public Insert Contact Messages" ON contact_messages;
DROP POLICY IF EXISTS "Admin All Contact Messages" ON contact_messages;
CREATE POLICY "Public Insert Contact Messages" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin All Contact Messages" ON contact_messages FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Site Settings: Public Read, Admin Write
DROP POLICY IF EXISTS "Public Read Site Settings" ON site_settings;
DROP POLICY IF EXISTS "Admin All Site Settings" ON site_settings;
CREATE POLICY "Public Read Site Settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Admin All Site Settings" ON site_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================================
-- COURSE ENROLLMENTS & LESSON MEDIA (STEP 6C-2)
-- =========================================================================

-- Course Enrollments
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'admin_grant', 'cohort')),
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON public.course_enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON public.course_enrollments (status);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students Read Own Enrollments" ON public.course_enrollments;
DROP POLICY IF EXISTS "Admin All Enrollments" ON public.course_enrollments;

CREATE POLICY "Students Read Own Enrollments"
ON public.course_enrollments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin All Enrollments"
ON public.course_enrollments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Course Lesson Media
CREATE TABLE IF NOT EXISTS public.course_lesson_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('cloudflare_stream', 'mux', 'supabase_storage', 'youtube_unlisted', 'external')),
  asset_id TEXT NOT NULL,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_course_lesson_media_course ON public.course_lesson_media (course_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_media_lesson ON public.course_lesson_media (lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_media_lookup ON public.course_lesson_media (course_id, lesson_id);

ALTER TABLE public.course_lesson_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin All Lesson Media" ON public.course_lesson_media;
CREATE POLICY "Admin All Lesson Media"
ON public.course_lesson_media
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Playback token / authorization RPC
CREATE OR REPLACE FUNCTION public.get_course_lesson_playback(
  p_course_id UUID,
  p_lesson_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media RECORD;
  v_is_enrolled BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT * INTO v_media
  FROM public.course_lesson_media
  WHERE course_id = p_course_id AND lesson_id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'error', 'Lesson media not found or not configured'
    );
  END IF;

  IF v_media.is_preview = true THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_preview', true,
      'provider', v_media.provider,
      'asset_id', v_media.asset_id,
      'playback_type', 'preview',
      'expires_at', (now() + interval '15 minutes')
    );
  END IF;

  v_is_admin := public.is_admin();
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_admin', true,
      'provider', v_media.provider,
      'asset_id', v_media.asset_id,
      'playback_type', 'admin_preview',
      'expires_at', (now() + interval '30 minutes')
    );
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'error', 'Authentication required for paid course lessons'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.course_enrollments
    WHERE user_id = v_user_id
      AND course_id = p_course_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_enrolled;

  IF v_is_enrolled THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_enrolled', true,
      'provider', v_media.provider,
      'asset_id', v_media.asset_id,
      'playback_type', 'enrolled_student',
      'expires_at', (now() + interval '15 minutes')
    );
  END IF;

  RETURN jsonb_build_object(
    'authorized', false,
    'error', 'Active enrollment required to access this lesson'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_lesson_playback(UUID, TEXT) TO anon, authenticated;

-- =====================================================================================
-- STUDENT / USER DASHBOARD FOUNDATION TABLES & RLS (Phase 1 Step 1A)
-- =====================================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  headline TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON public.profiles (updated_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Automated Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. LESSON PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_course_lesson UNIQUE(user_id, course_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON public.lesson_progress (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_updated_at ON public.lesson_progress (updated_at DESC);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can view own lesson progress"
  ON public.lesson_progress FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can insert own lesson progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can update own lesson progress"
  ON public.lesson_progress FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 3. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'course' | 'consultation' | 'subscription'
  item_id UUID,
  item_title TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'captured',
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON public.payments (razorpay_payment_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin All Payments" ON public.payments;
CREATE POLICY "Admin All Payments"
  ON public.payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin All Notifications" ON public.notifications;
CREATE POLICY "Admin All Notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. STUDENT BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.student_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('resource', 'framework', 'article', 'video')),
  content_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_bookmark UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user ON public.student_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_lookup ON public.student_bookmarks(user_id, content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_created ON public.student_bookmarks(created_at DESC);

ALTER TABLE public.student_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_bookmarks_select_policy" ON public.student_bookmarks;
CREATE POLICY "student_bookmarks_select_policy"
  ON public.student_bookmarks FOR SELECT
  USING (auth.uid() = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "student_bookmarks_insert_policy" ON public.student_bookmarks;
CREATE POLICY "student_bookmarks_insert_policy"
  ON public.student_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "student_bookmarks_delete_policy" ON public.student_bookmarks;
CREATE POLICY "student_bookmarks_delete_policy"
  ON public.student_bookmarks FOR DELETE
  USING (auth.uid() = user_id OR (SELECT public.is_admin()));



