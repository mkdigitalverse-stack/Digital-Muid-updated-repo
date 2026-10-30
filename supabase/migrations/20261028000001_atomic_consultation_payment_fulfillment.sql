-- ==============================================================================
-- DIGITAL MUID — ATOMIC CONSULTATION PAYMENT FULFILLMENT & INTEGRITY HARDENING
-- Migration: 20261028000001_atomic_consultation_payment_fulfillment.sql
-- ==============================================================================
-- VERIFIED SCHEMA CONSTRAINTS:
-- 1. public.bookings.status is VARCHAR(20) NOT NULL DEFAULT 'confirmed'.
--    idx_unique_active_booking_slot applies WHERE status IN ('confirmed', 'rescheduled').
--    Conflict status MUST fit within 20 chars: 'reschedule_pending' (18 chars).
-- 2. public.payments.item_id is UUID. Must be populated with UUID v_target_product_id.
-- 3. public.payments.user_id is UUID REFERENCES auth.users(id) ON DELETE CASCADE.
--    Guest checkout requires ALTER COLUMN user_id DROP NOT NULL.
-- 4. public.bookings.id is TEXT PRIMARY KEY. The RPC explicitly generates 'bkg_' || gen_random_uuid()::text.
-- 5. public.bookings.meet_url is TEXT NOT NULL. Does NOT fabricate synthetic Google Meet rooms.
--    Explicitly marks 'PENDING_CALENDAR_PROVISIONING' if not yet provisioned via Google Calendar API.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA HARDENING: ALLOW GUEST PAYMENTS & PRIMARY KEY DEFAULTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- ------------------------------------------------------------------------------
-- 2. IDEMPOTENCY UNIQUE INDEXES ON BOOKINGS
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_id
  ON public.bookings (payment_id)
  WHERE payment_id IS NOT NULL AND payment_id != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id
  ON public.bookings (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL AND razorpay_order_id != '';

-- ------------------------------------------------------------------------------
-- 3. RLS HARDENING ON BOOKINGS & SCHEMA DEFENSE
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Insert Bookings" ON public.bookings;
DROP POLICY IF EXISTS "public_create_bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;

REVOKE INSERT ON public.bookings FROM anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. ATOMIC CONSULTATION FULFILLMENT RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_consultation_payment(
  p_user_id UUID,
  p_order_id TEXT,
  p_payment_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_booking_details JSONB,
  p_product_id UUID DEFAULT '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_clean_order_id TEXT;
  v_clean_payment_id TEXT;
  v_currency TEXT;
  v_target_product_id UUID;
  v_product public.consultation_products%ROWTYPE;
  v_base_price NUMERIC(10,2);
  v_gst_rate NUMERIC(4,2);
  v_gst_amount NUMERIC(10,2);
  v_expected_total NUMERIC(10,2);
  v_order_snapshot_amount NUMERIC(10,2);
  v_effective_total NUMERIC(10,2);
  
  v_existing_payment public.payments%ROWTYPE;
  v_existing_booking public.bookings%ROWTYPE;
  v_conflicting_slot_id TEXT;
  v_is_slot_conflicted BOOLEAN := false;
  v_booking_status VARCHAR(20) := 'confirmed';
  v_booking_notes TEXT := 'Booked online with verified Razorpay payment. Official calendar meeting link pending host synchronization.';
  
  v_new_booking public.bookings%ROWTYPE;
  v_new_payment public.payments%ROWTYPE;
  
  v_booking_id TEXT;
  v_customer_name TEXT;
  v_customer_email TEXT;
  v_customer_phone VARCHAR(30);
  v_business_name TEXT;
  v_primary_challenge TEXT;
  v_desired_outcome TEXT;
  v_website TEXT;
  v_linkedin TEXT;
  v_booking_date DATE;
  v_booking_time VARCHAR(20);
  v_booking_code VARCHAR(30);
  v_meet_url TEXT;
  v_duration_minutes INTEGER;
  
  v_diag_constraint TEXT;
  v_diag_message TEXT;
BEGIN
  -- 1. Input sanitization & boundary checks
  v_clean_order_id := pg_catalog.trim(pg_catalog.coalesce(p_order_id, ''));
  v_clean_payment_id := pg_catalog.trim(pg_catalog.coalesce(p_payment_id, ''));

  IF pg_catalog.length(v_clean_order_id) = 0 OR pg_catalog.length(v_clean_payment_id) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Both order_id and payment_id are required for verified consultation fulfillment.'
    );
  END IF;

  -- Currency must be non-empty and strictly 'INR' (no silent default fallback)
  IF p_currency IS NULL OR pg_catalog.trim(p_currency) = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Currency is mandatory and must not be empty.'
    );
  END IF;

  v_currency := pg_catalog.upper(pg_catalog.trim(p_currency));

  IF v_currency != 'INR' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Invalid currency. Consultation payments must be denominated in INR.'
    );
  END IF;

  -- 2. Extract and validate intake brief parameters
  v_customer_name := pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'customer_name', p_booking_details->>'customerName', 'Valued Client'));
  v_customer_email := pg_catalog.lower(pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'customer_email', p_booking_details->>'customerEmail', '')));
  v_customer_phone := pg_catalog.substr(pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'customer_phone', p_booking_details->>'customerPhone', '')), 1, 30);
  v_business_name := pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'business_name', p_booking_details->>'businessName', ''));
  v_primary_challenge := pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'primary_challenge', p_booking_details->>'primaryChallenge', 'Business Growth Strategy'));
  v_desired_outcome := pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'desired_outcome', p_booking_details->>'desiredOutcome', ''));
  v_website := pg_catalog.nullif(pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'website', '')), '');
  v_linkedin := pg_catalog.nullif(pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'linkedin', '')), '');
  
  BEGIN
    v_booking_date := (p_booking_details->>'date')::date;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_booking_date := (p_booking_details->>'booking_date')::date;
    EXCEPTION WHEN OTHERS THEN
      v_booking_date := NULL;
    END;
  END;

  v_booking_time := pg_catalog.substr(pg_catalog.trim(pg_catalog.coalesce(p_booking_details->>'time', p_booking_details->>'booking_time', '')), 1, 20);

  IF v_customer_email = '' OR v_booking_date IS NULL OR v_booking_time = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Missing required intake brief data: customer_email, date, and time slot are mandatory.'
    );
  END IF;

  -- 3. Explicit product selection: fail closed if missing or inactive (no silent fallback)
  v_target_product_id := pg_catalog.coalesce(p_product_id, '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid);

  SELECT * INTO v_product
  FROM public.consultation_products
  WHERE id = v_target_product_id
    AND active = true;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Specified consultation product (' || v_target_product_id::text || ') is inactive or not found. Fulfillment rejected.'
    );
  END IF;

  v_base_price := pg_catalog.coalesce(v_product.base_price, 499.00);
  v_gst_rate := pg_catalog.coalesce(v_product.gst_rate, 0.18);
  v_gst_amount := pg_catalog.round(v_base_price * v_gst_rate, 2);
  v_expected_total := pg_catalog.round(v_base_price + v_gst_amount, 2);
  v_duration_minutes := pg_catalog.coalesce(v_product.duration_minutes, 30);

  -- Safe extraction of trusted order-time snapshot to resolve catalog price-change race
  BEGIN
    v_order_snapshot_amount := (p_booking_details->>'order_total_amount')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_order_snapshot_amount := NULL;
  END;

  -- Validate payment amount:
  -- Must match either current catalog price OR the verified order-time snapshot
  IF p_amount IS NULL OR (
    pg_catalog.round(p_amount, 2) != v_expected_total AND
    (v_order_snapshot_amount IS NULL OR pg_catalog.round(p_amount, 2) != pg_catalog.round(v_order_snapshot_amount, 2))
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Amount mismatch: payment amount (' || pg_catalog.coalesce(p_amount::text, 'NULL') || ') does not equal authoritative price (' || v_expected_total::text || ') or verified order snapshot (' || pg_catalog.coalesce(v_order_snapshot_amount::text, 'none') || ').'
    );
  END IF;

  -- Adopt effective total (protecting against catalog updates between order creation and payment)
  IF v_order_snapshot_amount IS NOT NULL AND pg_catalog.round(p_amount, 2) = pg_catalog.round(v_order_snapshot_amount, 2) THEN
    v_effective_total := pg_catalog.round(v_order_snapshot_amount, 2);
    IF v_effective_total != v_expected_total THEN
      v_base_price := pg_catalog.round(v_effective_total / (1.0 + v_gst_rate), 2);
      v_gst_amount := pg_catalog.round(v_effective_total - v_base_price, 2);
    END IF;
  ELSE
    v_effective_total := v_expected_total;
  END IF;

  -- 4. Idempotency Check: Look for existing payment and existing booking
  SELECT * INTO v_existing_payment
  FROM public.payments
  WHERE razorpay_payment_id = v_clean_payment_id;

  SELECT * INTO v_existing_booking
  FROM public.bookings
  WHERE payment_id = v_clean_payment_id OR razorpay_order_id = v_clean_order_id;

  -- Comprehensive invariant validation if existing payment found
  IF v_existing_payment.id IS NOT NULL THEN
    IF v_existing_payment.razorpay_order_id != v_clean_order_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: payment_id is already associated with a different order_id.'
      );
    END IF;

    IF pg_catalog.round(v_existing_payment.amount, 2) != v_effective_total OR pg_catalog.upper(v_existing_payment.currency) != v_currency THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing payment record amount or currency does not match.'
      );
    END IF;

    IF v_existing_payment.item_id IS NOT NULL AND v_existing_payment.item_id != v_target_product_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing payment record product ID does not match consultation product.'
      );
    END IF;

    IF v_existing_payment.status NOT IN ('captured', 'paid') THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing payment is not in captured or paid status.'
      );
    END IF;

    IF p_user_id IS NOT NULL AND v_existing_payment.user_id IS NOT NULL AND v_existing_payment.user_id != p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing payment belongs to a different authenticated user.'
      );
    END IF;
  END IF;

  -- Comprehensive invariant validation if existing booking found
  IF v_existing_booking.id IS NOT NULL THEN
    IF v_existing_booking.razorpay_order_id IS NOT NULL 
       AND v_existing_booking.razorpay_order_id != '' 
       AND v_existing_booking.razorpay_order_id != v_clean_order_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: booking is already associated with a different order_id.'
      );
    END IF;

    IF v_existing_booking.payment_id IS NOT NULL 
       AND v_existing_booking.payment_id != '' 
       AND v_existing_booking.payment_id != v_clean_payment_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: booking is already associated with a different payment_id.'
      );
    END IF;

    IF pg_catalog.round(pg_catalog.coalesce(v_existing_booking.total_amount, 0), 2) != v_effective_total THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing booking amount does not match expected payment amount.'
      );
    END IF;

    IF v_existing_booking.currency IS NOT NULL AND v_existing_booking.currency != '' AND pg_catalog.upper(v_existing_booking.currency) != v_currency THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing booking currency does not match.'
      );
    END IF;

    IF pg_catalog.lower(pg_catalog.trim(v_existing_booking.customer_email)) != v_customer_email THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing booking customer email does not match intake brief.'
      );
    END IF;

    IF p_user_id IS NOT NULL AND v_existing_booking.user_id IS NOT NULL AND v_existing_booking.user_id != p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Security violation: existing booking belongs to a different authenticated user.'
      );
    END IF;
  END IF;

  -- Case A: Both booking and payment already exist (fully fulfilled)
  IF v_existing_booking.id IS NOT NULL AND v_existing_payment.id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'booking', pg_catalog.row_to_json(v_existing_booking),
      'payment', pg_catalog.row_to_json(v_existing_payment),
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id
    );
  END IF;

  -- Case B: Booking exists, but payment ledger is missing (Heal incomplete state)
  IF v_existing_booking.id IS NOT NULL AND v_existing_payment.id IS NULL THEN
    UPDATE public.bookings
    SET payment_id = v_clean_payment_id,
        razorpay_order_id = v_clean_order_id,
        payment_status = 'paid',
        updated_at = pg_catalog.now()
    WHERE id = v_existing_booking.id
    RETURNING * INTO v_existing_booking;

    INSERT INTO public.payments (
      user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at
    ) VALUES (
      p_user_id, 'consultation', v_target_product_id,
      pg_catalog.coalesce(v_product.name, 'Business Growth & Scaling Consultation'),
      v_effective_total, v_currency, v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
    )
    RETURNING * INTO v_existing_payment;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_ledger', true,
      'booking', pg_catalog.row_to_json(v_existing_booking),
      'payment', pg_catalog.row_to_json(v_existing_payment),
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id
    );
  END IF;

  -- Case C: Payment exists, but booking is missing (Heal incomplete state)
  IF v_existing_payment.id IS NOT NULL AND v_existing_booking.id IS NULL THEN
    SELECT id INTO v_conflicting_slot_id
    FROM public.bookings
    WHERE booking_date = v_booking_date
      AND booking_time = v_booking_time
      AND status IN ('confirmed', 'rescheduled')
      AND (razorpay_order_id IS NULL OR razorpay_order_id != v_clean_order_id)
    LIMIT 1;

    -- If slot is occupied, persist as reschedule_pending (fits VARCHAR(20) and bypasses active slot index)
    IF v_conflicting_slot_id IS NOT NULL THEN
      v_is_slot_conflicted := true;
      v_booking_status := 'reschedule_pending';
      v_booking_notes := 'SLOT_CONFLICT: Time slot taken by concurrent transaction. Payment captured (Razorpay ' || v_clean_payment_id || '). Priority reschedule required.';
    END IF;

    v_booking_id := pg_catalog.coalesce(p_booking_details->>'id', 'bkg_' || pg_catalog.gen_random_uuid()::text);
    v_booking_code := pg_catalog.substr(pg_catalog.coalesce(
      p_booking_details->>'booking_code',
      ('DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)))
    ), 1, 30);
    
    -- Real Google Meet provisioning requires Google Calendar API; calendar_event_id is strictly NULL
    v_meet_url := pg_catalog.coalesce(
      pg_catalog.nullif(pg_catalog.trim(p_booking_details->>'meet_url'), ''),
      'PENDING_CALENDAR_PROVISIONING'
    );

    INSERT INTO public.bookings (
      id, booking_code, customer_name, customer_email, customer_phone, business_name,
      primary_challenge, desired_outcome, website, linkedin, booking_date,
      booking_time, duration_minutes, base_amount, gst_rate, gst_amount,
      total_amount, currency, payment_id, razorpay_order_id, payment_status,
      calendar_event_id, meet_url, status, user_id, notes, created_at, updated_at
    ) VALUES (
      v_booking_id, v_booking_code, v_customer_name, v_customer_email, v_customer_phone, v_business_name,
      v_primary_challenge, v_desired_outcome, v_website, v_linkedin, v_booking_date,
      v_booking_time, v_duration_minutes, v_base_price, v_gst_rate, v_gst_amount,
      v_effective_total, pg_catalog.substr(v_currency, 1, 3), v_clean_payment_id, v_clean_order_id, 'paid',
      NULL, v_meet_url, v_booking_status, p_user_id,
      v_booking_notes, pg_catalog.now(), pg_catalog.now()
    )
    RETURNING * INTO v_existing_booking;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_booking', true,
      'slot_conflict', v_is_slot_conflicted,
      'action_required', CASE WHEN v_is_slot_conflicted THEN 'reschedule_required' ELSE NULL END,
      'booking', pg_catalog.row_to_json(v_existing_booking),
      'payment', pg_catalog.row_to_json(v_existing_payment),
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id
    );
  END IF;

  -- Case D: Fresh transaction (Atomically insert booking, payment, and CRM lead)
  SELECT id INTO v_conflicting_slot_id
  FROM public.bookings
  WHERE booking_date = v_booking_date
    AND booking_time = v_booking_time
    AND status IN ('confirmed', 'rescheduled')
    AND (razorpay_order_id IS NULL OR razorpay_order_id != v_clean_order_id)
  LIMIT 1;

  IF v_conflicting_slot_id IS NOT NULL THEN
    v_is_slot_conflicted := true;
    v_booking_status := 'reschedule_pending';
    v_booking_notes := 'SLOT_CONFLICT: Time slot taken by concurrent transaction. Payment captured (Razorpay ' || v_clean_payment_id || '). Priority reschedule required.';
  END IF;

  v_booking_id := pg_catalog.coalesce(p_booking_details->>'id', 'bkg_' || pg_catalog.gen_random_uuid()::text);
  v_booking_code := pg_catalog.substr(pg_catalog.coalesce(
    p_booking_details->>'booking_code',
    ('DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)))
  ), 1, 30);
  
  v_meet_url := pg_catalog.coalesce(
    pg_catalog.nullif(pg_catalog.trim(p_booking_details->>'meet_url'), ''),
    'PENDING_CALENDAR_PROVISIONING'
  );

  -- 1. Insert Booking (status is 'confirmed' or 'reschedule_pending', both fitting VARCHAR(20))
  -- calendar_event_id is strictly NULL until real Google Calendar event is provisioned
  INSERT INTO public.bookings (
    id, booking_code, customer_name, customer_email, customer_phone, business_name,
    primary_challenge, desired_outcome, website, linkedin, booking_date,
    booking_time, duration_minutes, base_amount, gst_rate, gst_amount,
    total_amount, currency, payment_id, razorpay_order_id, payment_status,
    calendar_event_id, meet_url, status, user_id, notes, created_at, updated_at
  ) VALUES (
    v_booking_id, v_booking_code, v_customer_name, v_customer_email, v_customer_phone, v_business_name,
    v_primary_challenge, v_desired_outcome, v_website, v_linkedin, v_booking_date,
    v_booking_time, v_duration_minutes, v_base_price, v_gst_rate, v_gst_amount,
    v_effective_total, pg_catalog.substr(v_currency, 1, 3), v_clean_payment_id, v_clean_order_id, 'paid',
    NULL, v_meet_url, v_booking_status, p_user_id,
    v_booking_notes, pg_catalog.now(), pg_catalog.now()
  )
  RETURNING * INTO v_new_booking;

  -- 2. Insert Payment Ledger (item_id is UUID, user_id can be NULL for guests)
  INSERT INTO public.payments (
    user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at
  ) VALUES (
    p_user_id, 'consultation', v_target_product_id,
    pg_catalog.coalesce(v_product.name, 'Business Growth & Scaling Consultation'),
    v_effective_total, v_currency, v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
  )
  RETURNING * INTO v_new_payment;

  -- 3. Insert CRM Lead
  BEGIN
    INSERT INTO public.crm_leads (
      id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
    ) VALUES (
      ('lead_' || pg_catalog.gen_random_uuid()::text), v_customer_name, v_customer_email, v_customer_phone,
      'Consultation Intake (Paid)', '1-on-1 Business Growth Consultation',
      ('Booking Code: ' || v_booking_code || ', Date: ' || v_booking_date::text || ' at ' || v_booking_time || 
       CASE WHEN v_is_slot_conflicted THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
      CASE WHEN v_is_slot_conflicted THEN 'Conflict Reschedule' ELSE 'New' END,
      v_effective_total, pg_catalog.now(), pg_catalog.now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'fulfilled', true,
    'already_fulfilled', false,
    'slot_conflict', v_is_slot_conflicted,
    'action_required', CASE WHEN v_is_slot_conflicted THEN 'reschedule_required' ELSE NULL END,
    'booking', pg_catalog.row_to_json(v_new_booking),
    'payment', pg_catalog.row_to_json(v_new_payment),
    'order_id', v_clean_order_id,
    'payment_id', v_clean_payment_id
  );

EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS
    v_diag_constraint = CONSTRAINT_NAME,
    v_diag_message = MESSAGE_TEXT;

  -- Re-query existing records immediately
  SELECT * INTO v_existing_payment FROM public.payments WHERE razorpay_payment_id = v_clean_payment_id;
  SELECT * INTO v_existing_booking FROM public.bookings WHERE payment_id = v_clean_payment_id OR razorpay_order_id = v_clean_order_id;

  -- Check if collision was due to duplicate payment or order IDs
  -- DO NOT let duplicate payments enter the slot-conflict recovery path!
  IF v_existing_payment.id IS NOT NULL OR v_existing_booking.id IS NOT NULL OR
     v_diag_constraint IN ('idx_bookings_payment_id', 'idx_bookings_razorpay_order_id', 'idx_payments_razorpay_payment', 'payments_pkey', 'payments_razorpay_payment_id_key') OR
     v_diag_message LIKE '%idx_bookings_payment_id%' OR
     v_diag_message LIKE '%idx_bookings_razorpay_order_id%' OR
     v_diag_message LIKE '%idx_payments_razorpay_payment%' THEN

    IF v_existing_payment.id IS NOT NULL AND v_existing_booking.id IS NOT NULL THEN
      -- Validate idempotency invariants strictly
      IF v_existing_payment.razorpay_order_id = v_clean_order_id
         AND pg_catalog.round(v_existing_payment.amount, 2) = v_effective_total
         AND pg_catalog.upper(v_existing_payment.currency) = v_currency
         AND (v_existing_payment.item_id IS NULL OR v_existing_payment.item_id = v_target_product_id)
         AND v_existing_payment.status IN ('captured', 'paid')
         AND (p_user_id IS NULL OR v_existing_payment.user_id IS NULL OR v_existing_payment.user_id = p_user_id)
         AND pg_catalog.lower(pg_catalog.trim(v_existing_booking.customer_email)) = v_customer_email THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', true,
          'fulfilled', true,
          'already_fulfilled', true,
          'concurrency_deduplicated', true,
          'booking', pg_catalog.row_to_json(v_existing_booking),
          'payment', pg_catalog.row_to_json(v_existing_payment),
          'order_id', v_clean_order_id,
          'payment_id', v_clean_payment_id
        );
      ELSE
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'error', 'Security violation: concurrent payment record does not match expected order, product, amount, or identity invariants.'
        );
      END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Duplicate payment/order collision detected during concurrent execution (' || pg_catalog.coalesce(v_diag_constraint, 'duplicate_transaction') || ').'
    );
  END IF;

  -- Handle random booking-code collisions (retry with high-entropy code)
  IF v_diag_constraint = 'bookings_booking_code_key' OR v_diag_message LIKE '%bookings_booking_code_key%' OR v_diag_message LIKE '%bookings_booking_code%' THEN
    BEGIN
      v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
      v_booking_code := 'DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
                        pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));

      INSERT INTO public.bookings (
        id, booking_code, customer_name, customer_email, customer_phone, business_name,
        primary_challenge, desired_outcome, website, linkedin, booking_date,
        booking_time, duration_minutes, base_amount, gst_rate, gst_amount,
        total_amount, currency, payment_id, razorpay_order_id, payment_status,
        calendar_event_id, meet_url, status, user_id, notes, created_at, updated_at
      ) VALUES (
        v_booking_id, v_booking_code, v_customer_name, v_customer_email, v_customer_phone, v_business_name,
        v_primary_challenge, v_desired_outcome, v_website, v_linkedin, v_booking_date,
        v_booking_time, v_duration_minutes, v_base_price, v_gst_rate, v_gst_amount,
        v_effective_total, pg_catalog.substr(v_currency, 1, 3), v_clean_payment_id, v_clean_order_id, 'paid',
        NULL, v_meet_url, v_booking_status, p_user_id,
        v_booking_notes, pg_catalog.now(), pg_catalog.now()
      )
      RETURNING * INTO v_new_booking;

      INSERT INTO public.payments (
        user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at
      ) VALUES (
        p_user_id, 'consultation', v_target_product_id,
        pg_catalog.coalesce(v_product.name, 'Business Growth & Scaling Consultation'),
        v_effective_total, v_currency, v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
      )
      RETURNING * INTO v_new_payment;

      RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'fulfilled', true,
        'already_fulfilled', false,
        'code_regenerated', true,
        'slot_conflict', v_is_slot_conflicted,
        'action_required', CASE WHEN v_is_slot_conflicted THEN 'reschedule_required' ELSE NULL END,
        'booking', pg_catalog.row_to_json(v_new_booking),
        'payment', pg_catalog.row_to_json(v_new_payment),
        'order_id', v_clean_order_id,
        'payment_id', v_clean_payment_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Consultation fulfillment booking code retry failure: constraint=%, message=%, order_id=%, payment_id=%',
        v_diag_constraint, v_diag_message, v_clean_order_id, v_clean_payment_id;
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Failed to generate unique booking code after collision.'
      );
    END;
  END IF;

  -- Handle active slot collision (idx_unique_active_booking_slot)
  -- The slot was taken by a concurrent checkout that committed a millisecond earlier.
  -- Captured funds MUST be saved in payments, and booking must be recorded as 'reschedule_pending'.
  IF v_diag_constraint = 'idx_unique_active_booking_slot' OR v_diag_message LIKE '%idx_unique_active_booking_slot%' THEN
    BEGIN
      v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
      v_booking_code := 'DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
                        pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));
      
      INSERT INTO public.payments (
        user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at
      ) VALUES (
        p_user_id, 'consultation', v_target_product_id,
        pg_catalog.coalesce(v_product.name, 'Business Growth & Scaling Consultation'),
        v_effective_total, v_currency, v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
      )
      RETURNING * INTO v_new_payment;

      INSERT INTO public.bookings (
        id, booking_code, customer_name, customer_email, customer_phone, business_name,
        primary_challenge, desired_outcome, website, linkedin, booking_date,
        booking_time, duration_minutes, base_amount, gst_rate, gst_amount,
        total_amount, currency, payment_id, razorpay_order_id, payment_status,
        calendar_event_id, meet_url, status, user_id, notes, created_at, updated_at
      ) VALUES (
        v_booking_id, v_booking_code, v_customer_name, v_customer_email, v_customer_phone, v_business_name,
        v_primary_challenge, v_desired_outcome, v_website, v_linkedin, v_booking_date,
        v_booking_time, v_duration_minutes, v_base_price, v_gst_rate, v_gst_amount,
        v_effective_total, pg_catalog.substr(v_currency, 1, 3), v_clean_payment_id, v_clean_order_id, 'paid',
        NULL, 'PENDING_CALENDAR_PROVISIONING', 'reschedule_pending', p_user_id,
        'SLOT_CONFLICT: Concurrent checkout won active slot. Payment captured safely (Razorpay ' || v_clean_payment_id || '). Priority reschedule required.',
        pg_catalog.now(), pg_catalog.now()
      )
      RETURNING * INTO v_new_booking;

      RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'fulfilled', true,
        'slot_conflict', true,
        'action_required', 'reschedule_required',
        'booking', pg_catalog.row_to_json(v_new_booking),
        'payment', pg_catalog.row_to_json(v_new_payment),
        'order_id', v_clean_order_id,
        'payment_id', v_clean_payment_id,
        'message', 'Payment captured, but slot was taken by concurrent transaction. Booking recorded as reschedule_pending.'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Consultation fulfillment slot conflict recovery failure: constraint=%, message=%, order_id=%, payment_id=%',
        v_diag_constraint, v_diag_message, v_clean_order_id, v_clean_payment_id;
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'Failed during slot conflict recovery: ' || SQLERRM
      );
    END;
  END IF;

  -- Fallback logging for any unexpected unique violation
  RAISE WARNING 'Consultation fulfillment unexpected unique violation: constraint=%, message=%, order_id=%, payment_id=%',
    v_diag_constraint, v_diag_message, v_clean_order_id, v_clean_payment_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', false,
    'error', 'Transaction rejected due to unique constraint conflict (' || pg_catalog.coalesce(v_diag_constraint, 'unknown') || ').'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION OWNERSHIP & EXECUTION PERMISSIONS
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) TO postgres;

-- ------------------------------------------------------------------------------
-- 6. SCHEMA CACHE RELOAD NOTIFICATION
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- 7. ROLLBACK PROCEDURE & SECURITY POSTURE (STRICT AUDIT NOTICE)
-- ------------------------------------------------------------------------------
-- CRITICAL SECURITY POSTURE NOTICE:
-- In any rollback of this migration, NEVER restore "WITH CHECK (true)" for public booking inserts!
-- Restoring "WITH CHECK (true)" would re-open public direct client write vulnerabilities,
-- allowing unauthenticated attackers to insert unverified bookings without gateway payments.
--
-- Documented pre-migration posture:
-- 1. DROP FUNCTION IF EXISTS public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID);
-- 2. DROP INDEX IF EXISTS public.idx_bookings_payment_id;
-- 3. DROP INDEX IF EXISTS public.idx_bookings_razorpay_order_id;
-- 4. Keep RLS enabled on public.bookings (ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;).
-- 5. Keep client INSERT revoked (REVOKE INSERT ON public.bookings FROM anon, authenticated;).
-- 6. Direct inserts must remain restricted to service_role or admin (CREATE POLICY "Admin All Bookings" ON public.bookings FOR ALL USING (public.is_admin());).
-- 7. Re-enable NOT NULL on public.payments.user_id ONLY if guest payments have been purged or backfilled.
