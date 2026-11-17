-- ==============================================================================
-- DIGITALMUID V4.3 — ACTUAL POSTGRESQL INTEGRATION TEST SUITE (CHRONOLOGICAL CI)
-- File: supabase/tests/v4_3_postgres_integration_test.sql
-- ==============================================================================
-- Executes real SQL against disposable `digitalmuid_ci_chronological_replay`
-- AFTER full chronological replay of all 28 migrations (20260826..20261116).
-- ==============================================================================

\set ON_ERROR_STOP on

-- 0. SAFETY & POST-MIGRATION STRUCTURAL / SEED DIAGNOSTICS
DO $$
DECLARE
  v_db_name TEXT := pg_catalog.current_database();
  v_srv_ver_num INTEGER := pg_catalog.current_setting('server_version_num')::integer;
  v_idx_count INTEGER;
  v_col_type TEXT;
  v_prod RECORD;
BEGIN
  IF v_db_name IS DISTINCT FROM 'digitalmuid_ci_chronological_replay' THEN
    RAISE EXCEPTION 'SAFETY HALT: v4_3_postgres_integration_test.sql must run in digitalmuid_ci_chronological_replay, got %.', v_db_name;
  END IF;

  IF v_srv_ver_num < 170000 OR v_srv_ver_num >= 180000 THEN
    RAISE EXCEPTION 'SAFETY HALT: Integration suite requires PostgreSQL 17, got server_version_num=%.', v_srv_ver_num;
  END IF;

  -- Confirm assumed disposable schema shapes explicitly (fail clearly on mismatch)
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'meeting_link';
  IF v_col_type IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION 'SCHEMA ASSUMPTION DIAGNOSTIC FAILURE: public.bookings.meeting_link expected text, got %.', COALESCE(v_col_type, 'MISSING');
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'id';
  IF v_col_type NOT IN ('text', 'uuid') THEN
    RAISE EXCEPTION 'SCHEMA ASSUMPTION DIAGNOSTIC FAILURE: public.crm_leads.id expected text or uuid, got %.', COALESCE(v_col_type, 'MISSING');
  END IF;

  -- Explicitly verify canonical seeded consultation_products row from 20260926000001
  SELECT id, base_price, gst_rate, currency, active INTO v_prod
  FROM public.consultation_products
  WHERE id = '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid;

  IF NOT FOUND
     OR v_prod.active IS DISTINCT FROM true
     OR v_prod.base_price IS DISTINCT FROM 499.00
     OR v_prod.gst_rate IS DISTINCT FROM 0.18
     OR v_prod.currency IS DISTINCT FROM 'INR' THEN
    RAISE EXCEPTION 'FIXTURE DIAGNOSTIC FAILURE: Expected seeded active consultation_products row 31bbb9bf-ce10-4da4-a517-dfc673f9b875 (499.00, 0.18, INR), got %.',
      pg_catalog.row_to_json(v_prod);
  END IF;

  -- Confirm all 8 Phase B concurrent indexes exist and are valid/ready
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'idx_credit_notes_number',
      'idx_credit_notes_refund_id',
      'idx_credit_notes_payment_id',
      'idx_credit_notes_user_id',
      'idx_profiles_student_id',
      'idx_course_enrollments_enrollment_id',
      'idx_payments_invoice_number',
      'idx_payments_credit_note_number'
    )
    AND i.indisvalid = true
    AND i.indisready = true;

  IF v_idx_count <> 8 THEN
    RAISE EXCEPTION 'FAILED [Phase B]: Expected 8 valid/ready indexes, found %.', v_idx_count;
  END IF;

  RAISE NOTICE 'PASS [0]: Structural, PG17, seeded consultation_products & Phase B index verification passed (crm_leads.id=%).', v_col_type;
END $$;

-- Seed synthetic CI fixtures cleanly inside a transaction and verify triggers
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ci.student1@example.test', '{"full_name":"CI Student One"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'ci.student2@example.test', '{"full_name":"CI Student Two"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_stu_cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_stu_cnt
  FROM public.profiles
  WHERE id IN ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002')
    AND student_id ~ '^DM-STU-[0-9]+$';
  IF v_stu_cnt <> 2 THEN
    RAISE EXCEPTION 'FIXTURE FAILURE: Expected 2 auto-provisioned profiles with DM-STU- student_ids, found %.', v_stu_cnt;
  END IF;
END $$;

INSERT INTO public.courses (
  id, slug, title, price, offer_price, currency, status, enrolled_count
) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'ci-published-course', 'CI Published Course', 1000.00, 588.82, 'INR', 'published', 0),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'ci-draft-course', 'CI Draft Course', 999.00, NULL, 'INR', 'draft', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.student_course_wishlist (user_id, course_id)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001')
ON CONFLICT (user_id, course_id) DO NOTHING;

INSERT INTO public.resources (
  id, title, slug, resource_type, access_type, price, currency, status
) VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'CI Paid Bundle', 'ci-paid-bundle', 'bundle', 'paid', 588.82, 'INR', 'published'),
  ('cccccccc-0000-4000-8000-000000000002', 'CI Free Guide', 'ci-free-guide', 'guide', 'free', 0.00, 'INR', 'published'),
  ('cccccccc-0000-4000-8000-000000000003', 'CI Draft Resource', 'ci-draft-resource', 'bundle', 'paid', 299.00, 'INR', 'draft')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ==============================================================================
-- TEST 1: PRIVILEGE MATRIX (anon, authenticated, service_role, postgres)
-- Every negative exception test sets a boolean flag in EXCEPTION and asserts OUTSIDE.
-- ==============================================================================
DO $$
DECLARE
  v_res JSONB;
  v_cn_count INTEGER := 0;
  v_rejected BOOLEAN;
  v_err_state TEXT;
  v_err_msg TEXT;
  v_row_cnt INTEGER;
BEGIN
  IF pg_catalog.has_function_privilege('anon', 'public.fulfill_consultation_payment(uuid,text,text,numeric,text,jsonb,uuid)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.fulfill_consultation_payment(uuid,text,text,numeric,text,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: fulfill_consultation_payment executable by anon or authenticated.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.fulfill_course_enrollment(uuid,uuid,numeric,text,text,text)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.fulfill_course_enrollment(uuid,uuid,numeric,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: fulfill_course_enrollment executable by anon or authenticated.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.fulfill_resource_purchase(uuid,uuid,numeric,text,text,text,text,text,text,text)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.fulfill_resource_purchase(uuid,uuid,numeric,text,text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: fulfill_resource_purchase executable by anon or authenticated.';
  END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.record_credit_note_with_limit(text,text,numeric,text,uuid,text,timestamptz)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.record_credit_note_with_limit(text,text,numeric,text,uuid,text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: record_credit_note_with_limit executable by anon or authenticated.';
  END IF;

  IF NOT pg_catalog.has_function_privilege('service_role', 'public.fulfill_consultation_payment(uuid,text,text,numeric,text,jsonb,uuid)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.fulfill_course_enrollment(uuid,uuid,numeric,text,text,text)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.fulfill_resource_purchase(uuid,uuid,numeric,text,text,text,text,text,text,text)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.record_credit_note_with_limit(text,text,numeric,text,uuid,text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE FAIL: service_role lacks EXECUTE on hardened RPCs.';
  END IF;

  IF NOT pg_catalog.has_function_privilege('postgres', 'public.fulfill_consultation_payment(uuid,text,text,numeric,text,jsonb,uuid)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('postgres', 'public.fulfill_course_enrollment(uuid,uuid,numeric,text,text,text)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('postgres', 'public.fulfill_resource_purchase(uuid,uuid,numeric,text,text,text,text,text,text,text)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('postgres', 'public.record_credit_note_with_limit(text,text,numeric,text,uuid,text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE FAIL: postgres lacks EXECUTE on hardened RPCs.';
  END IF;

  -- 1A: authenticated -> fulfill_course_enrollment
  v_rejected := false;
  v_err_state := NULL;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.fulfill_course_enrollment(
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      588.82, 'INR', 'ord_unauth_1', 'pay_unauth_1'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected := true;
  END;
  RESET ROLE;
  IF NOT v_rejected OR v_err_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'SECURITY FAIL [1A]: authenticated executed or wrong SQLSTATE on fulfill_course_enrollment (rejected=%, state=%, msg=%).',
      v_rejected, v_err_state, v_err_msg;
  END IF;

  -- 1B: anon -> fulfill_resource_purchase
  v_rejected := false;
  v_err_state := NULL;
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.fulfill_resource_purchase(
      NULL, 'cccccccc-0000-4000-8000-000000000001'::uuid,
      588.82, 'INR', 'ord_anon_1', 'pay_anon_1'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected := true;
  END;
  RESET ROLE;
  IF NOT v_rejected OR v_err_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'SECURITY FAIL [1B]: anon executed or wrong SQLSTATE on fulfill_resource_purchase (rejected=%, state=%, msg=%).',
      v_rejected, v_err_state, v_err_msg;
  END IF;

  -- 1C: authenticated -> fulfill_consultation_payment
  v_rejected := false;
  v_err_state := NULL;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.fulfill_consultation_payment(
      NULL, 'ord_auth_c', 'pay_auth_c', 588.82, 'INR',
      '{"customer_email":"x@example.test","date":"2026-12-01","time":"10:00 AM"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected := true;
  END;
  RESET ROLE;
  IF NOT v_rejected OR v_err_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'SECURITY FAIL [1C]: authenticated executed or wrong SQLSTATE on fulfill_consultation_payment (rejected=%, state=%, msg=%).',
      v_rejected, v_err_state, v_err_msg;
  END IF;

  -- 1D: authenticated -> record_credit_note_with_limit
  v_rejected := false;
  v_err_state := NULL;
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT COUNT(*) INTO v_cn_count
    FROM public.record_credit_note_with_limit('pay_nonexistent', 'rfnd_unauth', 10.00);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected := true;
  END;
  RESET ROLE;
  IF NOT v_rejected OR v_err_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'SECURITY FAIL [1D]: authenticated executed or wrong SQLSTATE on record_credit_note_with_limit (rejected=%, state=%, msg=%).',
      v_rejected, v_err_state, v_err_msg;
  END IF;

  -- 1E: service_role works + rejects tampered amount + zero DB rows persisted
  SET LOCAL ROLE service_role;
  v_res := public.fulfill_course_enrollment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
    1.00, 'INR', 'ord_sr_check', 'pay_sr_check'
  );
  RESET ROLE;

  IF COALESCE((v_res->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [1E]: Expected service_role tampered amount 1.00 to fail closed.';
  END IF;

  SELECT COUNT(*) INTO v_row_cnt FROM public.payments WHERE razorpay_payment_id = 'pay_sr_check' OR razorpay_order_id = 'ord_sr_check';
  IF v_row_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [1E]: Tampered service_role call persisted % payment row(s).', v_row_cnt;
  END IF;

  RAISE NOTICE 'PASS [1]: RPC privilege enforcement & zero-write negative checks verified.';
END $$;

-- ==============================================================================
-- TEST 2: CONSULTATION FULFILLMENT (20261116000001)
-- ==============================================================================
DO $$
DECLARE
  v_res JSONB;
  v_bad JSONB;
  v_cnt INTEGER;
  v_inv TEXT;
  v_pay RECORD;
  v_bkg RECORD;
  v_lead_cnt INTEGER;
BEGIN
  -- 2A: Reject 3-decimal amount precision
  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_consultation_payment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'ord_int_con_prec', 'pay_int_con_prec',
    588.824, 'INR',
    '{"customer_name":"Precision Test","customer_email":"prec@example.test","customer_phone":"9999999999","business_name":"Test Co","primary_challenge":"Growth","desired_outcome":"Scale","date":"2026-12-10","time":"11:00 AM"}'::jsonb
  );
  RESET ROLE;

  IF COALESCE((v_bad->>'success')::boolean, true) OR v_bad->>'code' IS DISTINCT FROM 'AMOUNT_MISMATCH' THEN
    RAISE EXCEPTION 'FAILED [2A]: Expected AMOUNT_MISMATCH for 588.824, got %', v_bad;
  END IF;

  -- 2B: Reject NaN amount and non-existent consultation product
  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_consultation_payment(
    NULL, 'ord_int_con_nan', 'pay_int_con_nan', 'NaN'::NUMERIC, 'INR',
    '{"customer_email":"nan@example.test","date":"2026-12-10","time":"11:00 AM"}'::jsonb
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [2B]: Expected NaN rejection, got %', v_bad;
  END IF;

  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_consultation_payment(
    NULL, 'ord_int_con_noprod', 'pay_int_con_noprod', 588.82, 'INR',
    '{"customer_email":"noprod@example.test","date":"2026-12-10","time":"11:00 AM"}'::jsonb,
    '99999999-0000-4000-8000-000000000099'::uuid
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) OR v_bad->>'code' IS DISTINCT FROM 'PRODUCT_NOT_FOUND' THEN
    RAISE EXCEPTION 'FAILED [2B]: Expected PRODUCT_NOT_FOUND for unknown product, got %', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.payments WHERE razorpay_payment_id IN ('pay_int_con_prec', 'pay_int_con_nan', 'pay_int_con_noprod');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [2B]: Rejected consultation calls inserted % payment row(s).', v_cnt;
  END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.bookings WHERE razorpay_order_id IN ('ord_int_con_prec', 'ord_int_con_nan', 'ord_int_con_noprod');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [2B]: Rejected consultation calls inserted % booking row(s).', v_cnt;
  END IF;

  -- 2C: Happy-path GST consultation fulfillment + direct DB table state assertions
  SET LOCAL ROLE service_role;
  v_res := public.fulfill_consultation_payment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'ord_int_con_1', 'pay_int_con_1',
    588.82, 'INR',
    '{"customer_name":"Consult Buyer","customer_email":"buyer.consult@example.test","customer_phone":"9876543210","business_name":"Acme","primary_challenge":"CAC","desired_outcome":"ROAS","date":"2026-12-15","time":"04:00 PM"}'::jsonb
  );
  RESET ROLE;

  IF NOT COALESCE((v_res->>'success')::boolean, false)
     OR COALESCE((v_res->>'already_fulfilled')::boolean, true)
     OR COALESCE((v_res->>'slot_conflict')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [2C]: Consultation fulfillment failed: %', v_res;
  END IF;

  v_inv := v_res #>> '{payment,invoice_number}';
  IF v_inv IS NULL OR v_inv !~ '^DM/' THEN
    RAISE EXCEPTION 'FAILED [2C]: Invalid invoice number prefix returned: %', COALESCE(v_inv, '<null>');
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE razorpay_payment_id = 'pay_int_con_1';
  SELECT * INTO v_bkg FROM public.bookings WHERE payment_id = 'pay_int_con_1';
  SELECT COUNT(*) INTO v_lead_cnt FROM public.crm_leads WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, 'pay_int_con_1') > 0;

  IF v_pay.id IS NULL OR v_pay.status IS DISTINCT FROM 'captured' OR v_pay.amount IS DISTINCT FROM 588.82 OR v_pay.invoice_number IS DISTINCT FROM v_inv THEN
    RAISE EXCEPTION 'FAILED [2C]: DB payment state mismatch: %', pg_catalog.row_to_json(v_pay);
  END IF;
  IF v_bkg.id IS NULL OR v_bkg.status IS DISTINCT FROM 'confirmed' OR v_bkg.base_amount IS DISTINCT FROM 499.00
     OR v_bkg.gst_amount IS DISTINCT FROM 89.82 OR v_bkg.total_amount IS DISTINCT FROM 588.82
     OR v_bkg.invoice_number IS DISTINCT FROM v_inv THEN
    RAISE EXCEPTION 'FAILED [2C]: DB booking state mismatch: %', pg_catalog.row_to_json(v_bkg);
  END IF;
  IF v_lead_cnt <> 1 THEN
    RAISE EXCEPTION 'FAILED [2C]: Expected 1 crm_leads row for pay_int_con_1, found %.', v_lead_cnt;
  END IF;

  -- 2D: Idempotent retry preserves counts
  SET LOCAL ROLE service_role;
  v_res := public.fulfill_consultation_payment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'ord_int_con_1', 'pay_int_con_1',
    588.82, 'INR',
    '{"customer_name":"Consult Buyer","customer_email":"buyer.consult@example.test","customer_phone":"9876543210","business_name":"Acme","primary_challenge":"CAC","desired_outcome":"ROAS","date":"2026-12-15","time":"04:00 PM"}'::jsonb
  );
  RESET ROLE;

  IF NOT COALESCE((v_res->>'success')::boolean, false)
     OR NOT COALESCE((v_res->>'already_fulfilled')::boolean, false) THEN
    RAISE EXCEPTION 'FAILED [2D]: Idempotent retry failed: %', v_res;
  END IF;

  -- 2E: Tampered user_id retry fails closed
  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_consultation_payment(
    'aaaaaaaa-0000-4000-8000-000000000002'::uuid,
    'ord_int_con_1', 'pay_int_con_1',
    588.82, 'INR',
    '{"customer_email":"buyer.consult@example.test","date":"2026-12-15","time":"04:00 PM"}'::jsonb
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [2E]: Tampered retry user_id should fail closed, got %', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.payments WHERE razorpay_payment_id = 'pay_int_con_1';
  SELECT COUNT(*) INTO v_lead_cnt FROM public.crm_leads WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, 'pay_int_con_1') > 0;
  IF v_cnt <> 1 OR v_lead_cnt <> 1 THEN
    RAISE EXCEPTION 'FAILED [2D/2E]: Retry/tamper altered row counts (pay=%, lead=%).', v_cnt, v_lead_cnt;
  END IF;

  -- 2F: Same slot conflict transitions second booking to reschedule_pending
  SET LOCAL ROLE service_role;
  v_res := public.fulfill_consultation_payment(
    'aaaaaaaa-0000-4000-8000-000000000002'::uuid,
    'ord_int_con_2', 'pay_int_con_2',
    588.82, 'INR',
    '{"customer_name":"Second Buyer","customer_email":"second.consult@example.test","customer_phone":"9111111111","business_name":"Beta","primary_challenge":"Scale","desired_outcome":"Leads","date":"2026-12-15","time":"04:00 PM"}'::jsonb
  );
  RESET ROLE;

  IF NOT COALESCE((v_res->>'success')::boolean, false)
     OR NOT COALESCE((v_res->>'slot_conflict')::boolean, false)
     OR (v_res #>> '{booking,status}') IS DISTINCT FROM 'reschedule_pending' THEN
    RAISE EXCEPTION 'FAILED [2F]: Slot conflict failed to transition to reschedule_pending: %', v_res;
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.bookings
   WHERE booking_date = '2026-12-15' AND booking_time = '04:00 PM' AND status = 'reschedule_pending';
  SELECT COUNT(*) INTO v_lead_cnt FROM public.crm_leads
   WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, 'pay_int_con_2') > 0 AND pg_catalog.strpos(notes, 'Slot conflict') > 0;
  IF v_cnt <> 1 OR v_lead_cnt <> 1 THEN
    RAISE EXCEPTION 'FAILED [2F]: DB conflict state invalid (reschedule_pending=%, conflict_lead=%).', v_cnt, v_lead_cnt;
  END IF;

  RAISE NOTICE 'PASS [2]: Consultation RPC integration & DB state tests passed.';
END $$;

-- ==============================================================================
-- TEST 3: COURSE ENROLLMENT FULFILLMENT (20261116000002)
-- ==============================================================================
DO $$
DECLARE
  v_res JSONB;
  v_bad JSONB;
  v_enrolled_count INTEGER;
  v_wishlist_cnt INTEGER;
  v_status TEXT;
  v_enr RECORD;
  v_pay RECORD;
  v_cnt INTEGER;
BEGIN
  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_course_enrollment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    999.00, 'INR', 'ord_int_crs_draft', 'pay_int_crs_draft'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [3A]: Draft course enrollment should be blocked: %', v_bad;
  END IF;

  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_course_enrollment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
    588.824, 'INR', 'ord_int_crs_prec', 'pay_int_crs_prec'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [3B]: 588.824 precision should be rejected: %', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.payments WHERE razorpay_payment_id IN ('pay_int_crs_draft', 'pay_int_crs_prec');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [3A/3B]: Rejected course calls persisted % payment row(s).', v_cnt;
  END IF;

  SET LOCAL ROLE service_role;
  v_res := public.fulfill_course_enrollment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_crs_1', 'pay_int_crs_1'
  );
  RESET ROLE;

  IF NOT COALESCE((v_res->>'success')::boolean, false)
     OR COALESCE((v_res->>'already_fulfilled')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [3C]: Course fulfillment failed: %', v_res;
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE razorpay_payment_id = 'pay_int_crs_1';
  SELECT * INTO v_enr FROM public.course_enrollments
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND course_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT enrolled_count INTO v_enrolled_count FROM public.courses WHERE id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT COUNT(*) INTO v_wishlist_cnt FROM public.student_course_wishlist
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND course_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT COUNT(*) INTO v_cnt FROM public.notifications
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND type = 'enrollment_success';

  IF v_pay.id IS NULL OR v_pay.status IS DISTINCT FROM 'captured' OR v_pay.invoice_number !~ '^DM/'
     OR v_enr.id IS NULL OR v_enr.status IS DISTINCT FROM 'active' OR v_enr.enrollment_id !~ '^DM-ENR-[0-9]+$'
     OR v_enrolled_count <> 1 OR v_wishlist_cnt <> 0 OR v_cnt < 1 THEN
    RAISE EXCEPTION 'FAILED [3C]: DB post-conditions failed (inv=%, enr_id=%, cnt=%, wish=%, notif=%).',
      v_pay.invoice_number, v_enr.enrollment_id, v_enrolled_count, v_wishlist_cnt, v_cnt;
  END IF;

  -- Replay heals missing enrollment
  DELETE FROM public.course_enrollments
  WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    AND course_id = 'bbbbbbbb-0000-4000-8000-000000000001';

  SET LOCAL ROLE service_role;
  v_res := public.fulfill_course_enrollment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_crs_1', 'pay_int_crs_1'
  );
  RESET ROLE;

  SELECT status INTO v_status FROM public.course_enrollments
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND course_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  SELECT COUNT(*) INTO v_cnt FROM public.payments WHERE razorpay_payment_id = 'pay_int_crs_1';
  IF NOT COALESCE((v_res->>'success')::boolean, false) OR v_status IS DISTINCT FROM 'active' OR v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAILED [3D]: Course enrollment recovery failed (res=%, status=%, pay_cnt=%).', v_res, v_status, v_cnt;
  END IF;

  UPDATE public.course_enrollments SET status = 'revoked'
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND course_id = 'bbbbbbbb-0000-4000-8000-000000000001';

  SET LOCAL ROLE service_role;
  v_res := public.fulfill_course_enrollment(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_crs_1', 'pay_int_crs_1'
  );
  RESET ROLE;

  SELECT status INTO v_status FROM public.course_enrollments
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND course_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'FAILED [3D]: Revoked enrollment failed to reactivate on replay.';
  END IF;

  RAISE NOTICE 'PASS [3]: Course enrollment RPC & DB state integration tests passed.';
END $$;

-- ==============================================================================
-- TEST 4: RESOURCE PURCHASE FULFILLMENT (20261116000003)
-- ==============================================================================
DO $$
DECLARE
  v_res JSONB;
  v_bad JSONB;
  v_active_cnt INTEGER;
  v_total_cnt INTEGER;
  v_pay RECORD;
  v_pur RECORD;
  v_cnt INTEGER;
BEGIN
  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_resource_purchase(
    NULL, 'cccccccc-0000-4000-8000-000000000001'::uuid,
    588.824, 'INR', 'ord_int_res_prec', 'pay_int_res_prec',
    'Guest Prec', 'guest.prec@example.test', '9999999999', 'CI Paid Bundle'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [4A]: 588.824 precision should be rejected: %', v_bad;
  END IF;

  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_resource_purchase(
    NULL, 'cccccccc-0000-4000-8000-000000000002'::uuid,
    588.82, 'INR', 'ord_int_res_free', 'pay_int_res_free'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [4A]: Free resource fulfillment should be rejected: %', v_bad;
  END IF;

  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_resource_purchase(
    NULL, 'cccccccc-0000-4000-8000-000000000003'::uuid,
    299.00, 'INR', 'ord_int_res_draft', 'pay_int_res_draft'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [4A]: Draft resource fulfillment should be rejected: %', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.payments
   WHERE razorpay_payment_id IN ('pay_int_res_prec', 'pay_int_res_free', 'pay_int_res_draft');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [4A]: Rejected resource calls inserted % payment row(s).', v_cnt;
  END IF;

  -- 4B: Guest purchase + direct DB verification
  SET LOCAL ROLE service_role;
  v_res := public.fulfill_resource_purchase(
    NULL, 'cccccccc-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_res_guest', 'pay_int_res_guest',
    'Guest Buyer', 'guest.res@example.test', '9888888888', 'CI Paid Bundle'
  );
  RESET ROLE;
  IF NOT COALESCE((v_res->>'success')::boolean, false) OR (v_res #>> '{purchase,user_id}') IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED [4B]: Guest resource purchase failed: %', v_res;
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE razorpay_payment_id = 'pay_int_res_guest';
  SELECT * INTO v_pur FROM public.resource_purchases WHERE razorpay_payment_id = 'pay_int_res_guest';
  SELECT COUNT(*) INTO v_cnt FROM public.crm_leads WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, 'pay_int_res_guest') > 0;
  IF v_pay.id IS NULL OR v_pay.user_id IS NOT NULL OR v_pay.invoice_number !~ '^DM/'
     OR v_pur.id IS NULL OR v_pur.user_id IS NOT NULL OR v_pur.status IS DISTINCT FROM 'active' OR v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAILED [4B]: Guest DB persistence invalid (pay_inv=%, pur_status=%, lead=%).',
      v_pay.invoice_number, v_pur.status, v_cnt;
  END IF;

  -- 4C: Authenticated purchase & duplicate block
  SET LOCAL ROLE service_role;
  v_res := public.fulfill_resource_purchase(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'cccccccc-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_res_auth_1', 'pay_int_res_auth_1',
    'CI Student One', 'ci.student1@example.test', '9777777777', 'CI Paid Bundle'
  );
  RESET ROLE;
  IF NOT COALESCE((v_res->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAILED [4C]: Auth resource purchase failed: %', v_res;
  END IF;

  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_resource_purchase(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'cccccccc-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_res_auth_dup', 'pay_int_res_auth_dup',
    'CI Student One', 'ci.student1@example.test', '9777777777', 'CI Paid Bundle'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [4C]: Duplicate active resource purchase should fail closed: %', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.payments WHERE razorpay_payment_id = 'pay_int_res_auth_dup';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [4C]: Blocked duplicate purchase inserted payment row.';
  END IF;

  -- 4D: Revoked replay rejected; repurchase under new order allowed
  UPDATE public.resource_purchases SET status = 'revoked'
  WHERE razorpay_payment_id = 'pay_int_res_auth_1';

  SET LOCAL ROLE service_role;
  v_bad := public.fulfill_resource_purchase(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'cccccccc-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_res_auth_1', 'pay_int_res_auth_1',
    'CI Student One', 'ci.student1@example.test', '9777777777', 'CI Paid Bundle'
  );
  RESET ROLE;
  IF COALESCE((v_bad->>'success')::boolean, true) THEN
    RAISE EXCEPTION 'FAILED [4D-i]: Replaying revoked resource purchase must fail closed: %', v_bad;
  END IF;

  SET LOCAL ROLE service_role;
  v_res := public.fulfill_resource_purchase(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'cccccccc-0000-4000-8000-000000000001'::uuid,
    588.82, 'INR', 'ord_int_res_auth_2', 'pay_int_res_auth_2',
    'CI Student One', 'ci.student1@example.test', '9777777777', 'CI Paid Bundle'
  );
  RESET ROLE;
  IF NOT COALESCE((v_res->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAILED [4D-ii]: Repurchase after revocation failed: %', v_res;
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'active'), COUNT(*)
  INTO v_active_cnt, v_total_cnt
  FROM public.resource_purchases
  WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    AND resource_id = 'cccccccc-0000-4000-8000-000000000001';

  IF v_active_cnt <> 1 OR v_total_cnt <> 2 THEN
    RAISE EXCEPTION 'FAILED [4D]: Expected 1 active + 1 revoked purchase row (active=%, total=%).', v_active_cnt, v_total_cnt;
  END IF;

  RAISE NOTICE 'PASS [4]: Resource purchase RPC & DB state integration tests passed.';
END $$;

-- ==============================================================================
-- TEST 5: CREDIT NOTES & INVOICE TRIGGERS (20261107000001/02)
-- Tests 5A, 5D, and 5F NEVER wrap their own assertions in EXCEPTION handlers.
-- ==============================================================================
DO $$
DECLARE
  v_cn RECORD;
  v_pay RECORD;
  v_rejected_3dec BOOLEAN;
  v_rejected_over BOOLEAN;
  v_rejected_auth_pay BOOLEAN;
  v_err_state TEXT;
  v_err_msg TEXT;
  v_cn_cnt INTEGER;
  v_cn_sum NUMERIC;
BEGIN
  -- 5A: Must reject 3-decimal refund amount (588.824) with P0001 before any write
  v_rejected_3dec := false;
  v_err_state := NULL;
  v_err_msg := NULL;
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(
      'pay_int_crs_1', 'rfnd_int_prec_bad', 588.824, 'Bad 3-decimal test',
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'INR'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected_3dec := true;
  END;
  RESET ROLE;

  IF NOT v_rejected_3dec
     OR v_err_state IS DISTINCT FROM 'P0001'
     OR COALESCE(v_err_msg, '') NOT ILIKE '%Invalid refund amount%at most two decimal places%' THEN
    RAISE EXCEPTION 'FAILED [5A]: Expected P0001 Invalid refund amount rejection for 588.824 (rejected=%, state=%, msg=%).',
      v_rejected_3dec, COALESCE(v_err_state, '<none>'), COALESCE(v_err_msg, '<none>');
  END IF;

  SELECT COUNT(*) INTO v_cn_cnt FROM public.credit_notes WHERE refund_id = 'rfnd_int_prec_bad';
  IF v_cn_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [5A]: Invalid 3-decimal refund inserted % credit_notes row(s).', v_cn_cnt;
  END IF;

  -- 5B: Partial refund (200.00 of 588.82)
  SET LOCAL ROLE service_role;
  SELECT * INTO v_cn FROM public.record_credit_note_with_limit(
    'pay_int_crs_1', 'rfnd_int_1', 200.00, 'Partial CI refund',
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'INR', '2026-06-15T10:00:00Z'
  );
  RESET ROLE;

  SELECT * INTO v_pay FROM public.payments WHERE razorpay_payment_id = 'pay_int_crs_1';
  IF NOT v_cn.is_partial
     OR v_cn.is_idempotent_duplicate
     OR v_cn.remaining_balance <> 388.82
     OR v_cn.credit_note_number !~ '^CN/'
     OR v_pay.status IS DISTINCT FROM 'captured' THEN
    RAISE EXCEPTION 'FAILED [5B]: Unexpected partial refund or payment state: cn=%, pay_status=%', v_cn, v_pay.status;
  END IF;

  -- 5C: Idempotent retry returns same credit note with identical remaining_balance
  SET LOCAL ROLE service_role;
  SELECT * INTO v_cn FROM public.record_credit_note_with_limit(
    'pay_int_crs_1', 'rfnd_int_1', 200.00, 'Partial CI refund',
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'INR', '2026-06-15T10:00:00Z'
  );
  RESET ROLE;

  SELECT COUNT(*) INTO v_cn_cnt FROM public.credit_notes WHERE payment_id = 'pay_int_crs_1';
  IF NOT v_cn.is_idempotent_duplicate OR v_cn.remaining_balance <> 388.82 OR v_cn_cnt <> 1 THEN
    RAISE EXCEPTION 'FAILED [5C]: Idempotent duplicate check failed (cn=%, cnt=%).', v_cn, v_cn_cnt;
  END IF;

  -- 5D: Must reject over-limit refund (388.83 vs 388.82 remaining) with P0001
  v_rejected_over := false;
  v_err_state := NULL;
  v_err_msg := NULL;
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit(
      'pay_int_crs_1', 'rfnd_int_over', 388.83, 'Over refund',
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'INR'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected_over := true;
  END;
  RESET ROLE;

  IF NOT v_rejected_over
     OR v_err_state IS DISTINCT FROM 'P0001'
     OR COALESCE(v_err_msg, '') NOT ILIKE '%exceeds remaining eligible refundable balance%' THEN
    RAISE EXCEPTION 'FAILED [5D]: Expected P0001 remaining balance rejection for 388.83 (rejected=%, state=%, msg=%).',
      v_rejected_over, COALESCE(v_err_state, '<none>'), COALESCE(v_err_msg, '<none>');
  END IF;

  SELECT COUNT(*) INTO v_cn_cnt FROM public.credit_notes WHERE payment_id = 'pay_int_crs_1';
  SELECT * INTO v_pay FROM public.payments WHERE razorpay_payment_id = 'pay_int_crs_1';
  IF v_cn_cnt <> 1 OR v_pay.status IS DISTINCT FROM 'captured' THEN
    RAISE EXCEPTION 'FAILED [5D]: Over-limit refund mutated DB state (cn_cnt=%, pay_status=%).', v_cn_cnt, v_pay.status;
  END IF;

  -- 5E: Final partial refund transitions payment to refunded while preserving original invoice_number
  SET LOCAL ROLE service_role;
  SELECT * INTO v_cn FROM public.record_credit_note_with_limit(
    'pay_int_crs_1', 'rfnd_int_2', 388.82, 'Final refund',
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'INR', '2026-06-16T10:00:00Z'
  );
  RESET ROLE;

  SELECT * INTO v_pay FROM public.payments WHERE razorpay_payment_id = 'pay_int_crs_1';
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_cn_cnt, v_cn_sum
  FROM public.credit_notes WHERE payment_id = 'pay_int_crs_1';

  IF v_cn.is_partial
     OR v_cn.remaining_balance <> 0.00
     OR v_pay.status IS DISTINCT FROM 'refunded'
     OR v_pay.invoice_number !~ '^DM/'
     OR v_pay.credit_note_number !~ '^CN/'
     OR v_cn_cnt <> 2
     OR v_cn_sum IS DISTINCT FROM 588.82 THEN
    RAISE EXCEPTION 'FAILED [5E]: Final refund state invalid (partial=%, rem=%, status=%, inv=%, cn=%, cnt=%, sum=%).',
      v_cn.is_partial, v_cn.remaining_balance, v_pay.status, v_pay.invoice_number, v_pay.credit_note_number, v_cn_cnt, v_cn_sum;
  END IF;

  -- 5F: Direct INSERT into public.payments as authenticated role must fail (privilege/trigger defense)
  v_rejected_auth_pay := false;
  v_err_state := NULL;
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.payments (
      user_id, item_type, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status
    ) VALUES (
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'course', 'Forged Payment', 588.82, 'INR', 'ord_forged_auth', 'pay_forged_auth', 'captured'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_rejected_auth_pay := true;
  END;
  RESET ROLE;

  SELECT COUNT(*) INTO v_cn_cnt FROM public.payments WHERE razorpay_payment_id = 'pay_forged_auth';
  IF NOT v_rejected_auth_pay OR v_err_state NOT IN ('42501', 'P0001') OR v_cn_cnt <> 0 THEN
    RAISE EXCEPTION 'FAILED [5F]: authenticated direct insert into payments was not blocked (rejected=%, state=%, cnt=%).',
      v_rejected_auth_pay, COALESCE(v_err_state, '<none>'), v_cn_cnt;
  END IF;

  RAISE NOTICE 'PASS [5]: Credit-note & invoice trigger integration tests passed.';
END $$;
