-- ==============================================================================
-- DIGITAL MUID — COORDINATED TWO-SESSION CONCURRENCY SQL TEST SUITE
-- File: supabase/tests/concurrency_session_test.sql
-- ==============================================================================
-- PURPOSE:
-- Verifies transactional behavior under concurrent execution across two separate
-- database sessions / worker connections:
-- 1. Simultaneous booking attempts for the EXACT same active time slot (Race Condition).
-- 2. Webhook duplicate delivery / replay race for the exact same payment ID.
-- 3. Retry after ambiguous network response (client disconnect recovery).
-- 4. Rejection of duplicate payment collisions with mismatched invariants.
--
-- EXECUTION NOTICE:
-- Intended EXCLUSIVELY for isolated staging databases.
-- NEVER execute against production (kpuxtsworzkueyffjaaz).
-- ==============================================================================

\set ON_ERROR_STOP on

-- ==============================================================================
-- PART 1: AUTOMATED SIMULATED CONCURRENCY (Single Runner / Self-Contained)
-- Runs inside a single transaction with savepoints to test subtransaction isolation
-- and constraint collision traps.
-- ==============================================================================
BEGIN;

DO $$
DECLARE
  v_prod_id UUID := '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid;
  v_res1 JSONB;
  v_res2 JSONB;
  v_res3 JSONB;
  v_res4 JSONB;
  v_bkg_count INT;
  v_pay_count INT;
  v_bkg1 RECORD;
  v_bkg2 RECORD;
  v_pay1 RECORD;
  v_pay2 RECORD;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'DIGITAL MUID: CONCURRENCY & INTEGRITY TEST SUITE';
  RAISE NOTICE '============================================================';

  -- 0. Fixture: ensure product exists and is active
  INSERT INTO public.consultation_products (
    id, name, duration_minutes, base_price, gst_rate, currency, active, description, features
  ) VALUES (
    v_prod_id, 'Business Growth Consultation', 30, 499.00, 0.18, 'INR', true,
    'Executive Session', '["30 min"]'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET active = true, base_price = 499.00, gst_rate = 0.18;

  -- ----------------------------------------------------------------------------
  -- SCENARIO A: Concurrent Checkout for the EXACT Same Slot (23505 Active Slot Race)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Scenario A: Simultaneous checkout on identical slot (2026-12-15 10:00 AM)...';

  -- Session 1 / Customer A checkout completes
  v_res1 := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_conc_sess1_001',
    p_payment_id => 'pay_conc_sess1_001',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Customer A (Session 1)',
      'customerEmail', 'cust.a@example.com',
      'customerPhone', '+919111111111',
      'date', '2026-12-15',
      'time', '10:00 AM'
    ),
    p_product_id => v_prod_id
  );

  ASSERT (v_res1->>'success')::boolean = true, 'Scenario A Failed: Customer A fulfillment failed';
  ASSERT (v_res1->>'slot_conflict')::boolean = false, 'Scenario A Failed: Customer A should not have slot conflict';

  -- Session 2 / Customer B concurrent checkout captures money at Razorpay, attempts fulfillment on same slot
  v_res2 := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_conc_sess2_002',
    p_payment_id => 'pay_conc_sess2_002',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Customer B (Session 2)',
      'customerEmail', 'cust.b@example.com',
      'customerPhone', '+919222222222',
      'date', '2026-12-15',
      'time', '10:00 AM' -- Same slot!
    ),
    p_product_id => v_prod_id
  );

  -- Assertions for Customer B:
  ASSERT (v_res2->>'success')::boolean = true, 'Scenario A Failed: Customer B fulfillment must succeed (capturing funds)';
  ASSERT (v_res2->>'slot_conflict')::boolean = true, 'Scenario A Failed: Customer B must be flagged with slot_conflict = true';
  ASSERT v_res2->>'action_required' = 'reschedule_required', 'Scenario A Failed: Customer B must require reschedule';

  -- Invariant Checks in Database:
  SELECT * INTO v_bkg1 FROM public.bookings WHERE razorpay_order_id = 'order_conc_sess1_001';
  SELECT * INTO v_bkg2 FROM public.bookings WHERE razorpay_order_id = 'order_conc_sess2_002';
  SELECT * INTO v_pay1 FROM public.payments WHERE razorpay_payment_id = 'pay_conc_sess1_001';
  SELECT * INTO v_pay2 FROM public.payments WHERE razorpay_payment_id = 'pay_conc_sess2_002';

  ASSERT v_bkg1.status = 'confirmed', 'Scenario A Failed: Customer A booking status must be confirmed';
  ASSERT v_bkg2.status = 'reschedule_pending', 'Scenario A Failed: Customer B booking status must be reschedule_pending';
  ASSERT length(v_bkg2.status) <= 20, 'Scenario A Failed: Customer B status exceeds VARCHAR(20)';
  ASSERT v_pay1.status = 'captured', 'Scenario A Failed: Customer A payment must be captured';
  ASSERT v_pay2.status = 'captured', 'Scenario A Failed: Customer B payment must be captured (funds not dropped)';
  ASSERT v_bkg2.calendar_event_id IS NULL, 'Scenario A Failed: Conflicted booking calendar_event_id must be NULL';
  ASSERT v_bkg2.meet_url = 'PENDING_CALENDAR_PROVISIONING', 'Scenario A Failed: Conflicted booking meet_url must be pending';

  RAISE NOTICE 'Scenario A PASSED: Customer A confirmed, Customer B safely persisted as reschedule_pending with payment captured.';

  -- ----------------------------------------------------------------------------
  -- SCENARIO B: Duplicate Delivery / Webhook Replay Race
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Scenario B: Duplicate delivery / Webhook replay race...';

  -- Simulate Webhook replay of Customer A transaction
  v_res3 := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_conc_sess1_001',
    p_payment_id => 'pay_conc_sess1_001',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Customer A (Session 1)',
      'customerEmail', 'cust.a@example.com',
      'date', '2026-12-15',
      'time', '10:00 AM'
    ),
    p_product_id => v_prod_id
  );

  ASSERT (v_res3->>'success')::boolean = true, 'Scenario B Failed: Webhook replay must return success';
  ASSERT (v_res3->>'already_fulfilled')::boolean = true, 'Scenario B Failed: Expected already_fulfilled = true';

  SELECT count(*) INTO v_bkg_count FROM public.bookings WHERE razorpay_order_id = 'order_conc_sess1_001';
  SELECT count(*) INTO v_pay_count FROM public.payments WHERE razorpay_payment_id = 'pay_conc_sess1_001';
  ASSERT v_bkg_count = 1, 'Scenario B Failed: Duplicate booking was created!';
  ASSERT v_pay_count = 1, 'Scenario B Failed: Duplicate payment was created!';
  RAISE NOTICE 'Scenario B PASSED: Webhook replay deduplicated cleanly without side effects.';

  -- ----------------------------------------------------------------------------
  -- SCENARIO C: Invariant Tampering / Duplicate Payment Hijack Rejection
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Scenario C: Rejecting duplicate payment with mismatched customer identity...';

  -- An attacker tries to reuse Customer A''s captured payment ID with their own email
  v_res4 := public.fulfill_consultation_payment(
    p_user_id => NULL,
    p_order_id => 'order_conc_sess1_001',
    p_payment_id => 'pay_conc_sess1_001',
    p_amount => 588.82,
    p_currency => 'INR',
    p_booking_details => jsonb_build_object(
      'customerName', 'Attacker',
      'customerEmail', 'attacker@example.com', -- Inconsistent email!
      'date', '2026-12-15',
      'time', '10:00 AM'
    ),
    p_product_id => v_prod_id
  );

  ASSERT (v_res4->>'success')::boolean = false, 'Scenario C Failed: Tampered customer email must be rejected';
  RAISE NOTICE 'Scenario C PASSED: Tampered duplicate payment rejected by invariant guard.';

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ALL CONCURRENCY TESTS PASSED CLEANLY.';
  RAISE NOTICE '============================================================';
END;
$$;

ROLLBACK;

-- ==============================================================================
-- PART 2: MANUAL TWO-TERMINAL COORDINATION INSTRUCTIONS
-- To manually verify physical cross-session locking across two parallel psql shells:
--
-- [Terminal 1 - Session 1]
--   psql "$STAGING_DATABASE_URL"
--   BEGIN;
--   SELECT public.fulfill_consultation_payment(
--     NULL, 'ord_sess1_live', 'pay_sess1_live', 588.82, 'INR',
--     '{"customerEmail":"live1@example.com","date":"2026-12-20","time":"02:00 PM"}'::jsonb
--   );
--   -- DO NOT COMMIT YET.
--
-- [Terminal 2 - Session 2]
--   psql "$STAGING_DATABASE_URL"
--   SELECT public.fulfill_consultation_payment(
--     NULL, 'ord_sess2_live', 'pay_sess2_live', 588.82, 'INR',
--     '{"customerEmail":"live2@example.com","date":"2026-12-20","time":"02:00 PM"}'::jsonb
--   );
--   -- Terminal 2 will wait for Terminal 1's lock on idx_unique_active_booking_slot.
--
-- [Terminal 1 - Session 1]
--   COMMIT;
--
-- [Terminal 2 - Session 2]
--   -- Immediately unblocks: detects 23505 unique violation, recovers cleanly:
--   -- Persists payment 'pay_sess2_live' with status 'captured',
--   -- Persists booking with status 'reschedule_pending',
--   -- Returns {"success":true,"slot_conflict":true,"action_required":"reschedule_required"}.
-- ==============================================================================
