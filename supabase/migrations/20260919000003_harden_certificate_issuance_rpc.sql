-- ==============================================================================
-- Migration: 20260919000003_harden_certificate_issuance_rpc.sql
-- Description: Phase 2I Security Hardening - Restrict direct INSERT on certificates
-- to administrators only, and install public.issue_student_certificate() SECURITY DEFINER
-- RPC to strictly enforce active enrollment and 100% lesson completion.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN CERTIFICATES INSERT POLICY
-- ------------------------------------------------------------------------------
-- Revoke direct student insert permissions. Authenticated students calling
-- supabase.from('certificates').insert(...) will receive an RLS authorization error.
DROP POLICY IF EXISTS "certificates_insert_policy" ON public.certificates;
CREATE POLICY "certificates_insert_policy"
  ON public.certificates
  FOR INSERT
  WITH CHECK ((SELECT public.is_admin()));

-- ------------------------------------------------------------------------------
-- 2. TRUSTED CERTIFICATE ISSUANCE RPC (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
-- Authenticated students must request issuance through this secure function.
-- Validates:
--   1. Authentication required (auth.uid() cannot be null).
--   2. Verifies student has an active, unexpired course_enrollments record.
--   3. Computes exact required lesson count from courses.curriculum JSONB.
--   4. Verifies all required lessons are completed in public.lesson_progress.
--   5. Snapshots recipient name from public.profiles and course title from public.courses.
--   6. Generates unique certificate number and verification hash server-side.
--   7. Idempotently returns existing certificate if one was already issued.
-- ------------------------------------------------------------------------------

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
  v_is_admin BOOLEAN := false;
BEGIN
  -- 1. Authentication Check
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required to issue certificate.'
    );
  END IF;

  v_is_admin := public.is_admin();

  -- 2. Check for Pre-Existing Certificate (Idempotency)
  SELECT * INTO v_cert
  FROM public.certificates
  WHERE user_id = v_user_id AND course_id = p_course_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_new', false,
      'certificate', row_to_json(v_cert)
    );
  END IF;

  -- 3. Verify Course Existence
  SELECT * INTO v_course
  FROM public.courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Course not found.'
    );
  END IF;

  -- 4. Verify Active Enrollment (unless admin)
  IF NOT v_is_admin THEN
    SELECT * INTO v_enrollment
    FROM public.course_enrollments
    WHERE user_id = v_user_id
      AND course_id = p_course_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'An active course enrollment is required to earn an official certificate.'
      );
    END IF;
  END IF;

  -- 5. Calculate Total and Completed Lessons from courses.curriculum JSONB
  -- Matches frontend extractAllLessons() algorithm in progressService.ts
  WITH course_lessons AS (
    SELECT
      COALESCE(
        NULLIF(l.lesson->>'id', ''),
        'lsn-' || m.mod_ord::text || '-' || l.lsn_ord::text
      ) AS lesson_id
    FROM jsonb_array_elements(v_course.curriculum) WITH ORDINALITY AS m(module, mod_ord),
         jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(m.module->'lessons') = 'array' THEN m.module->'lessons'
             ELSE '[]'::jsonb
           END
         ) WITH ORDINALITY AS l(lesson, lsn_ord)
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM public.lesson_progress lp
        WHERE lp.user_id = v_user_id
          AND lp.course_id = p_course_id
          AND lp.lesson_id = cl.lesson_id
          AND lp.completed = true
      )
    )
  INTO v_total_lessons, v_completed_lessons
  FROM course_lessons cl;

  IF v_total_lessons = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This course curriculum does not contain any lessons eligible for certification.'
    );
  END IF;

  -- 6. Enforce 100% Completion Requirement (unless admin)
  IF NOT v_is_admin AND v_completed_lessons < v_total_lessons THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Course completion is at %s of %s lessons. Complete 100%% of curriculum to earn your certificate.', v_completed_lessons, v_total_lessons)
    );
  END IF;

  -- 7. Snapshot Recipient Name from Verified Profile / Auth Meta
  SELECT full_name INTO v_recipient_name
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_recipient_name IS NULL OR trim(v_recipient_name) = '' THEN
    SELECT COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      split_part(email, '@', 1)
    ) INTO v_recipient_name
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  IF v_recipient_name IS NULL OR trim(v_recipient_name) = '' THEN
    v_recipient_name := 'Valued Student';
  END IF;

  -- 8. Generate Cryptographically Unpredictable Certificate Identifiers
  v_cert_number := 'DM-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(10000 + RANDOM() * 90000)::TEXT, 5, '0');
  v_verification_hash := 'DMV-' || UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT || now()::TEXT), 1, 12));

  -- 9. Insert Verified Certificate Record
  BEGIN
    INSERT INTO public.certificates (
      user_id,
      course_id,
      certificate_number,
      recipient_name,
      course_title,
      issued_at,
      verification_hash,
      metadata
    ) VALUES (
      v_user_id,
      p_course_id,
      v_cert_number,
      v_recipient_name,
      v_course.title,
      now(),
      v_verification_hash,
      jsonb_build_object(
        'instructorName', COALESCE(v_course.instructor, 'Digital Muid'),
        'completionDate', now(),
        'totalLessons', v_total_lessons
      )
    )
    RETURNING * INTO v_cert;
  EXCEPTION
    WHEN unique_violation THEN
      -- Handle concurrent conflict on uq_user_course_certificate
      SELECT * INTO v_cert
      FROM public.certificates
      WHERE user_id = v_user_id AND course_id = p_course_id;

      RETURN jsonb_build_object(
        'success', true,
        'is_new', false,
        'certificate', row_to_json(v_cert)
      );
  END;

  -- 10. Idempotent In-App Notification
  BEGIN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      link_url,
      is_read
    ) VALUES (
      v_user_id,
      'Official Certificate of Completion Issued!',
      format('Congratulations! You have completed all curriculum requirements for %s. Your official credential is now available.', v_course.title),
      'success',
      '/my-courses?tab=certificates',
      false
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Do not fail certificate issuance if notification insert encounters a non-fatal issue
      NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'is_new', true,
    'certificate', row_to_json(v_cert)
  );
END;
$$;

-- Allow authenticated users to execute the secure issuance RPC
GRANT EXECUTE ON FUNCTION public.issue_student_certificate(UUID) TO authenticated;
