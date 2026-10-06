-- ==============================================================================
-- Migration: 20260925000002_fulfill_course_enrollment_wishlist_removal.sql
-- Description: Phase 4B - Authoritative Course Wishlist Removal upon Enrollment Fulfillment
--
-- Updates public.fulfill_course_enrollment() to atomically remove the fulfilled
-- course from public.student_course_wishlist within the same database transaction:
--   1. Authoritative price recalculation against public.courses
--   2. Atomic payment record insertion (public.payments)
--   3. Atomic course enrollment creation / reactivation (public.course_enrollments)
--   4. Idempotent student notification creation (public.notifications)
--   5. Authoritative removal from public.student_course_wishlist (Phase 4B)
--   6. Strict idempotency preservation for duplicate callbacks/webhooks
-- ==============================================================================

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
  v_user_exists BOOLEAN := false;
  v_course public.courses%ROWTYPE;
  v_base_price NUMERIC(10,2);
  v_offer_price NUMERIC(10,2);
  v_offer_expires_at TIMESTAMPTZ;
  v_effective_price NUMERIC(10,2);
  v_expected_currency TEXT;
  v_existing_payment public.payments%ROWTYPE;
  v_existing_enrollment public.course_enrollments%ROWTYPE;
  v_payment_id UUID;
  v_enrollment_id UUID;
  v_already_fulfilled BOOLEAN := false;
BEGIN
  -- 1. Validate input parameters
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A valid student user_id (UUID) is required.'
    );
  END IF;

  IF p_course_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A valid course_id (UUID) is required.'
    );
  END IF;

  IF p_order_id IS NULL OR length(trim(p_order_id)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A valid Razorpay order_id is required.'
    );
  END IF;

  IF p_payment_id IS NULL OR length(trim(p_payment_id)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A valid Razorpay payment_id is required.'
    );
  END IF;

  -- 2. Validate user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User account does not exist in auth.users.'
    );
  END IF;

  -- 3. Verify course exists and retrieve authoritative details
  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF v_course.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Course not found with the specified course_id.'
    );
  END IF;

  -- 4. Calculate authoritative effective price (recalculating server-side rules)
  v_base_price := COALESCE(v_course.price, 0);
  v_offer_price := v_course.offer_price;
  v_offer_expires_at := v_course.offer_expires_at;

  IF v_offer_price IS NOT NULL
     AND v_offer_price > 0
     AND (v_offer_expires_at IS NULL OR v_offer_expires_at > now()) THEN
    v_effective_price := v_offer_price;
  ELSE
    v_effective_price := v_base_price;
  END IF;

  v_expected_currency := UPPER(COALESCE(v_course.currency, 'INR'));

  -- 5. Validate that currency matches authoritative course currency
  IF p_currency IS NULL OR UPPER(trim(p_currency)) <> v_expected_currency THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Currency mismatch. Expected %s, received %s.', v_expected_currency, COALESCE(p_currency, 'NULL'))
    );
  END IF;

  -- 6. Validate that amount matches authoritative effective price
  IF p_amount IS NULL OR ABS(p_amount - v_effective_price) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Authoritative price mismatch. Expected %s %s, received %s.', v_expected_currency, v_effective_price, COALESCE(p_amount::TEXT, 'NULL'))
    );
  END IF;

  -- 7. Check for existing payment by razorpay_payment_id (Idempotency check)
  SELECT * INTO v_existing_payment
  FROM public.payments
  WHERE razorpay_payment_id = trim(p_payment_id);

  IF v_existing_payment.id IS NOT NULL THEN
    -- Validate that existing payment strictly matches current transaction context
    IF v_existing_payment.user_id <> p_user_id
       OR v_existing_payment.item_type <> 'course'
       OR v_existing_payment.item_id <> p_course_id
       OR v_existing_payment.razorpay_order_id <> trim(p_order_id)
       OR ABS(v_existing_payment.amount - v_effective_price) > 0.01
       OR UPPER(trim(v_existing_payment.currency)) <> v_expected_currency
       OR v_existing_payment.status <> 'captured' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Payment transaction details do not match the existing recorded payment.'
      );
    END IF;

    -- All checks passed: valid idempotent duplicate for this student and course
    v_payment_id := v_existing_payment.id;
    v_already_fulfilled := true;

    -- Ensure course_enrollments record is also active
    SELECT * INTO v_existing_enrollment
    FROM public.course_enrollments
    WHERE user_id = p_user_id AND course_id = p_course_id;

    IF v_existing_enrollment.id IS NOT NULL THEN
      IF v_existing_enrollment.status <> 'active' THEN
        UPDATE public.course_enrollments
        SET status = 'active',
            order_id = p_order_id,
            source = 'purchase',
            enrolled_at = now(),
            updated_at = now(),
            expires_at = NULL
        WHERE id = v_existing_enrollment.id
        RETURNING id INTO v_enrollment_id;
      ELSE
        v_enrollment_id := v_existing_enrollment.id;
      END IF;
    ELSE
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
        p_order_id,
        now(),
        now()
      )
      RETURNING id INTO v_enrollment_id;

      UPDATE public.courses
      SET enrolled_count = COALESCE(enrolled_count, 0) + 1
      WHERE id = p_course_id;
    END IF;

    -- Phase 4B: Authoritative Wishlist Cleanup on idempotent replay
    DELETE FROM public.student_course_wishlist
    WHERE user_id = p_user_id AND course_id = p_course_id;

    RETURN jsonb_build_object(
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
      p_order_id,
      p_payment_id,
      'captured',
      now()
    )
    RETURNING id INTO v_payment_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Race condition safety: concurrent worker inserted payment with this razorpay_payment_id
      SELECT * INTO v_existing_payment
      FROM public.payments
      WHERE razorpay_payment_id = trim(p_payment_id);

      IF v_existing_payment.id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Unable to verify concurrent payment record.'
        );
      END IF;

      -- Validate concurrent payment identity and context
      IF v_existing_payment.user_id <> p_user_id
         OR v_existing_payment.item_type <> 'course'
         OR v_existing_payment.item_id <> p_course_id
         OR v_existing_payment.razorpay_order_id <> trim(p_order_id)
         OR ABS(v_existing_payment.amount - v_effective_price) > 0.01
         OR UPPER(trim(v_existing_payment.currency)) <> v_expected_currency
         OR v_existing_payment.status <> 'captured' THEN
        RETURN jsonb_build_object(
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
  WHERE user_id = p_user_id AND course_id = p_course_id;

  IF v_existing_enrollment.id IS NOT NULL THEN
    IF v_existing_enrollment.status <> 'active' THEN
      UPDATE public.course_enrollments
      SET status = 'active',
          order_id = p_order_id,
          source = 'purchase',
          enrolled_at = now(),
          updated_at = now(),
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
        p_order_id,
        now(),
        now()
      )
      RETURNING id INTO v_enrollment_id;

      -- Increment course enrolled_count atomically
      UPDATE public.courses
      SET enrolled_count = COALESCE(enrolled_count, 0) + 1
      WHERE id = p_course_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Race condition safety: concurrent worker inserted course enrollment
        SELECT id INTO v_enrollment_id
        FROM public.course_enrollments
        WHERE user_id = p_user_id AND course_id = p_course_id;
    END;
  END IF;

  -- 10. Create student notification (Idempotent: prevent duplicates within 1 hour)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = p_user_id
        AND link_url = ('/learn/' || v_course.slug || '/player')
        AND created_at >= (now() - interval '1 hour')
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
        format('Your purchase was successful. Full access to the masterclass curriculum and lesson media is now unlocked.', v_course.title),
        'success',
        '/learn/' || v_course.slug || '/player',
        false,
        now()
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Non-fatal: do not abort payment fulfillment if notification insertion has a non-critical issue
      NULL;
    END;

  -- 11. Authoritative Wishlist Cleanup (Phase 4B)
  -- Remove course from student's wishlist upon successful enrollment fulfillment
  DELETE FROM public.student_course_wishlist
  WHERE user_id = p_user_id AND course_id = p_course_id;

  -- 12. Return authoritative fulfillment payload
  RETURN jsonb_build_object(
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

-- ------------------------------------------------------------------------------
-- Permission Hardening
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO postgres;
