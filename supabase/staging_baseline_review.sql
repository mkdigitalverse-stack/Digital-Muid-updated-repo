-- ==============================================================================
-- DIGITAL MUID — AUTHORITATIVE STAGING DATABASE BASELINE (REVIEW-ONLY)
-- File: supabase/staging_baseline_review.sql
-- ==============================================================================
-- PURPOSE:
-- Consolidated single-file SQL baseline for a brand-new, empty staging Supabase
-- project. Resolves all 7 identified schema discrepancies, eliminates duplicate
-- policy collisions, integrates all 21 historical migrations, and aligns with
-- server/client service expectations.
--
-- RESOLUTIONS INCLUDED:
-- 1. All 5 missing foundational tables (bookings, availability_rules, crm_leads,
--    newsletter_subscribers, site_settings) and required extensions (uuid-ossp, pgcrypto).
-- 2. consultation_products primary key typed as UUID with authoritative catalog seed.
-- 3. Final resource_purchases schema: nullable user_id, customer_email,
--    customer_phone, unique razorpay_payment_id, and partial unique index on (user_id, resource_id).
-- 4. Authoritative Phase 4B fulfill_course_enrollment() with atomic wishlist removal.
-- 5. Authoritative issue_student_certificate() with 100% curriculum completion check.
-- 6. Fully idempotent RLS policies (DROP POLICY IF EXISTS before CREATE POLICY).
-- 7. Automated registration of all 21 migration versions in schema_migrations.
--
-- STRICT OPERATOR NOTICE:
-- This file is for staging initialization ONLY. NEVER execute against production!
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CONSULTATION PRODUCTS TABLE
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_consultation_products_active ON public.consultation_products (active);
CREATE INDEX IF NOT EXISTS idx_consultation_products_updated ON public.consultation_products (updated_at DESC);

-- Baseline Seed for Authoritative Consultation Service
INSERT INTO public.consultation_products (
  id, name, duration_minutes, base_price, gst_rate, currency, active, description, features
) VALUES (
  '31bbb9bf-ce10-4da4-a517-dfc673f9b875',
  'Business Growth & Scaling Consultation',
  30,
  499.00,
  0.18,
  'INR',
  true,
  '1-on-1 strategic growth advisory session tailored to your performance marketing and brand scaling objectives.',
  '["Comprehensive Meta & Google Ads Audit", "Funnel Conversion Rate Optimization Plan", "Personalized Scaling Roadmap & CAC Benchmarks", "Direct 1-on-1 Strategy Session with Muid", "Recording & Custom Action Plan Included"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  base_price = EXCLUDED.base_price,
  gst_rate = EXCLUDED.gst_rate,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- 2. AVAILABILITY RULES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_rules (
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

INSERT INTO public.availability_rules (id)
VALUES ('primary_availability_rules')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. BOOKINGS TABLE & UNIQUE SLOT CONSTRAINT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
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
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'rescheduled', 'cancelled', 'completed')),
  payment_id TEXT,
  razorpay_order_id TEXT,
  cancellation_reason TEXT,
  rescheduled_from TEXT,
  meeting_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON public.bookings (customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);

-- Migration 20260826000001: Prevent duplicate active bookings on same slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_slot
  ON public.bookings (booking_date, booking_time)
  WHERE status IN ('confirmed', 'rescheduled');

-- ------------------------------------------------------------------------------
-- 4. CRM LEADS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'Website',
  interest TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Converted', 'Lost')),
  amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON public.crm_leads (email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads (status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads (created_at DESC);

-- Backward-compatibility view for services referencing public.leads
CREATE OR REPLACE VIEW public.leads AS SELECT * FROM public.crm_leads;

-- ------------------------------------------------------------------------------
-- 5. NEWSLETTER SUBSCRIBERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'Footer',
  active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscribers (email);

-- ------------------------------------------------------------------------------
-- 6. CONTACT MESSAGES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone VARCHAR(30),
  inquiry_type TEXT NOT NULL DEFAULT 'General Inquiry',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON public.contact_messages (email);

-- ------------------------------------------------------------------------------
-- 7. SITE SETTINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 8. ARTICLES TABLE (CMS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  author JSONB NOT NULL,
  featured_image TEXT NOT NULL,
  reading_time_minutes INTEGER NOT NULL DEFAULT 5,
  tags TEXT[] NOT NULL DEFAULT '{}',
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles (slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_is_featured ON public.articles (is_featured);

-- ------------------------------------------------------------------------------
-- 9. VIDEOS TABLE (CMS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.videos (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  duration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_slug ON public.videos (slug);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos (status);
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos (category);

-- ------------------------------------------------------------------------------
-- 10. RESOURCES TABLE (CMS & TOOLKITS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  format TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  access_type TEXT NOT NULL DEFAULT 'free' CHECK (access_type IN ('free', 'paid')),
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  cover_image TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_slug ON public.resources (slug);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources (status);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources (category);
CREATE INDEX IF NOT EXISTS idx_resources_access_type ON public.resources (access_type);
CREATE INDEX IF NOT EXISTS idx_resources_price ON public.resources (price);

-- ------------------------------------------------------------------------------
-- 11. FRAMEWORKS & CATEGORIES TABLES (CMS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.framework_categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_framework_categories_slug ON public.framework_categories (slug);
CREATE INDEX IF NOT EXISTS idx_framework_categories_sort ON public.framework_categories (sort_order ASC);

CREATE TABLE IF NOT EXISTS public.frameworks (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.framework_categories(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  framework_type TEXT NOT NULL,
  estimated_read_time_minutes INTEGER NOT NULL DEFAULT 5,
  cover_image TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_frameworks_slug ON public.frameworks (slug);
CREATE INDEX IF NOT EXISTS idx_frameworks_category ON public.frameworks (category_id);
CREATE INDEX IF NOT EXISTS idx_frameworks_status ON public.frameworks (status);

-- ------------------------------------------------------------------------------
-- 12. COURSES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
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
  curriculum JSONB NOT NULL DEFAULT '[]'::jsonb,
  highlights TEXT[] NOT NULL DEFAULT '{}',
  tools_covered TEXT[] NOT NULL DEFAULT '{}',
  instructor JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses (status);

-- ------------------------------------------------------------------------------
-- 13. PROFILES TABLE & REGISTRATION TRIGGER
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  phone TEXT,
  headline TEXT,
  company TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'instructor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automated profile creation trigger on auth.users registration
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

-- ------------------------------------------------------------------------------
-- 14. STUDENT DASHBOARD FOUNDATION: ENROLLMENTS & LESSON MEDIA
-- ------------------------------------------------------------------------------
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
  CONSTRAINT uq_course_enrollment UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON public.course_enrollments (course_id);

CREATE TABLE IF NOT EXISTS public.course_lesson_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('cloudflare_stream', 'mux', 'supabase_storage', 'youtube_unlisted', 'external')),
  asset_id TEXT NOT NULL,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_course_lesson_media UNIQUE (course_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_course_lesson_media_lookup ON public.course_lesson_media (course_id, lesson_id);

-- ------------------------------------------------------------------------------
-- 15. LESSON PROGRESS, PAYMENTS & NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  playback_seconds INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_lesson_progress UNIQUE (user_id, course_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress (user_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('course', 'consultation', 'resource', 'bundle')),
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'refunded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON public.payments (razorpay_payment_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('enrollment_success', 'course_update', 'live_session_reminder', 'consultation_scheduled', 'system_notice', 'certificate_issued')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS public.student_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('resource', 'framework', 'article', 'video')),
  content_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_bookmark UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user ON public.student_bookmarks (user_id);

-- ------------------------------------------------------------------------------
-- 16. CERTIFICATES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_hash TEXT UNIQUE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_course_certificate UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates (certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_hash ON public.certificates (verification_hash);

-- ------------------------------------------------------------------------------
-- 17. STUDENT COURSE WISHLIST TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_course_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_course_wishlist UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_student_course_wishlist_user ON public.student_course_wishlist (user_id);

-- ------------------------------------------------------------------------------
-- 18. RESOURCE PURCHASES TABLE (CORRECTED AUTHORITATIVE SCHEMA)
-- ------------------------------------------------------------------------------
-- Resolves the 20261020000001 / 20261022000001 conflict:
-- 1. user_id is NULLABLE to support unauthenticated guest purchases.
-- 2. customer_email and customer_phone included for guest delivery and recovery.
-- 3. razorpay_payment_id has unique constraint for paymentFulfillment upsert idempotency.
-- 4. Partial unique index allows multiple guest purchases while restricting duplicate purchases per user.
CREATE TABLE IF NOT EXISTS public.resource_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email TEXT,
  customer_phone TEXT,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_resource_purchases_payment UNIQUE (razorpay_payment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_resource_purchase 
  ON public.resource_purchases (user_id, resource_id) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resource_purchases_user_id ON public.resource_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_resource_id ON public.resource_purchases (resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_order_id ON public.resource_purchases (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_payment_id ON public.resource_purchases (razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_email ON public.resource_purchases (customer_email);
CREATE INDEX IF NOT EXISTS idx_resource_purchases_status ON public.resource_purchases (status);

-- ------------------------------------------------------------------------------
-- 19. EMAIL LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT,
  order_id TEXT,
  recipient_email TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped', 'pending')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_email_logs_payment_template UNIQUE (payment_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_email_logs_payment ON public.email_logs (payment_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_order ON public.email_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);

-- ==============================================================================
-- AUTHORITATIVE DATABASE FUNCTIONS & RPCS (SECURITY DEFINER)
-- ==============================================================================

-- 1. HARDENED is_admin() FUNCTION
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

-- 2. SECURE PLAYBACK AUTHORIZATION FUNCTION
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
      'asset_id', v_media.asset_id
    );
  END IF;

  IF v_user_id IS NOT NULL THEN
    v_is_admin := public.is_admin();
    IF v_is_admin THEN
      RETURN jsonb_build_object(
        'authorized', true,
        'is_admin', true,
        'provider', v_media.provider,
        'asset_id', v_media.asset_id
      );
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.course_enrollments
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
        'asset_id', v_media.asset_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'authorized', false,
    'error', 'Enrollment required to access this lesson'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_lesson_playback(UUID, TEXT) TO authenticated, anon;

-- 3. INCREMENT RESOURCE DOWNLOADS RPC
CREATE OR REPLACE FUNCTION public.increment_resource_downloads(resource_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.resources
  SET download_count = download_count + 1
  WHERE id = resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_resource_downloads(UUID) TO authenticated, anon;

-- 4. HARDENED CERTIFICATE ISSUANCE RPC (100% COMPLETION CHECK)
CREATE OR REPLACE FUNCTION public.issue_student_certificate(
  p_course_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cert public.certificates%ROWTYPE;
  v_enrollment RECORD;
  v_course RECORD;
  v_total_lessons INT := 0;
  v_completed_lessons INT := 0;
  v_recipient_name TEXT;
  v_cert_number TEXT;
  v_verification_hash TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_cert
  FROM public.certificates
  WHERE user_id = v_user_id AND course_id = p_course_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_issued', true,
      'certificate_number', v_cert.certificate_number,
      'verification_hash', v_cert.verification_hash,
      'issued_at', v_cert.issued_at
    );
  END IF;

  SELECT * INTO v_enrollment
  FROM public.course_enrollments
  WHERE user_id = v_user_id
    AND course_id = p_course_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active course enrollment required.');
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Course record not found.');
  END IF;

  SELECT count(*)::INT INTO v_total_lessons
  FROM jsonb_array_elements(COALESCE(v_course.curriculum, '[]'::jsonb)) AS m,
       jsonb_array_elements(COALESCE(m->'lessons', '[]'::jsonb)) AS l;

  IF v_total_lessons = 0 THEN
    v_total_lessons := 1;
  END IF;

  SELECT count(*)::INT INTO v_completed_lessons
  FROM public.lesson_progress
  WHERE user_id = v_user_id AND course_id = p_course_id AND is_completed = true;

  IF v_completed_lessons < v_total_lessons THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'All curriculum lessons must be completed to issue certificate.',
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons
    );
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Student Graduate') INTO v_recipient_name
  FROM public.profiles WHERE id = v_user_id;

  v_cert_number := 'DM-CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  v_verification_hash := encode(digest(v_cert_number || ':' || v_user_id::text || ':' || p_course_id::text, 'sha256'), 'hex');

  INSERT INTO public.certificates (
    certificate_number, user_id, course_id, recipient_name, course_title, issued_at, verification_hash
  ) VALUES (
    v_cert_number, v_user_id, p_course_id, v_recipient_name, v_course.title, now(), v_verification_hash
  ) RETURNING * INTO v_cert;

  RETURN jsonb_build_object(
    'success', true,
    'already_issued', false,
    'certificate_number', v_cert.certificate_number,
    'verification_hash', v_cert.verification_hash,
    'issued_at', v_cert.issued_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_student_certificate(UUID) TO authenticated;

-- 5. ATOMIC COURSE ENROLLMENT FULFILLMENT RPC (PHASE 4B WITH WISHLIST REMOVAL)
CREATE OR REPLACE FUNCTION public.fulfill_course_enrollment(
  p_user_id UUID,
  p_course_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_order_id TEXT,
  p_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course public.courses%ROWTYPE;
  v_effective_price NUMERIC(10,2);
  v_expected_currency TEXT;
  v_payment_id UUID;
  v_enrollment_id UUID;
  v_already_fulfilled BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_course_id IS NULL OR p_order_id IS NULL OR p_payment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required fulfillment parameters.');
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Course not found.');
  END IF;

  IF v_course.offer_price IS NOT NULL AND v_course.offer_price > 0 AND (v_course.offer_expires_at IS NULL OR v_course.offer_expires_at > now()) THEN
    v_effective_price := v_course.offer_price;
  ELSE
    v_effective_price := v_course.price;
  END IF;

  v_expected_currency := upper(coalesce(v_course.currency, 'INR'));

  -- Idempotency check on payments
  SELECT id INTO v_payment_id FROM public.payments WHERE razorpay_payment_id = p_payment_id;
  IF FOUND THEN
    v_already_fulfilled := true;
  ELSE
    INSERT INTO public.payments (
      user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status
    ) VALUES (
      p_user_id, 'course', p_course_id::text, v_course.title, v_effective_price, v_expected_currency, p_order_id, p_payment_id, 'captured'
    ) RETURNING id INTO v_payment_id;
  END IF;

  -- Create or reactivate enrollment
  INSERT INTO public.course_enrollments (
    user_id, course_id, status, enrolled_at, source, order_id
  ) VALUES (
    p_user_id, p_course_id, 'active', now(), 'purchase', p_order_id
  ) ON CONFLICT (user_id, course_id) DO UPDATE SET
    status = 'active',
    order_id = EXCLUDED.order_id,
    updated_at = now()
  RETURNING id INTO v_enrollment_id;

  -- Remove fulfilled course from student wishlist (Phase 4B)
  DELETE FROM public.student_course_wishlist
  WHERE user_id = p_user_id AND course_id = p_course_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_fulfilled', v_already_fulfilled,
    'payment_id', v_payment_id,
    'enrollment_id', v_enrollment_id,
    'course_slug', v_course.slug,
    'course_title', v_course.title,
    'amount', v_effective_price,
    'currency', v_expected_currency
  );
END;
$$;

-- Strict permission hardening: fulfill_course_enrollment restricted to service_role and postgres
REVOKE EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO postgres;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — IDEMPOTENT WITH DROP POLICY IF EXISTS
-- ==============================================================================

ALTER TABLE public.consultation_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.framework_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_course_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 1. consultation_products
DROP POLICY IF EXISTS "Public can view active consultation products" ON public.consultation_products;
CREATE POLICY "Public can view active consultation products" ON public.consultation_products FOR SELECT USING (active = true OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS "Admins can insert consultation products" ON public.consultation_products;
CREATE POLICY "Admins can insert consultation products" ON public.consultation_products FOR INSERT WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Admins can update consultation products" ON public.consultation_products;
CREATE POLICY "Admins can update consultation products" ON public.consultation_products FOR UPDATE USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 2. availability_rules
DROP POLICY IF EXISTS "Public Read Availability Rules" ON public.availability_rules;
CREATE POLICY "Public Read Availability Rules" ON public.availability_rules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Availability Rules" ON public.availability_rules;
CREATE POLICY "Admin All Availability Rules" ON public.availability_rules FOR ALL USING (public.is_admin());

-- 3. bookings
DROP POLICY IF EXISTS "Public Insert Bookings" ON public.bookings;
CREATE POLICY "Public Insert Bookings" ON public.bookings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin All Bookings" ON public.bookings;
CREATE POLICY "Admin All Bookings" ON public.bookings FOR ALL USING (public.is_admin());

-- 4. crm_leads
DROP POLICY IF EXISTS "Admin All CRM Leads" ON public.crm_leads;
CREATE POLICY "Admin All CRM Leads" ON public.crm_leads FOR ALL USING (public.is_admin());

-- 5. newsletter_subscribers
DROP POLICY IF EXISTS "Public Insert Newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Public Insert Newsletter" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin All Newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Admin All Newsletter" ON public.newsletter_subscribers FOR ALL USING (public.is_admin());

-- 6. contact_messages
DROP POLICY IF EXISTS "Public Insert Contact Messages" ON public.contact_messages;
CREATE POLICY "Public Insert Contact Messages" ON public.contact_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin All Contact Messages" ON public.contact_messages;
CREATE POLICY "Admin All Contact Messages" ON public.contact_messages FOR ALL USING (public.is_admin());

-- 7. site_settings
DROP POLICY IF EXISTS "Public Read Site Settings" ON public.site_settings;
CREATE POLICY "Public Read Site Settings" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Site Settings" ON public.site_settings;
CREATE POLICY "Admin All Site Settings" ON public.site_settings FOR ALL USING (public.is_admin());

-- 8. articles
DROP POLICY IF EXISTS "Public Read Published Articles" ON public.articles;
CREATE POLICY "Public Read Published Articles" ON public.articles FOR SELECT USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Articles" ON public.articles;
CREATE POLICY "Admin All Articles" ON public.articles FOR ALL USING (public.is_admin());

-- 9. videos
DROP POLICY IF EXISTS "Public Read Published Videos" ON public.videos;
CREATE POLICY "Public Read Published Videos" ON public.videos FOR SELECT USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Videos" ON public.videos;
CREATE POLICY "Admin All Videos" ON public.videos FOR ALL USING (public.is_admin());

-- 10. resources
DROP POLICY IF EXISTS "Public Read Published Resources" ON public.resources;
CREATE POLICY "Public Read Published Resources" ON public.resources FOR SELECT USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Resources" ON public.resources;
CREATE POLICY "Admin All Resources" ON public.resources FOR ALL USING (public.is_admin());

-- 11. framework_categories & frameworks
DROP POLICY IF EXISTS "Public Read Active Framework Categories" ON public.framework_categories;
CREATE POLICY "Public Read Active Framework Categories" ON public.framework_categories FOR SELECT USING (active = true OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Framework Categories" ON public.framework_categories;
CREATE POLICY "Admin All Framework Categories" ON public.framework_categories FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public Read Published Frameworks" ON public.frameworks;
CREATE POLICY "Public Read Published Frameworks" ON public.frameworks FOR SELECT USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Frameworks" ON public.frameworks;
CREATE POLICY "Admin All Frameworks" ON public.frameworks FOR ALL USING (public.is_admin());

-- 12. courses
DROP POLICY IF EXISTS "Public Read Published Courses" ON public.courses;
CREATE POLICY "Public Read Published Courses" ON public.courses FOR SELECT USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Courses" ON public.courses;
CREATE POLICY "Admin All Courses" ON public.courses FOR ALL USING (public.is_admin());

-- 13. profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Profiles" ON public.profiles;
CREATE POLICY "Admin All Profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- 14. course_enrollments
DROP POLICY IF EXISTS "Students Read Own Enrollments" ON public.course_enrollments;
CREATE POLICY "Students Read Own Enrollments" ON public.course_enrollments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Enrollments" ON public.course_enrollments;
CREATE POLICY "Admin All Enrollments" ON public.course_enrollments FOR ALL USING (public.is_admin());

-- 15. course_lesson_media (Gated through RPC, denied from direct public/student read)
DROP POLICY IF EXISTS "Admin All Lesson Media" ON public.course_lesson_media;
CREATE POLICY "Admin All Lesson Media" ON public.course_lesson_media FOR ALL USING (public.is_admin());

-- 16. lesson_progress
DROP POLICY IF EXISTS "Users can view own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can view own lesson progress" ON public.lesson_progress FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Users can insert own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can insert own lesson progress" ON public.lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Users can update own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can update own lesson progress" ON public.lesson_progress FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- 17. payments (Write restricted to service_role)
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Payments" ON public.payments;
CREATE POLICY "Admin All Payments" ON public.payments FOR ALL USING (public.is_admin());

-- 18. notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Notifications" ON public.notifications;
CREATE POLICY "Admin All Notifications" ON public.notifications FOR ALL USING (public.is_admin());

-- 19. student_bookmarks
DROP POLICY IF EXISTS "student_bookmarks_select_policy" ON public.student_bookmarks;
CREATE POLICY "student_bookmarks_select_policy" ON public.student_bookmarks FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "student_bookmarks_insert_policy" ON public.student_bookmarks;
CREATE POLICY "student_bookmarks_insert_policy" ON public.student_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "student_bookmarks_delete_policy" ON public.student_bookmarks;
CREATE POLICY "student_bookmarks_delete_policy" ON public.student_bookmarks FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- 20. certificates (Direct insert restricted to admin; issuance via RPC)
DROP POLICY IF EXISTS "certificates_public_select_policy" ON public.certificates;
CREATE POLICY "certificates_public_select_policy" ON public.certificates FOR SELECT USING (true);
DROP POLICY IF EXISTS "certificates_insert_policy" ON public.certificates;
CREATE POLICY "certificates_insert_policy" ON public.certificates FOR INSERT WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "certificates_admin_policy" ON public.certificates;
CREATE POLICY "certificates_admin_policy" ON public.certificates FOR ALL USING ((SELECT public.is_admin()));

-- 21. student_course_wishlist
DROP POLICY IF EXISTS "student_course_wishlist_select_policy" ON public.student_course_wishlist;
CREATE POLICY "student_course_wishlist_select_policy" ON public.student_course_wishlist FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "student_course_wishlist_insert_policy" ON public.student_course_wishlist;
CREATE POLICY "student_course_wishlist_insert_policy" ON public.student_course_wishlist FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "student_course_wishlist_delete_policy" ON public.student_course_wishlist;
CREATE POLICY "student_course_wishlist_delete_policy" ON public.student_course_wishlist FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- 22. resource_purchases
DROP POLICY IF EXISTS "Users can view own resource purchases" ON public.resource_purchases;
CREATE POLICY "Users can view own resource purchases" ON public.resource_purchases FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admin All Resource Purchases" ON public.resource_purchases;
CREATE POLICY "Admin All Resource Purchases" ON public.resource_purchases FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 23. email_logs (Read restricted to admin; writes via service_role)
DROP POLICY IF EXISTS "Admin View Email Logs" ON public.email_logs;
CREATE POLICY "Admin View Email Logs" ON public.email_logs FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admin All Email Logs" ON public.email_logs;
CREATE POLICY "Admin All Email Logs" ON public.email_logs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================================
-- SYNCHRONIZE SUPABASE CLI MIGRATION TRACKING TABLE
-- ==============================================================================
-- Ensures that future 'supabase db push' commands recognize all 21 historical
-- migrations as already applied to this baseline schema.
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  statements TEXT[],
  name TEXT
);

INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('20260826000001'),
  ('20260826000002'),
  ('20260828000001'),
  ('20260830000001'),
  ('20260830000002'),
  ('20260830000003'),
  ('20260831000001'),
  ('20260831000002'),
  ('20260906000001'),
  ('20260918000001'),
  ('20260918000002'),
  ('20260919000001'),
  ('20260919000002'),
  ('20260919000003'),
  ('20260921000001'),
  ('20260925000001'),
  ('20260925000002'),
  ('20260926000001'),
  ('20261020000001'),
  ('20261022000001'),
  ('20261025000001')
ON CONFLICT (version) DO NOTHING;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
