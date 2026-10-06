-- =====================================================================================
-- MIGRATION: 20260918000001_create_student_dashboard_foundation.sql
-- DESCRIPTION: Phase 1 Step 1A - Database Foundation & RLS for Student / User Dashboard
-- 
-- 1. Adds optional user_id to bookings table with indexing
-- 2. Creates profiles table with isolated RLS
-- 3. Creates lesson_progress table with isolated RLS
-- 4. Creates payments table with isolated RLS
-- 5. Creates notifications table with isolated RLS
-- 6. Updates course_enrollments RLS so students can SELECT their own enrollments
-- 7. Updates bookings RLS so students can SELECT their own bookings by user_id or email
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. ENHANCE BOOKINGS TABLE (Add user_id link)
-- -------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id);

-- -------------------------------------------------------------------------------------
-- 2. PROFILES TABLE
-- -------------------------------------------------------------------------------------
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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
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

-- -------------------------------------------------------------------------------------
-- 3. LESSON PROGRESS TABLE
-- -------------------------------------------------------------------------------------
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

-- Enable RLS
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Lesson Progress Policies
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

-- -------------------------------------------------------------------------------------
-- 4. PAYMENTS TABLE
-- -------------------------------------------------------------------------------------
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
  status TEXT NOT NULL DEFAULT 'captured', -- 'pending' | 'captured' | 'failed' | 'refunded'
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON public.payments (razorpay_payment_id);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Payments Policies
-- Authenticated users can only read their own payment records.
-- Students are NOT allowed to INSERT, UPDATE, or DELETE payment records.
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin All Payments" ON public.payments;
CREATE POLICY "Admin All Payments"
  ON public.payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------------------
-- 5. NOTIFICATIONS TABLE
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info' | 'success' | 'warning' | 'system'
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications Policies
-- Authenticated users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Authenticated users can update their own notifications (e.g. marking as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Only admins (or system processes) can insert/delete notifications
DROP POLICY IF EXISTS "Admin All Notifications" ON public.notifications;
CREATE POLICY "Admin All Notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------------------
-- 6. UPDATE COURSE_ENROLLMENTS RLS
-- Students can SELECT their own enrollments; Admins retain full management.
-- Students cannot INSERT, UPDATE, or DELETE course_enrollments.
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own active enrollments" ON public.course_enrollments;
CREATE POLICY "Students can view own active enrollments"
  ON public.course_enrollments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- -------------------------------------------------------------------------------------
-- 7. UPDATE BOOKINGS RLS
-- Students can SELECT their own bookings via user_id or customer_email.
-- Preserves public INSERT for anonymous/guest booking and Admin full management.
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.role() = 'authenticated' AND customer_email = (auth.jwt() ->> 'email')) OR
    public.is_admin()
  );
