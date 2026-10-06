-- ==============================================================================
-- Migration: 20260925000001_create_student_course_wishlist_table.sql
-- Description: Phase 4A - Creates public.student_course_wishlist table for dedicated
-- course wishlisting (commercial consideration) with strict student-scoped RLS policies.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_course_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_course_wishlist UNIQUE (user_id, course_id)
);

-- Comments
COMMENT ON TABLE public.student_course_wishlist IS 'Stores student wishlisted courses being considered for future enrollment/purchase.';
COMMENT ON COLUMN public.student_course_wishlist.user_id IS 'References the authenticated student (auth.users) who owns the wishlist entry.';
COMMENT ON COLUMN public.student_course_wishlist.course_id IS 'References the specific course (public.courses) wishlisted by the student.';

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_student_course_wishlist_user ON public.student_course_wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_student_course_wishlist_course ON public.student_course_wishlist(course_id);
CREATE INDEX IF NOT EXISTS idx_student_course_wishlist_lookup ON public.student_course_wishlist(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_student_course_wishlist_created ON public.student_course_wishlist(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.student_course_wishlist ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies
-- ------------------------------------------------------------------------------

-- 1. SELECT: Students can read only their own wishlisted courses. Admins can view all.
CREATE POLICY "student_course_wishlist_select_policy"
  ON public.student_course_wishlist
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- 2. INSERT: Students can add courses to wishlist only for themselves.
CREATE POLICY "student_course_wishlist_insert_policy"
  ON public.student_course_wishlist
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- 3. DELETE: Students can remove courses from wishlist only for themselves.
CREATE POLICY "student_course_wishlist_delete_policy"
  ON public.student_course_wishlist
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- Anonymous users have no access (no anon policies granted).
