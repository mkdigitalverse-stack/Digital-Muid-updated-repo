-- ==============================================================================
-- DIGITAL MUID — STAGING SQL INTEGRATION TEST SUITE
-- File: supabase/tests/consultation_fulfillment_test.sql
-- ==============================================================================
-- EXECUTION NOTICE:
-- This script contains executable PostgreSQL PL/pgSQL integration tests intended
-- exclusively for an ISOLATED STAGING DATABASE.
--
-- STRICT PRE-CONDITIONS:
-- 1. Must NEVER be executed against production (kpuxtsworzkueyffjaaz).
-- 2. Requires service_role or postgres superuser privileges to execute.
-- 3. Runs inside an explicit transaction block and executes ROLLBACK at the end,
--    leaving zero persistent state in the database.
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_test_product_id UUID := '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid;
  v_test_user_id UUID := NULL;
  v_res JSONB;
  v_booking_count INT;
  v_payment_count INT;
  v_payment_record RECORD;
  v_booking_record RECORD;
  v_anon_insert_blocked BOOLEAN := false;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'DIGITAL MUID: STAGING SQL INTEGRATION TEST SUITE';
  RAISE NOTICE '============================================================';

  -- ----------------------------------------------------------------------------
  -- FIXTURE SETUP: Respect Foreign Keys & Active Catalog State
  -- ----------------------------------------------------------------------------
  -- 1. Ensure canonical consultation product exists and is active
  INSERT INTO public.consultation_products (
    id, name, duration_minutes, base_price, gst_rate, currency, active, description, features
  ) VALUES (
    v_test_product_id,
    'Business Growth & Scaling Consultation',
    30, 499.00, 0.18, 'INR', true,
    'One-on-one executive advisory session',
    '["30-minute private session", "Actionable roadmap"]'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET active = true, base_price = 499.00, gst_rate = 0.18;

  -- 2. Foreign Key Guard: Find an existing auth.users ID for authenticated test,
  --    or dynamically create a temporary test user if auth schema is writable.
  SELECT id INTO v_test_user_id FROM auth.users LIMIT 1;
  
  IF v_test_user_id IS NULL THEN
    BEGIN
      v_test_user_id := gen_random_uuid();
      INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud, created_at, updated_at)
      VALUES (v_test_user_id, 'test_student_staging@example.com', '{"full_name":"Test Student"}'::jsonb, 'authenticated', 'authenticated', now(), now());
    EXCEPTION WHEN OTHERS THEN
      -- If auth.users table is not directly writable in this context, use NULL (guest payment)
      v_test_user_id := NULL;
      RAISE NOTICE 'Notice: Direct auth.users fixture insert unavailable. Authenticated student tests will use guest payment.';
    END;
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST 1: Guest Checkout Fulfillment (user_id IS NULL)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 1: Guest Checkout Fulfillment (p_user_id IS NULL)...';
  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_guest_001',
    p_payment_id => 'pay_stg_guest_001',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Guest Client',
      'customerEmail', 'guest.staging@example.com',
      'customerPhone', '+919123456789',
      'date', '2026-11-20',
      'time', '11:00 AM'
    ),
    p_product_id => v_test_product_id
  );

  ASSERT (v_res->>'success')::boolean = true, 'Test 1 Failed: Guest fulfillment returned success=false';
  ASSERT (v_res->>'already_fulfilled')::boolean = false, 'Test 1 Failed: Expected fresh fulfillment';
  
  SELECT * INTO v_payment_record FROM public.payments WHERE razorpay_payment_id = 'pay_stg_guest_001';
  SELECT * INTO v_booking_record FROM public.bookings WHERE razorpay_order_id = 'order_stg_guest_001';
  
  ASSERT v_payment_record.user_id IS NULL, 'Test 1 Failed: Guest payment user_id must be NULL';
  ASSERT v_booking_record.status = 'confirmed', 'Test 1 Failed: Booking status must be confirmed';
  ASSERT v_booking_record.payment_status = 'paid', 'Test 1 Failed: Booking payment_status must be paid';
  ASSERT v_booking_record.meet_url = 'PENDING_CALENDAR_PROVISIONING', 'Test 1 Failed: Meet URL must be PENDING_CALENDAR_PROVISIONING';
  RAISE NOTICE 'Test 1 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 2: Authenticated Student Fulfillment (Respecting FK constraint)
  -- ----------------------------------------------------------------------------
  IF v_test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Test 2: Authenticated Student Fulfillment (user_id: %)...', v_test_user_id;
    v_res := public.fulfill_consultation_payment(
      p_user_id => v_test_user_id,
      p_order_id => 'order_stg_auth_002',
      p_payment_id => 'pay_stg_auth_002',
      p_amount => 588.82,
      p_currency => 'INR',
      p_booking_details => jsonb_build_object(
        'customerName', 'Authenticated Student',
        'customerEmail', 'student.staging@example.com',
        'customerPhone', '+919876543210',
        'date', '2026-11-21',
        'time', '02:00 PM'
      ),
      p_product_id => v_test_product_id
    );

    ASSERT (v_res->>'success')::boolean = true, 'Test 2 Failed: Authenticated fulfillment failed';
    SELECT * INTO v_payment_record FROM public.payments WHERE razorpay_payment_id = 'pay_stg_auth_002';
    ASSERT v_payment_record.user_id = v_test_user_id, 'Test 2 Failed: Payment user_id does not match authenticated student';
    RAISE NOTICE 'Test 2 PASSED.';
  ELSE
    RAISE NOTICE 'Test 2 SKIPPED (No auth.users record available in test fixture).';
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST 3: Strict Idempotency / Deduplication (Duplicate Webhook Delivery)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 3: Idempotent Duplicate Delivery (Retry Safety)...';
  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_guest_001',
    p_payment_id => 'pay_stg_guest_001',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Guest Client',
      'customerEmail', 'guest.staging@example.com',
      'date', '2026-11-20',
      'time', '11:00 AM'
    ),
    p_product_id => v_test_product_id
  );

  ASSERT (v_res->>'success')::boolean = true, 'Test 3 Failed: Idempotent retry must return success = true';
  ASSERT (v_res->>'already_fulfilled')::boolean = true, 'Test 3 Failed: Expected already_fulfilled = true';
  
  SELECT count(*) INTO v_booking_count FROM public.bookings WHERE razorpay_order_id = 'order_stg_guest_001';
  SELECT count(*) INTO v_payment_count FROM public.payments WHERE razorpay_payment_id = 'pay_stg_guest_001';
  ASSERT v_booking_count = 1, 'Test 3 Failed: Duplicate booking record was created!';
  ASSERT v_payment_count = 1, 'Test 3 Failed: Duplicate payment record was created!';
  RAISE NOTICE 'Test 3 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 4: Active Slot Conflict Handling (idx_unique_active_booking_slot)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 4: Active Slot Conflict Handling (status: reschedule_pending)...';
  -- Attempt to book the EXACT same slot: 2026-11-20 at 11:00 AM with a new payment
  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_conflict_003',
    p_payment_id => 'pay_stg_conflict_003',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Conflicted Client',
      'customerEmail', 'conflict@example.com',
      'customerPhone', '+919988776655',
      'date', '2026-11-20',
      'time', '11:00 AM' -- Same slot as Test 1
    ),
    p_product_id => v_test_product_id
  );

  ASSERT (v_res->>'success')::boolean = true, 'Test 4 Failed: Slot conflict must preserve captured payment';
  ASSERT (v_res->>'slot_conflict')::boolean = true, 'Test 4 Failed: Expected slot_conflict = true';
  ASSERT v_res->>'action_required' = 'reschedule_required', 'Test 4 Failed: Expected reschedule_required action';

  SELECT * INTO v_payment_record FROM public.payments WHERE razorpay_payment_id = 'pay_stg_conflict_003';
  SELECT * INTO v_booking_record FROM public.bookings WHERE razorpay_order_id = 'order_stg_conflict_003';

  ASSERT v_payment_record.status = 'captured', 'Test 4 Failed: Conflicted payment must be captured';
  ASSERT v_booking_record.status = 'reschedule_pending', 'Test 4 Failed: Booking status must be reschedule_pending';
  ASSERT length(v_booking_record.status) <= 20, 'Test 4 Failed: Booking status exceeds VARCHAR(20)';
  ASSERT v_booking_record.payment_status = 'paid', 'Test 4 Failed: Booking payment_status must be paid';
  RAISE NOTICE 'Test 4 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 5: Fail-Closed On Inactive / Missing Product
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 5: Fail-Closed On Inactive / Missing Product...';
  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_badprod_004',
    p_payment_id => 'pay_stg_badprod_004',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Test Client',
      'customerEmail', 'test@example.com',
      'date', '2026-11-22',
      'time', '03:00 PM'
    ),
    p_product_id => '00000000-0000-0000-0000-000000000000'::uuid
  );

  ASSERT (v_res->>'success')::boolean = false, 'Test 5 Failed: Non-existent product must fail closed';
  RAISE NOTICE 'Test 5 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 6: Amount Mismatch Rejection
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 6: Amount Mismatch Rejection...';
  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_badamt_005',
    p_payment_id => 'pay_stg_badamt_005',
    p_amount => 499.00, -- Underpayment without GST
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Test Client',
      'customerEmail', 'test@example.com',
      'date', '2026-11-22',
      'time', '03:00 PM'
    ),
    p_product_id => v_test_product_id
  );

  ASSERT (v_res->>'success')::boolean = false, 'Test 6 Failed: Underpaid amount must be rejected';
  RAISE NOTICE 'Test 6 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 7: Spoofed Order ID on Existing Payment Rejection
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 7: Spoofed Order ID on Existing Payment Rejection...';
  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_spoofed_attack',
    p_payment_id => 'pay_stg_guest_001', -- Existing valid payment ID
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Attacker',
      'customerEmail', 'attacker@example.com',
      'date', '2026-11-25',
      'time', '04:00 PM'
    ),
    p_product_id => v_test_product_id
  );

  ASSERT (v_res->>'success')::boolean = false, 'Test 7 Failed: Spoofed order ID must be rejected';
  RAISE NOTICE 'Test 7 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 8: Self-Healing Incomplete State (Booking Exists, Payment Missing)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 8: Self-Healing Incomplete State...';
  INSERT INTO public.bookings (
    id, booking_code, customer_name, customer_email, customer_phone, business_name,
    primary_challenge, desired_outcome, booking_date, booking_time, duration_minutes,
    base_amount, gst_rate, gst_amount, total_amount, currency, razorpay_order_id,
    payment_id, payment_status, meet_url, status
  ) VALUES (
    'bkg_heal_test_008', 'DM-2026-HEAL8', 'Heal Client', 'heal@example.com', '+919000000000',
    'Heal Business', 'Clarity', 'Growth', '2026-11-26', '05:00 PM', 30,
    499.00, 0.18, 89.82, 588.82, 'INR', 'order_stg_heal_008',
    'pay_stg_heal_008', 'paid', 'PENDING_CALENDAR_PROVISIONING', 'confirmed'
  );

  v_res := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_stg_heal_008',
    p_payment_id => 'pay_stg_heal_008',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Heal Client',
      'customerEmail', 'heal@example.com',
      'date', '2026-11-26',
      'time', '05:00 PM'
    ),
    p_product_id => v_test_product_id
  );

  ASSERT (v_res->>'success')::boolean = true, 'Test 8 Failed: Healing call must succeed';
  ASSERT (v_res->>'healed_ledger')::boolean = true, 'Test 8 Failed: Expected healed_ledger = true';
  SELECT count(*) INTO v_payment_count FROM public.payments WHERE razorpay_payment_id = 'pay_stg_heal_008';
  ASSERT v_payment_count = 1, 'Test 8 Failed: Payment ledger must be created during healing';
  RAISE NOTICE 'Test 8 PASSED.';

  -- ----------------------------------------------------------------------------
  -- TEST 9: Client Direct INSERT Lockout Verification (RLS & Grant Defense)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 9: Verifying client roles cannot directly INSERT into public.bookings...';
  BEGIN
    -- Test as anon role
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'INSERT INTO public.bookings (id, booking_code, customer_name, customer_email, customer_phone, business_name, primary_challenge, desired_outcome, booking_date, booking_time, base_amount, gst_rate, gst_amount, total_amount, meet_url) VALUES (''bkg_hack'', ''DM-HACK'', ''Hacker'', ''hack@test.com'', ''123'', ''Hack'', ''None'', ''None'', ''2026-12-01'', ''10:00 AM'', 0, 0, 0, 0, ''hack'')';
    -- If execution reached here, the security test failed!
    v_anon_insert_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_anon_insert_blocked := true;
  END;

  EXECUTE 'RESET ROLE';
  ASSERT v_anon_insert_blocked = true, 'Test 9 Failed: anon role was able to directly INSERT into public.bookings!';
  RAISE NOTICE 'Test 9 PASSED (Direct table INSERT by anon successfully denied).';

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ALL 9 STAGING SQL INTEGRATION TESTS PASSED CLEANLY.';
  RAISE NOTICE '============================================================';
END;
$$;

-- Always rollback test transaction so staging database remains 100% clean
ROLLBACK;
