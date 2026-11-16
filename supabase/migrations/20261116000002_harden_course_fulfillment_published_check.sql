-- ==============================================================================
-- DIGITAL MUID — P1-3 ADDITIVE MIGRATION PROPOSAL
-- HARDEN public.fulfill_course_enrollment PUBLISHED STATUS, EXACT AMOUNT & SEARCH_PATH
-- Migration: 20261116000002_harden_course_fulfillment_published_check.sql
-- ==============================================================================
-- STATUS: NOT EXECUTED IN DATABASE — ADDITIVE MIGRATION PROPOSAL ONLY
--
-- Schema Assumptions & Preflight Checked:
--   - public.courses: id (UUID), slug (TEXT), title (TEXT), price (NUMERIC),
--     offer_price (NUMERIC), offer_expires_at (TIMESTAMPTZ), currency (TEXT),
--     status (TEXT: 'draft' | 'published' | 'archived'), enrolled_count (INTEGER).
--   - public.payments: id (UUID), user_id (UUID), item_type (TEXT),
--     item_id (UUID or TEXT), item_title (TEXT), amount (NUMERIC), currency (TEXT),
--     razorpay_order_id (TEXT), razorpay_payment_id (TEXT), status (TEXT), created_at (TIMESTAMPTZ).
--   - public.course_enrollments: id (UUID), user_id (UUID), course_id (UUID),
--     status (TEXT), source (TEXT), order_id (TEXT), enrolled_at (TIMESTAMPTZ),
--     updated_at (TIMESTAMPTZ), expires_at (TIMESTAMPTZ).
--   - public.notifications (type supports 'enrollment_success' or unconstrained TEXT)
--     and public.student_course_wishlist exist from prior migrations.
--
-- Summary of Corrections & Hardening:
--   - Valid PostgreSQL syntax (removes invalid pg_catalog.trim / pg_catalog.coalesce).
--   - Preflights required tables, columns, and unique razorpay_payment_id index/constraint.
--   - Adds user+course advisory lock, FOR SHARE catalog lock, FOR UPDATE row locks,
--     strict NaN/overflow/>2-decimal checks on both catalog prices and payments.
--   - Casts payments.item_id::TEXT for comparison so both UUID (20260918000001) and
--     TEXT (staging_baseline_review.sql) schemas work cleanly without type errors.
--   - Uses notification type 'enrollment_success' (valid in staging_baseline_review
--     CHECK constraint and 20260918000001) and removes silent exception swallowing.
--
-- Rollback Instructions (if reverting to 20260925000002):
--   Re-execute supabase/migrations/20260925000002_fulfill_course_enrollment_wishlist_removal.sql
--   to restore the previous definition of public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT).
--   Note: Function signature is unchanged; no DDL table changes are performed by this file.
-- ==============================================================================

-- 0. Fail-closed schema compatibility preflight
DO $$
DECLARE
  v_missing TEXT[];
  v_item_id_type TEXT;
  v_has_pay_unique BOOLEAN := false;
  v_bad_notif_check BOOLEAN := false;
BEGIN
  SELECT pg_catalog.array_agg(tbl)
  INTO v_missing
  FROM (VALUES ('courses'), ('payments'), ('course_enrollments'), ('notifications'), ('student_course_wishlist')) AS req(tbl)
  WHERE pg_catalog.to_regclass('public.' || req.tbl) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration halt: Missing required table(s) in public schema: %.',
      pg_catalog.array_to_string(v_missing, ', ');
  END IF;

  SELECT data_type INTO v_item_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'item_id';

  IF v_item_id_type IS NULL OR v_item_id_type NOT IN ('uuid', 'text', 'character varying') THEN
    RAISE EXCEPTION 'Compatibility failure: public.payments.item_id must be UUID or TEXT/VARCHAR (found %).',
      COALESCE(v_item_id_type, 'MISSING');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attname = 'razorpay_payment_id' AND NOT a.attisdropped
    WHERE nt.nspname = 'public'
      AND t.relname = 'payments'
      AND i.indisunique = true
      AND i.indisvalid = true
      AND i.indisready = true
      AND i.indexprs IS NULL
      AND i.indkey::SMALLINT[] = ARRAY[a.attnum]
  ) INTO v_has_pay_unique;

  IF NOT v_has_pay_unique THEN
    RAISE EXCEPTION 'Compatibility failure: public.payments lacks a valid unique index on razorpay_payment_id.';
  END IF;

  -- Ensure notifications.type accepts 'enrollment_success' if a CHECK constraint exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
    WHERE nt.nspname = 'public'
      AND t.relname = 'notifications'
      AND c.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(c.oid) ~* '\ytype\y'
      AND pg_catalog.pg_get_constraintdef(c.oid) NOT ILIKE '%enrollment_success%'
  ) INTO v_bad_notif_check;

  IF v_bad_notif_check THEN
    RAISE EXCEPTION 'Compatibility failure: public.notifications.type CHECK constraint does not permit ''enrollment_success''.';
  END IF;
END $$;

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
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user_exists BOOLEAN := false;
  v_clean_order_id TEXT;
  v_clean_payment_id TEXT;
  v_course public.courses%ROWTYPE;
  v_base_price NUMERIC(10,2);
  v_offer_price NUMERIC(10,2);
  v_offer_expires_at TIMESTAMPTZ;
  v_effective_price NUMERIC(10,2);
  v_expected_currency TEXT;

  v_rec RECORD;
  v_pay_by_order public.payments%ROWTYPE;
  v_pay_by_order_cnt INTEGER := 0;
  v_existing_payment public.payments%ROWTYPE;
  v_existing_enrollment public.course_enrollments%ROWTYPE;

  v_payment_id UUID;
  v_enrollment_id UUID;
  v_already_fulfilled BOOLEAN := false;
BEGIN
  -- 1. Validate input parameters
  IF p_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'A valid student user_id (UUID) is required.'
    );
  END IF;

  IF p_course_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'A valid course_id (UUID) is required.'
    );
  END IF;

  v_clean_order_id := pg_catalog.btrim(COALESCE(p_order_id, ''), E' \t\n\r\f\v');
  v_clean_payment_id := pg_catalog.btrim(COALESCE(p_payment_id, ''), E' \t\n\r\f\v');

  IF pg_catalog.length(v_clean_order_id) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'A valid Razorpay order_id is required.'
    );
  END IF;

  IF pg_catalog.length(v_clean_payment_id) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'A valid Razorpay payment_id is required.'
    );
  END IF;

  -- Serialize concurrent retries for this payment / order / student+course within transactions
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_course_pay:' || v_clean_payment_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_course_ord:' || v_clean_order_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_course_usr:' || p_user_id::TEXT || ':' || p_course_id::TEXT, 0));

  -- 2. Validate user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'User account does not exist in auth.users.'
    );
  END IF;

  -- 3. Verify course exists and is strictly published (FOR SHARE)
  SELECT * INTO v_course
  FROM public.courses
  WHERE id = p_course_id
  FOR SHARE;

  IF v_course.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Course not found with the specified course_id.'
    );
  END IF;

  IF pg_catalog.lower(pg_catalog.btrim(COALESCE(v_course.status, ''), E' \t\n\r\f\v')) <> 'published' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', pg_catalog.format('Course is not published and cannot be fulfilled (status=%s).', COALESCE(v_course.status, 'NULL'))
    );
  END IF;

  -- 4. Validate catalog prices strictly before computing authoritative effective price
  IF v_course.price IS NULL
     OR v_course.price = 'NaN'::NUMERIC
     OR v_course.price < 0
     OR v_course.price > 99999999.99
     OR pg_catalog.round(v_course.price, 2) IS DISTINCT FROM v_course.price THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Course has invalid base price configuration.'
    );
  END IF;

  IF v_course.offer_price IS NOT NULL AND (
       v_course.offer_price = 'NaN'::NUMERIC
       OR v_course.offer_price < 0
       OR v_course.offer_price > 99999999.99
       OR pg_catalog.round(v_course.offer_price, 2) IS DISTINCT FROM v_course.offer_price
     ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Course has invalid offer price configuration.'
    );
  END IF;

  v_base_price := pg_catalog.round(v_course.price, 2)::NUMERIC(10,2);
  v_offer_price := CASE WHEN v_course.offer_price IS NOT NULL THEN pg_catalog.round(v_course.offer_price, 2)::NUMERIC(10,2) ELSE NULL END;
  v_offer_expires_at := v_course.offer_expires_at;

  IF v_offer_price IS NOT NULL
     AND v_offer_price > 0
     AND (v_offer_expires_at IS NULL OR v_offer_expires_at > pg_catalog.now()) THEN
    v_effective_price := v_offer_price;
  ELSE
    v_effective_price := v_base_price;
  END IF;

  IF v_effective_price IS NULL OR v_effective_price <= 0 OR v_effective_price > 99999999.99 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Course does not have a valid positive price.'
    );
  END IF;

  v_expected_currency := pg_catalog.upper(pg_catalog.btrim(COALESCE(v_course.currency, ''), E' \t\n\r\f\v'));
  IF v_expected_currency = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Course does not have a valid currency configured.'
    );
  END IF;

  -- 5. Validate that currency matches authoritative course currency
  IF p_currency IS NULL OR pg_catalog.upper(pg_catalog.btrim(p_currency, E' \t\n\r\f\v')) IS DISTINCT FROM v_expected_currency THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', pg_catalog.format('Currency mismatch. Expected %s, received %s.', v_expected_currency, COALESCE(p_currency, 'NULL'))
    );
  END IF;

  -- 6. Validate exact amount equality (exact paise / 2-decimal parity; reject > 2 decimals, NaN, or overflow)
  IF p_amount IS NULL
     OR p_amount = 'NaN'::NUMERIC
     OR p_amount <= 0
     OR p_amount > 99999999.99
     OR pg_catalog.round(p_amount, 2) IS DISTINCT FROM p_amount
     OR pg_catalog.round(p_amount, 2) IS DISTINCT FROM v_effective_price THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', pg_catalog.format('Authoritative price mismatch. Expected %s %s, received %s.', v_expected_currency, v_effective_price, COALESCE(p_amount::TEXT, 'NULL'))
    );
  END IF;

  -- 7. Check for existing payments by razorpay_order_id and razorpay_payment_id (FOR UPDATE, multi-row safe)
  FOR v_rec IN
    SELECT *
    FROM public.payments
    WHERE razorpay_order_id = v_clean_order_id
    FOR UPDATE
  LOOP
    v_pay_by_order_cnt := v_pay_by_order_cnt + 1;
    IF v_pay_by_order_cnt = 1 THEN
      v_pay_by_order := v_rec;
    END IF;
  END LOOP;

  IF v_pay_by_order_cnt > 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Multiple existing payment records matched the same order_id.'
    );
  END IF;

  IF v_pay_by_order.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_pay_by_order.razorpay_payment_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_payment_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Order ID is already bound to a different Razorpay payment_id.'
    );
  END IF;

  SELECT * INTO v_existing_payment
  FROM public.payments
  WHERE razorpay_payment_id = v_clean_payment_id
  FOR UPDATE;

  IF v_existing_payment.id IS NOT NULL THEN
    IF v_pay_by_order.id IS NOT NULL AND v_existing_payment.id IS DISTINCT FROM v_pay_by_order.id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Payment ID and Order ID resolved to different payment ledger rows.'
      );
    END IF;

    -- Validate that existing payment strictly matches current transaction context (strict scale/NaN/null & text-or-uuid item_id)
    IF v_existing_payment.user_id IS DISTINCT FROM p_user_id
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.item_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'course'
       OR NULLIF(pg_catalog.btrim(COALESCE(v_existing_payment.item_id::TEXT, ''), E' \t\n\r\f\v'), '') IS DISTINCT FROM p_course_id::TEXT
       OR v_existing_payment.razorpay_order_id IS DISTINCT FROM v_clean_order_id
       OR v_existing_payment.amount IS NULL
       OR v_existing_payment.amount = 'NaN'::NUMERIC
       OR pg_catalog.round(v_existing_payment.amount, 2) IS DISTINCT FROM v_existing_payment.amount
       OR v_existing_payment.amount IS DISTINCT FROM v_effective_price
       OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_payment.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_expected_currency
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.status, ''), E' \t\n\r\f\v')) NOT IN ('captured', 'paid') THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Payment transaction details do not match the existing recorded payment.'
      );
    END IF;

    v_payment_id := v_existing_payment.id;
    v_already_fulfilled := true;

    -- Ensure course_enrollments record is active (locked FOR UPDATE)
    SELECT * INTO v_existing_enrollment
    FROM public.course_enrollments
    WHERE user_id = p_user_id AND course_id = p_course_id
    FOR UPDATE;

    IF v_existing_enrollment.id IS NOT NULL THEN
      IF v_existing_enrollment.status <> 'active' THEN
        UPDATE public.course_enrollments
        SET status = 'active',
            order_id = v_clean_order_id,
            source = 'purchase',
            enrolled_at = pg_catalog.now(),
            updated_at = pg_catalog.now(),
            expires_at = NULL
        WHERE id = v_existing_enrollment.id
        RETURNING id INTO v_enrollment_id;
      ELSE
        v_enrollment_id := v_existing_enrollment.id;
      END IF;
    ELSE
      BEGIN
        INSERT INTO public.course_enrollments (
          user_id,
          course_id,
          status,
          source,
          order_id,
          enrolled_at,
          updated_at
        ) VALUES (
          p_user_id,
          p_course_id,
          'active',
          'purchase',
          v_clean_order_id,
          pg_catalog.now(),
          pg_catalog.now()
        )
        RETURNING id INTO v_enrollment_id;

        UPDATE public.courses
        SET enrolled_count = COALESCE(enrolled_count, 0) + 1
        WHERE id = p_course_id;
      EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_existing_enrollment
        FROM public.course_enrollments
        WHERE user_id = p_user_id AND course_id = p_course_id
        FOR UPDATE;

        IF v_existing_enrollment.id IS NULL THEN
          RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Failed to locate enrollment after unique_violation.';
        END IF;

        IF v_existing_enrollment.status <> 'active' THEN
          UPDATE public.course_enrollments
          SET status = 'active',
              order_id = v_clean_order_id,
              source = 'purchase',
              enrolled_at = pg_catalog.now(),
              updated_at = pg_catalog.now(),
              expires_at = NULL
          WHERE id = v_existing_enrollment.id
          RETURNING id INTO v_enrollment_id;
        ELSE
          v_enrollment_id := v_existing_enrollment.id;
        END IF;
      END;
    END IF;

    -- Phase 4B: Authoritative Wishlist Cleanup on idempotent replay
    DELETE FROM public.student_course_wishlist
    WHERE user_id = p_user_id AND course_id = p_course_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'payment_id', v_payment_id,
      'enrollment_id', v_enrollment_id,
      'status', 'completed',
      'course_slug', v_course.slug,
      'course_title', v_course.title,
      'amount', v_existing_payment.amount,
      'currency', v_existing_payment.currency,
      'message', 'Payment and enrollment already satisfied (idempotent duplicate).'
    );
  END IF;

  -- 8. Insert payment record into public.payments
  BEGIN
    INSERT INTO public.payments (
      user_id,
      item_type,
      item_id,
      item_title,
      amount,
      currency,
      razorpay_order_id,
      razorpay_payment_id,
      status,
      created_at
    ) VALUES (
      p_user_id,
      'course',
      p_course_id,
      v_course.title,
      v_effective_price,
      v_expected_currency,
      v_clean_order_id,
      v_clean_payment_id,
      'captured',
      pg_catalog.now()
    )
    RETURNING id INTO v_payment_id;
  EXCEPTION
    WHEN unique_violation THEN
      v_pay_by_order := NULL;
      v_pay_by_order_cnt := 0;

      FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
        v_pay_by_order_cnt := v_pay_by_order_cnt + 1;
        IF v_pay_by_order_cnt = 1 THEN v_pay_by_order := v_rec; END IF;
      END LOOP;

      SELECT * INTO v_existing_payment
      FROM public.payments
      WHERE razorpay_payment_id = v_clean_payment_id
      FOR UPDATE;

      IF v_pay_by_order_cnt > 1 THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'error', 'Unable to verify concurrent payment record: multiple rows matched order_id.'
        );
      END IF;

      IF v_existing_payment.id IS NULL THEN
        v_existing_payment := v_pay_by_order;
      ELSIF v_pay_by_order.id IS NOT NULL AND v_existing_payment.id IS DISTINCT FROM v_pay_by_order.id THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'error', 'Concurrent Payment ID and Order ID resolved to different payment records.'
        );
      END IF;

      IF v_existing_payment.id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'error', 'Unable to verify concurrent payment record.'
        );
      END IF;

      IF v_existing_payment.user_id IS DISTINCT FROM p_user_id
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.item_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'course'
         OR NULLIF(pg_catalog.btrim(COALESCE(v_existing_payment.item_id::TEXT, ''), E' \t\n\r\f\v'), '') IS DISTINCT FROM p_course_id::TEXT
         OR v_existing_payment.razorpay_order_id IS DISTINCT FROM v_clean_order_id
         OR v_existing_payment.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
         OR v_existing_payment.amount IS NULL
         OR v_existing_payment.amount = 'NaN'::NUMERIC
         OR pg_catalog.round(v_existing_payment.amount, 2) IS DISTINCT FROM v_existing_payment.amount
         OR v_existing_payment.amount IS DISTINCT FROM v_effective_price
         OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_payment.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_expected_currency
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.status, ''), E' \t\n\r\f\v')) NOT IN ('captured', 'paid') THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'error', 'Payment transaction details do not match the existing recorded payment.'
        );
      END IF;

      v_payment_id := v_existing_payment.id;
      v_already_fulfilled := true;
  END;

  -- 9. Create or activate course enrollment in public.course_enrollments
  SELECT * INTO v_existing_enrollment
  FROM public.course_enrollments
  WHERE user_id = p_user_id AND course_id = p_course_id
  FOR UPDATE;

  IF v_existing_enrollment.id IS NOT NULL THEN
    IF v_existing_enrollment.status <> 'active' THEN
      UPDATE public.course_enrollments
      SET status = 'active',
          order_id = v_clean_order_id,
          source = 'purchase',
          enrolled_at = pg_catalog.now(),
          updated_at = pg_catalog.now(),
          expires_at = NULL
      WHERE id = v_existing_enrollment.id
      RETURNING id INTO v_enrollment_id;
    ELSE
      v_enrollment_id := v_existing_enrollment.id;
    END IF;
  ELSE
    BEGIN
      INSERT INTO public.course_enrollments (
        user_id,
        course_id,
        status,
        source,
        order_id,
        enrolled_at,
        updated_at
      ) VALUES (
        p_user_id,
        p_course_id,
        'active',
        'purchase',
        v_clean_order_id,
        pg_catalog.now(),
        pg_catalog.now()
      )
      RETURNING id INTO v_enrollment_id;

      UPDATE public.courses
      SET enrolled_count = COALESCE(enrolled_count, 0) + 1
      WHERE id = p_course_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT * INTO v_existing_enrollment
        FROM public.course_enrollments
        WHERE user_id = p_user_id AND course_id = p_course_id
        FOR UPDATE;

        IF v_existing_enrollment.id IS NULL THEN
          RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Failed to locate enrollment after unique_violation.';
        END IF;

        IF v_existing_enrollment.status <> 'active' THEN
          UPDATE public.course_enrollments
          SET status = 'active',
              order_id = v_clean_order_id,
              source = 'purchase',
              enrolled_at = pg_catalog.now(),
              updated_at = pg_catalog.now(),
              expires_at = NULL
          WHERE id = v_existing_enrollment.id
          RETURNING id INTO v_enrollment_id;
        ELSE
          v_enrollment_id := v_existing_enrollment.id;
        END IF;
    END;
  END IF;

  -- 10. Create student notification atomically (Idempotent within 1 hour; uses 'enrollment_success')
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_user_id
      AND link_url = ('/learn/' || v_course.slug || '/player')
      AND created_at >= (pg_catalog.now() - interval '1 hour')
  ) THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      link_url,
      is_read,
      created_at
    ) VALUES (
      p_user_id,
      'Enrollment Confirmed: ' || v_course.title,
      'Your purchase was successful. Full access to the masterclass curriculum and lesson media is now unlocked.',
      'enrollment_success',
      '/learn/' || v_course.slug || '/player',
      false,
      pg_catalog.now()
    );
  END IF;

  -- 11. Authoritative Wishlist Cleanup (Phase 4B)
  DELETE FROM public.student_course_wishlist
  WHERE user_id = p_user_id AND course_id = p_course_id;

  -- 12. Return authoritative fulfillment payload
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'already_fulfilled', v_already_fulfilled,
    'payment_id', v_payment_id,
    'enrollment_id', v_enrollment_id,
    'status', 'completed',
    'course_slug', v_course.slug,
    'course_title', v_course.title,
    'amount', v_effective_price,
    'currency', v_expected_currency,
    'message', 'Course enrollment and payment fulfilled successfully.'
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) OWNER TO postgres;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO postgres;

NOTIFY pgrst, 'reload schema';
