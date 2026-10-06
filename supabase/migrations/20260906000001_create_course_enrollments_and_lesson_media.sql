-- =========================================================================
-- DIGITAL MUID — STEP 6C-2: COURSE ENROLLMENTS & SECURE LESSON MEDIA
-- =========================================================================

-- 1. Table: course_enrollments
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

-- Indexes for course_enrollments
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON public.course_enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON public.course_enrollments (status);

-- Enable RLS on course_enrollments
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop pre-existing policies for idempotency
DROP POLICY IF EXISTS "Students Read Own Enrollments" ON public.course_enrollments;
DROP POLICY IF EXISTS "Admin All Enrollments" ON public.course_enrollments;

-- Policy: Students can only SELECT their own enrollment records
CREATE POLICY "Students Read Own Enrollments"
ON public.course_enrollments
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Administrators manage all enrollments using existing public.is_admin()
CREATE POLICY "Admin All Enrollments"
ON public.course_enrollments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Table: course_lesson_media
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

-- Indexes for course_lesson_media
CREATE INDEX IF NOT EXISTS idx_course_lesson_media_course ON public.course_lesson_media (course_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_media_lesson ON public.course_lesson_media (lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_media_lookup ON public.course_lesson_media (course_id, lesson_id);

-- Enable RLS on course_lesson_media
ALTER TABLE public.course_lesson_media ENABLE ROW LEVEL SECURITY;

-- Drop pre-existing policies for idempotency
DROP POLICY IF EXISTS "Admin All Lesson Media" ON public.course_lesson_media;
DROP POLICY IF EXISTS "Deny Public Read Lesson Media" ON public.course_lesson_media;

-- Policy: Administrators can manage all lesson media using public.is_admin()
CREATE POLICY "Admin All Lesson Media"
ON public.course_lesson_media
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Note: No SELECT policy is granted to anonymous or authenticated students on course_lesson_media.
-- Media access is strictly gated through the secure RPC function below.

-- 3. Secure Playback Authorization Function
-- Accessible by both authenticated users and anon (for previews).
-- Validates:
--   Rule 1 (Preview): If is_preview = true, allow playback.
--   Rule 2 (Admin): If public.is_admin() = true, allow playback.
--   Rule 3 (Enrolled Student): If active enrollment exists and not expired, allow playback.
--   Rule 4 (Unauthorized): Raise permission denied / return authorized = false.
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
  v_playback_token TEXT;
  v_playback_url TEXT;
BEGIN
  -- 1. Locate the lesson media record
  SELECT * INTO v_media
  FROM public.course_lesson_media
  WHERE course_id = p_course_id AND lesson_id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'error', 'Lesson media not found or not configured'
    );
  END IF;

  -- 2. Rule 1: Free Preview allows instant authorization
  IF v_media.is_preview = true THEN
    -- In production Cloudflare Stream, token is generated via Cloudflare API signing key.
    -- Here we return the scoped playback authorization payload.
    RETURN jsonb_build_object(
      'authorized', true,
      'is_preview', true,
      'provider', v_media.provider,
      'asset_id', v_media.asset_id,
      'playback_type', 'preview',
      'expires_at', (now() + interval '15 minutes')
    );
  END IF;

  -- 3. Check for Admin Privileges
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

  -- 4. Check for Authenticated User
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'error', 'Authentication required for paid course lessons'
    );
  END IF;

  -- 5. Rule 3: Check Active Course Enrollment
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

  -- 6. Rule 4: Not Authorized
  RETURN jsonb_build_object(
    'authorized', false,
    'error', 'Active enrollment required to access this lesson'
  );
END;
$$;

-- Grant EXECUTE to public & authenticated so preview and enrolled access can be checked
GRANT EXECUTE ON FUNCTION public.get_course_lesson_playback(UUID, TEXT) TO anon, authenticated;
