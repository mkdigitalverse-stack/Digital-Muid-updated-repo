-- ==============================================================================
-- Migration: 20260919000001_create_student_bookmarks_table.sql
-- Description: Creates the public.student_bookmarks table for student saved content
-- (resources, frameworks, articles, videos) with strict student-scoped RLS policies.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('resource', 'framework', 'article', 'video')),
  content_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_bookmark UNIQUE (user_id, content_type, content_id)
);

-- Comments
COMMENT ON TABLE public.student_bookmarks IS 'Stores student saved/bookmarked learning resources, frameworks, insights, and videos.';
COMMENT ON COLUMN public.student_bookmarks.user_id IS 'References the authenticated user (auth.users) who owns the bookmark.';
COMMENT ON COLUMN public.student_bookmarks.content_type IS 'Type of bookmarked entity: resource, framework, article, or video.';
COMMENT ON COLUMN public.student_bookmarks.content_id IS 'Unique identifier or slug of the bookmarked entity.';

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user ON public.student_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_lookup ON public.student_bookmarks(user_id, content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_created ON public.student_bookmarks(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.student_bookmarks ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies
-- ------------------------------------------------------------------------------

-- 1. SELECT: Students can read only their own bookmarks. Admins can view all bookmarks.
CREATE POLICY "student_bookmarks_select_policy"
  ON public.student_bookmarks
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- 2. INSERT: Students can create bookmarks only for themselves.
CREATE POLICY "student_bookmarks_insert_policy"
  ON public.student_bookmarks
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- 3. DELETE: Students can delete only their own bookmarks.
CREATE POLICY "student_bookmarks_delete_policy"
  ON public.student_bookmarks
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    (SELECT public.is_admin())
  );

-- Anonymous users have no access (no public policy granted).
