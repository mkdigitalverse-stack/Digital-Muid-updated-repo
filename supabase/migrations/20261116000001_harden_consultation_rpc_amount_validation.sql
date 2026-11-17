-- ==============================================================================
-- DIGITAL MUID — P0-2 / P1 HARDENED CONSULTATION FULFILLMENT MIGRATION
-- Migration: 20261116000001_harden_consultation_rpc_amount_validation.sql
-- ==============================================================================
-- STATUS: DEPLOYMENT PROPOSAL ONLY (NOT EXECUTED IN DATABASE)
--
-- DEPENDENCIES & PRE-CONDITIONS:
--   1. Requires baseline tables public.bookings, public.payments,
--      public.consultation_products, and public.crm_leads to exist prior to replay.
--      (Note: Historical migrations 20260826..20261107 alter public.bookings without
--      containing CREATE TABLE public.bookings; apply baseline schema first.)
--   2. Acquires AccessExclusiveLock during ALTER TABLE / index reconciliation on
--      public.bookings and public.payments; deploy during a write-freeze window.
--
-- SUMMARY OF CORRECTIONS & HARDENING:
--   1. Valid PostgreSQL syntax (no schema-qualified special forms COALESCE / NULLIF;
--      uses pg_catalog.btrim(..., E' \t\n\r\f\v') rather than invalid pg_catalog.trim).
--   2. Fail-closed schema compatibility preflight for bookings, payments,
--      consultation_products, and crm_leads (halting on missing tables/columns or
--      unpopulated NOT NULL columns without defaults).
--   3. Reconciles public.bookings (id default, user_id, invoice_number, meeting_link,
--      chk_bookings_status allowing 'reschedule_pending') and public.payments (guest
--      NULL user_id).
--   4. Preflights duplicate payment_id / razorpay_order_id rows and inspects pg_index
--      to replace invalid/mismatched idx_bookings_payment_id / idx_bookings_razorpay_order_id.
--   5. Rewrites public.fulfill_consultation_payment cleanly:
--      - Splits payment & booking lookups by razorpay_payment_id and razorpay_order_id
--        with FOR UPDATE row-locking & multi-row detection (zero OR ambiguity).
--      - Enforces strict NULL / NaN / <=0 / overflow / exact 2-decimal scale checks
--        and symmetric ownership & invariant checks across Step 4 and ALL
--        unique_violation recovery branches (Cases B, C, D).
--      - Propagates payment trigger-minted invoice_number and syncs crm_leads
--        atomically (UUID or TEXT id, status 'New', strpos deduplication).
--
-- ROLLBACK & IRREVERSIBILITY NOTES:
--   - Code rollback: Re-execute 20261028000001 ONLY if database uses legacy
--     meet_url/payment_status/calendar_event_id columns; otherwise restore prior
--     function definition from backup.
--   - Irreversible changes once committed: ALTER COLUMN payments.user_id DROP NOT NULL,
--     dropped legacy status constraint, lowercased/trimmed bookings.status rows, and
--     rebuilt unique partial indexes cannot be reverted by simply dropping the RPC.
--     Take and verify a pg_dump backup before applying.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. FAIL-CLOSED SCHEMA COMPATIBILITY PREFLIGHT
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[];
  v_bad_col RECORD;
BEGIN
  SELECT pg_catalog.array_agg(tbl)
  INTO v_missing
  FROM (VALUES ('bookings'), ('payments'), ('consultation_products'), ('crm_leads')) AS req(tbl)
  WHERE pg_catalog.to_regclass('public.' || req.tbl) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration halt: Missing required baseline table(s) in public schema: %. Apply baseline schema before running this migration.',
      pg_catalog.array_to_string(v_missing, ', ');
  END IF;

  -- Verify public.bookings has no NOT NULL column without default that this RPC does not populate
  FOR v_bad_col IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'bookings'
      AND c.is_nullable = 'NO'
      AND c.column_default IS NULL
      AND c.column_name NOT IN (
        'id', 'booking_code', 'customer_name', 'customer_email', 'customer_phone',
        'business_name', 'primary_challenge', 'desired_outcome', 'booking_date',
        'booking_time', 'duration_minutes', 'base_amount', 'gst_rate', 'gst_amount',
        'total_amount', 'currency', 'status', 'created_at', 'updated_at'
      )
  LOOP
    RAISE EXCEPTION 'Compatibility failure: public.bookings.% is NOT NULL with no DEFAULT and is not populated by fulfill_consultation_payment. Reconcile baseline schema first.',
      v_bad_col.column_name;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 1. PRE-DDL SCHEMA RECONCILIATION (BOOKINGS & PAYMENTS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.payments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.bookings
  ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid()::text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Safely reconcile bookings.status CHECK constraint to allow 'reschedule_pending'
DO $$
DECLARE
  v_bookings_oid OID := 'public.bookings'::regclass;
  v_status_attnum SMALLINT;
  v_con RECORD;
  v_bad_status_count INTEGER;
BEGIN
  SELECT a.attnum INTO v_status_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_bookings_oid
    AND a.attname = 'status'
    AND NOT a.attisdropped;

  IF v_status_attnum IS NULL THEN
    RAISE EXCEPTION 'Compatibility failure: public.bookings.status column not found.';
  END IF;

  UPDATE public.bookings
  SET status = pg_catalog.lower(pg_catalog.btrim(status, E' \t\n\r\f\v'))
  WHERE status IS NOT NULL
    AND status IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(status, E' \t\n\r\f\v'));

  SELECT COUNT(*) INTO v_bad_status_count
  FROM public.bookings
  WHERE status IS NULL
     OR status NOT IN ('confirmed', 'rescheduled', 'cancelled', 'completed', 'reschedule_pending');

  IF v_bad_status_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % public.bookings row(s) with unrecognized status outside supported enum.', v_bad_status_count;
  END IF;

  FOR v_con IN
    SELECT c.conname, pg_catalog.pg_get_constraintdef(c.oid) AS def, c.conkey
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_bookings_oid
      AND c.contype = 'c'
  LOOP
    IF v_con.conname IN ('bookings_status_check', 'chk_bookings_status')
       AND v_con.conkey = ARRAY[v_status_attnum] THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    ELSIF v_con.conkey = ARRAY[v_status_attnum]
       AND v_con.def ~* '^\s*CHECK\s*\(\s*\(*\s*status(\)::text)?\s*(?:IN\s*\(|=\s*ANY\s*\()' THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    ELSIF v_status_attnum = ANY(COALESCE(v_con.conkey, ARRAY[]::SMALLINT[])) THEN
      RAISE EXCEPTION 'Migration halt: Unapproved CHECK constraint % (%) references public.bookings.status.',
        v_con.conname, v_con.def;
    END IF;
  END LOOP;

  ALTER TABLE public.bookings
    ADD CONSTRAINT chk_bookings_status
    CHECK (status IN ('confirmed', 'rescheduled', 'cancelled', 'completed', 'reschedule_pending'));
END $$;

-- ------------------------------------------------------------------------------
-- 2. DUPLICATE PREFLIGHT & RECONCILED PARTIAL UNIQUE INDEXES ON BOOKINGS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_dup_count INTEGER;
  v_spec RECORD;
  v_attnum SMALLINT;
  v_idx RECORD;
  v_pred_regex TEXT;
  v_ws_pattern TEXT :=
    ' (?:' || pg_catalog.chr(9)  || '|\\t|\\x09|\\011)'
    || '(?:' || pg_catalog.chr(10) || '|\\n|\\x0a|\\012)'
    || '(?:' || pg_catalog.chr(13) || '|\\r|\\x0d|\\015)'
    || '(?:' || pg_catalog.chr(12) || '|\\f|\\x0c|\\014)'
    || '(?:' || pg_catalog.chr(11) || '|\\v|\\x0b|\\013)';
BEGIN
  -- Trim non-null whitespace on payment_id / razorpay_order_id only where needed
  UPDATE public.bookings
  SET payment_id = NULLIF(pg_catalog.btrim(payment_id, E' \t\n\r\f\v'), '')
  WHERE payment_id IS NOT NULL
    AND payment_id IS DISTINCT FROM NULLIF(pg_catalog.btrim(payment_id, E' \t\n\r\f\v'), '');

  UPDATE public.bookings
  SET razorpay_order_id = NULLIF(pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v'), '')
  WHERE razorpay_order_id IS NOT NULL
    AND razorpay_order_id IS DISTINCT FROM NULLIF(pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v'), '');

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT pg_catalog.btrim(payment_id, E' \t\n\r\f\v')
    FROM public.bookings
    WHERE payment_id IS NOT NULL AND pg_catalog.btrim(payment_id, E' \t\n\r\f\v') <> ''
    GROUP BY pg_catalog.btrim(payment_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) dup_pay;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % duplicate payment_id value(s) in public.bookings before creating idx_bookings_payment_id.', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v')
    FROM public.bookings
    WHERE razorpay_order_id IS NOT NULL AND pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v') <> ''
    GROUP BY pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) dup_ord;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % duplicate razorpay_order_id value(s) in public.bookings before creating idx_bookings_razorpay_order_id.', v_dup_count;
  END IF;

  -- Inspect pg_index so IF NOT EXISTS never preserves an invalid or mismatched prior index
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('idx_bookings_payment_id',        'payment_id'),
      ('idx_bookings_razorpay_order_id', 'razorpay_order_id')
    ) AS s(idx_name, col_name)
  LOOP
    SELECT a.attnum INTO v_attnum
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class tbl ON tbl.oid = a.attrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'bookings'
      AND a.attname = v_spec.col_name
      AND NOT a.attisdropped;

    IF v_attnum IS NULL THEN
      RAISE EXCEPTION 'Compatibility failure: public.bookings.% column not found.', v_spec.col_name;
    END IF;

    SELECT
      nt.nspname AS table_schema,
      t.relname AS table_name,
      i.indisunique,
      i.indisvalid,
      i.indisready,
      i.indkey,
      i.indexprs,
      i.indpred,
      pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS pred_expr
    INTO v_idx
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
    JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
    WHERE nc.nspname = 'public'
      AND c.relname = v_spec.idx_name;

    IF FOUND THEN
      v_pred_regex :=
        '^\s*\(*\s*' || v_spec.col_name || '\s+IS\s+NOT\s+NULL\s*\)*\s+AND\s+\(*\s*(?:pg_catalog\.)?btrim\(\s*\(*\s*'
        || v_spec.col_name
        || '(?:\)*(?:::text)?)\s*,\s*E?''' || v_ws_pattern || '''(?:::text)?\s*\)(?:::text)?\s*(?:<>|!=)\s*''''(?:::text)?\s*\)*\s*$';

      IF v_idx.table_schema IS DISTINCT FROM 'public'
         OR v_idx.table_name IS DISTINCT FROM 'bookings'
         OR v_idx.indisunique IS DISTINCT FROM TRUE
         OR v_idx.indisvalid IS DISTINCT FROM TRUE
         OR v_idx.indisready IS DISTINCT FROM TRUE
         OR v_idx.indexprs IS NOT NULL
         OR ARRAY(
              SELECT u.attnum
              FROM pg_catalog.unnest(v_idx.indkey::SMALLINT[])
                   WITH ORDINALITY AS u(attnum, ord)
              ORDER BY u.ord
            ) IS DISTINCT FROM ARRAY[v_attnum]
         OR v_idx.indpred IS NULL
         OR v_idx.pred_expr IS NULL
         OR v_idx.pred_expr !~* v_pred_regex THEN
        EXECUTE pg_catalog.format('DROP INDEX IF EXISTS public.%I', v_spec.idx_name);
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_id
  ON public.bookings (payment_id)
  WHERE payment_id IS NOT NULL AND pg_catalog.btrim(payment_id, E' \t\n\r\f\v') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id
  ON public.bookings (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL AND pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v') <> '';

-- ------------------------------------------------------------------------------
-- 3. HARDENED ATOMIC CONSULTATION FULFILLMENT RPC
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
  v_user_exists BOOLEAN := false;
  v_target_product_id UUID;
  v_product public.consultation_products%ROWTYPE;
  v_base_price NUMERIC(10,2);
  v_gst_rate NUMERIC(4,2);
  v_gst_amount NUMERIC(10,2);
  v_expected_total NUMERIC(10,2);
  v_raw_total NUMERIC;

  v_rec RECORD;
  v_pay_by_pay public.payments%ROWTYPE;
  v_pay_by_ord public.payments%ROWTYPE;
  v_pay_by_pay_cnt INTEGER := 0;
  v_pay_by_ord_cnt INTEGER := 0;
  v_bkg_by_pay public.bookings%ROWTYPE;
  v_bkg_by_ord public.bookings%ROWTYPE;
  v_bkg_by_pay_cnt INTEGER := 0;
  v_bkg_by_ord_cnt INTEGER := 0;

  v_existing_payment public.payments%ROWTYPE;
  v_existing_booking public.bookings%ROWTYPE;
  v_has_payment BOOLEAN := false;
  v_has_booking BOOLEAN := false;

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
  v_meeting_link TEXT;
  v_duration_minutes INTEGER;

  v_existing_lead_id TEXT;
  v_crm_id_type TEXT;
  v_crm_lead_uuid UUID;
  v_crm_lead_text TEXT;
  v_lead_status TEXT := 'skipped';

  v_attempt INTEGER;
  v_diag_constraint TEXT;
  v_diag_message TEXT;
BEGIN
  -- 1. Input sanitization & boundary checks
  v_clean_order_id := pg_catalog.btrim(COALESCE(p_order_id, ''), E' \t\n\r\f\v');
  v_clean_payment_id := pg_catalog.btrim(COALESCE(p_payment_id, ''), E' \t\n\r\f\v');

  IF pg_catalog.length(v_clean_order_id) = 0 OR pg_catalog.length(v_clean_payment_id) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_PARAMETERS',
      'error', 'Both order_id and payment_id are required for verified consultation fulfillment.'
    );
  END IF;

  IF p_currency IS NULL OR pg_catalog.btrim(p_currency, E' \t\n\r\f\v') = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_CURRENCY',
      'error', 'Currency is mandatory and must not be empty.'
    );
  END IF;

  v_currency := pg_catalog.upper(pg_catalog.btrim(p_currency, E' \t\n\r\f\v'));
  IF v_currency IS DISTINCT FROM 'INR' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_CURRENCY',
      'error', 'Invalid currency. Consultation payments must be denominated in INR.'
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'INVALID_USER_ID',
        'error', 'Specified user_id does not exist in auth.users.'
      );
    END IF;
  END IF;

  -- 2. Extract and validate intake brief parameters
  v_customer_name := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_booking_details->>'customer_name', p_booking_details->>'customerName', ''), E' \t\n\r\f\v'), ''),
    'Valued Client'
  );
  v_customer_email := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_booking_details->>'customer_email', p_booking_details->>'customerEmail', ''), E' \t\n\r\f\v'));
  v_customer_phone := pg_catalog.substr(pg_catalog.btrim(COALESCE(p_booking_details->>'customer_phone', p_booking_details->>'customerPhone', ''), E' \t\n\r\f\v'), 1, 30);
  v_business_name := pg_catalog.btrim(COALESCE(p_booking_details->>'business_name', p_booking_details->>'businessName', ''), E' \t\n\r\f\v');
  v_primary_challenge := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_booking_details->>'primary_challenge', p_booking_details->>'primaryChallenge', ''), E' \t\n\r\f\v'), ''),
    'Business Growth Strategy'
  );
  v_desired_outcome := pg_catalog.btrim(COALESCE(p_booking_details->>'desired_outcome', p_booking_details->>'desiredOutcome', ''), E' \t\n\r\f\v');
  v_website := NULLIF(pg_catalog.btrim(COALESCE(p_booking_details->>'website', ''), E' \t\n\r\f\v'), '');
  v_linkedin := NULLIF(pg_catalog.btrim(COALESCE(p_booking_details->>'linkedin', ''), E' \t\n\r\f\v'), '');

  BEGIN
    v_booking_date := (p_booking_details->>'date')::date;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_booking_date := (p_booking_details->>'booking_date')::date;
    EXCEPTION WHEN OTHERS THEN
      v_booking_date := NULL;
    END;
  END;

  v_booking_time := pg_catalog.substr(pg_catalog.btrim(COALESCE(p_booking_details->>'time', p_booking_details->>'booking_time', ''), E' \t\n\r\f\v'), 1, 20);

  IF v_customer_email = '' OR v_booking_date IS NULL OR v_booking_time = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_BOOKING_DETAILS',
      'error', 'Missing required intake brief data: customer_email, date, and time slot are mandatory.'
    );
  END IF;

  -- Serialize concurrent transactions on payment, order, and slot
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_consult_pay:' || v_clean_payment_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_consult_ord:' || v_clean_order_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_consult_slot:' || v_booking_date::text || ':' || v_booking_time, 0));

  -- 3. Authoritative catalog product & pricing validation (fail closed, FOR SHARE)
  v_target_product_id := COALESCE(p_product_id, '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid);

  SELECT * INTO v_product
  FROM public.consultation_products
  WHERE id = v_target_product_id
    AND active = true
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'PRODUCT_NOT_FOUND',
      'error', 'Specified consultation product (' || v_target_product_id::text || ') is inactive or not found. Fulfillment rejected.'
    );
  END IF;

  IF v_product.base_price IS NULL
     OR v_product.base_price = 'NaN'::NUMERIC
     OR v_product.base_price <= 0
     OR v_product.base_price > 99999999.99
     OR pg_catalog.round(v_product.base_price, 2) IS DISTINCT FROM v_product.base_price THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_PRODUCT_PRICING',
      'error', 'Consultation product has missing, NaN, overflow, >2-decimal, or non-positive base price. Fulfillment rejected.'
    );
  END IF;

  IF pg_catalog.upper(pg_catalog.btrim(COALESCE(v_product.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_PRODUCT_PRICING',
      'error', 'Consultation product currency must be INR. Fulfillment rejected.'
    );
  END IF;

  v_gst_rate := COALESCE(v_product.gst_rate, 0.18);
  IF v_gst_rate = 'NaN'::NUMERIC
     OR v_gst_rate < 0
     OR v_gst_rate > 1
     OR pg_catalog.round(v_gst_rate, 2) IS DISTINCT FROM v_gst_rate THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_PRODUCT_PRICING',
      'error', 'Consultation product has invalid GST rate. Fulfillment rejected.'
    );
  END IF;

  v_base_price := pg_catalog.round(v_product.base_price, 2)::NUMERIC(10,2);
  v_gst_amount := pg_catalog.round(v_base_price * v_gst_rate, 2)::NUMERIC(10,2);
  v_raw_total := pg_catalog.round(v_base_price + v_gst_amount, 2);
  IF v_raw_total IS NULL OR v_raw_total <= 0 OR v_raw_total > 99999999.99 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_PRODUCT_PRICING',
      'error', 'Consultation total overflows NUMERIC(10,2).'
    );
  END IF;
  v_expected_total := v_raw_total::NUMERIC(10,2);
  v_duration_minutes := COALESCE(v_product.duration_minutes, 30);

  -- Strict incoming numeric check: reject NULL, NaN, <=0, overflow, >2 decimal scale, or mismatch
  IF p_amount IS NULL
     OR p_amount = 'NaN'::NUMERIC
     OR p_amount <= 0
     OR p_amount > 99999999.99
     OR pg_catalog.round(p_amount, 2) IS DISTINCT FROM p_amount
     OR p_amount IS DISTINCT FROM v_expected_total THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'AMOUNT_MISMATCH',
      'error', 'Amount mismatch: payment amount (' || COALESCE(p_amount::text, 'NULL') || ') does not equal authoritative price (' || v_expected_total::text || ').'
    );
  END IF;

  -- 4. Lock & inspect existing payment and booking rows separately (no OR ambiguity)
  FOR v_rec IN
    SELECT *
    FROM public.payments
    WHERE razorpay_payment_id = v_clean_payment_id
    FOR UPDATE
  LOOP
    v_pay_by_pay_cnt := v_pay_by_pay_cnt + 1;
    IF v_pay_by_pay_cnt = 1 THEN
      v_pay_by_pay := v_rec;
    END IF;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM public.payments
    WHERE razorpay_order_id = v_clean_order_id
    FOR UPDATE
  LOOP
    v_pay_by_ord_cnt := v_pay_by_ord_cnt + 1;
    IF v_pay_by_ord_cnt = 1 THEN
      v_pay_by_ord := v_rec;
    END IF;
  END LOOP;

  IF v_pay_by_pay_cnt > 1 OR v_pay_by_ord_cnt > 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Multiple payment ledger rows matched payment_id or order_id.'
    );
  END IF;

  IF v_pay_by_pay.id IS NOT NULL AND v_pay_by_ord.id IS NOT NULL AND v_pay_by_pay.id IS DISTINCT FROM v_pay_by_ord.id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Payment ID and Order ID resolve to different payment ledger rows.'
    );
  END IF;

  IF v_pay_by_ord.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_pay_by_ord.razorpay_payment_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_payment_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing payment ledger record for this order_id is bound to a different payment_id.'
    );
  END IF;

  IF v_pay_by_pay.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_pay_by_pay.razorpay_order_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_order_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing payment ledger record for this payment_id is bound to a different order_id.'
    );
  END IF;

  IF v_pay_by_pay.id IS NOT NULL THEN
    v_existing_payment := v_pay_by_pay;
    v_has_payment := true;
  ELSIF v_pay_by_ord.id IS NOT NULL THEN
    v_existing_payment := v_pay_by_ord;
    v_has_payment := true;
  END IF;

  FOR v_rec IN
    SELECT *
    FROM public.bookings
    WHERE payment_id = v_clean_payment_id
    FOR UPDATE
  LOOP
    v_bkg_by_pay_cnt := v_bkg_by_pay_cnt + 1;
    IF v_bkg_by_pay_cnt = 1 THEN
      v_bkg_by_pay := v_rec;
    END IF;
  END LOOP;

  FOR v_rec IN
    SELECT *
    FROM public.bookings
    WHERE razorpay_order_id = v_clean_order_id
    FOR UPDATE
  LOOP
    v_bkg_by_ord_cnt := v_bkg_by_ord_cnt + 1;
    IF v_bkg_by_ord_cnt = 1 THEN
      v_bkg_by_ord := v_rec;
    END IF;
  END LOOP;

  IF v_bkg_by_pay_cnt > 1 OR v_bkg_by_ord_cnt > 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Multiple booking rows matched payment_id or order_id.'
    );
  END IF;

  IF v_bkg_by_pay.id IS NOT NULL AND v_bkg_by_ord.id IS NOT NULL AND v_bkg_by_pay.id IS DISTINCT FROM v_bkg_by_ord.id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Payment ID and Order ID resolve to different booking rows.'
    );
  END IF;

  IF v_bkg_by_ord.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_bkg_by_ord.payment_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_payment_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing booking record for this order_id is bound to a different payment_id.'
    );
  END IF;

  IF v_bkg_by_pay.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_bkg_by_pay.razorpay_order_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_order_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing booking record for this payment_id is bound to a different order_id.'
    );
  END IF;

  IF v_bkg_by_pay.id IS NOT NULL THEN
    v_existing_booking := v_bkg_by_pay;
    v_has_booking := true;
  ELSIF v_bkg_by_ord.id IS NOT NULL THEN
    v_existing_booking := v_bkg_by_ord;
    v_has_booking := true;
  END IF;

  -- Strict symmetric invariant & scale validation for existing payment
  IF v_has_payment THEN
    IF v_existing_payment.razorpay_order_id IS DISTINCT FROM v_clean_order_id
       OR v_existing_payment.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.item_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'consultation'
       OR NULLIF(pg_catalog.btrim(COALESCE(v_existing_payment.item_id::text, ''), E' \t\n\r\f\v'), '') IS DISTINCT FROM v_target_product_id::text
       OR v_existing_payment.amount IS NULL
       OR v_existing_payment.amount = 'NaN'::NUMERIC
       OR pg_catalog.round(v_existing_payment.amount, 2) IS DISTINCT FROM v_existing_payment.amount
       OR v_existing_payment.amount IS DISTINCT FROM v_expected_total
       OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_payment.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.status, ''), E' \t\n\r\f\v')) NOT IN ('captured', 'paid')
       OR v_existing_payment.user_id IS DISTINCT FROM p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'error', 'Security violation: existing payment record conflicts with order, payment, product, amount, currency, status, or user ownership.'
      );
    END IF;
  END IF;

  -- Strict symmetric invariant & scale validation for existing booking
  IF v_has_booking THEN
    IF v_existing_booking.razorpay_order_id IS DISTINCT FROM v_clean_order_id
       OR v_existing_booking.payment_id IS DISTINCT FROM v_clean_payment_id
       OR v_existing_booking.total_amount IS NULL
       OR v_existing_booking.total_amount = 'NaN'::NUMERIC
       OR pg_catalog.round(v_existing_booking.total_amount, 2) IS DISTINCT FROM v_existing_booking.total_amount
       OR v_existing_booking.total_amount IS DISTINCT FROM v_expected_total
       OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_booking.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_booking.customer_email, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_customer_email
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_booking.status, ''), E' \t\n\r\f\v')) NOT IN ('confirmed', 'reschedule_pending', 'rescheduled', 'completed')
       OR v_existing_booking.user_id IS DISTINCT FROM p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'error', 'Security violation: existing booking record conflicts with order, payment, amount, currency, email, status, or user ownership.'
      );
    END IF;
  END IF;

  -- Case A: Both booking and payment exist and match all invariants
  IF v_has_booking AND v_has_payment THEN
    IF v_existing_payment.invoice_number IS NOT NULL
       AND (v_existing_booking.invoice_number IS NULL OR pg_catalog.btrim(v_existing_booking.invoice_number, E' \t\n\r\f\v') = '') THEN
      UPDATE public.bookings
      SET invoice_number = v_existing_payment.invoice_number,
          updated_at = pg_catalog.now()
      WHERE id = v_existing_booking.id
      RETURNING * INTO v_existing_booking;
    END IF;

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

  -- Case B: Booking exists, payment ledger missing -> heal payment inside subtransaction
  IF v_has_booking AND NOT v_has_payment THEN
    BEGIN
      INSERT INTO public.payments (
        user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at
      ) VALUES (
        p_user_id, 'consultation', v_target_product_id,
        COALESCE(v_product.name, 'Business Growth & Scaling Consultation'),
        v_expected_total, 'INR', v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
      )
      RETURNING * INTO v_existing_payment;
    EXCEPTION WHEN unique_violation THEN
      v_pay_by_pay := NULL;
      v_pay_by_ord := NULL;
      v_pay_by_pay_cnt := 0;
      v_pay_by_ord_cnt := 0;

      FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
        v_pay_by_pay_cnt := v_pay_by_pay_cnt + 1;
        IF v_pay_by_pay_cnt = 1 THEN v_pay_by_pay := v_rec; END IF;
      END LOOP;

      FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
        v_pay_by_ord_cnt := v_pay_by_ord_cnt + 1;
        IF v_pay_by_ord_cnt = 1 THEN v_pay_by_ord := v_rec; END IF;
      END LOOP;

      IF v_pay_by_pay_cnt > 1 OR v_pay_by_ord_cnt > 1
         OR (v_pay_by_pay.id IS NOT NULL AND v_pay_by_ord.id IS NOT NULL AND v_pay_by_pay.id IS DISTINCT FROM v_pay_by_ord.id) THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'IDEMPOTENCY_CONFLICT',
          'error', 'Concurrent payment insertion resolved ambiguously across payment_id and order_id.'
        );
      END IF;

      IF v_pay_by_pay.id IS NOT NULL THEN
        v_existing_payment := v_pay_by_pay;
      ELSE
        v_existing_payment := v_pay_by_ord;
      END IF;

      IF v_existing_payment.id IS NULL
         OR v_existing_payment.razorpay_order_id IS DISTINCT FROM v_clean_order_id
         OR v_existing_payment.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.item_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'consultation'
         OR NULLIF(pg_catalog.btrim(COALESCE(v_existing_payment.item_id::text, ''), E' \t\n\r\f\v'), '') IS DISTINCT FROM v_target_product_id::text
         OR v_existing_payment.amount IS NULL
         OR v_existing_payment.amount = 'NaN'::NUMERIC
         OR pg_catalog.round(v_existing_payment.amount, 2) IS DISTINCT FROM v_existing_payment.amount
         OR v_existing_payment.amount IS DISTINCT FROM v_expected_total
         OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_payment.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.status, ''), E' \t\n\r\f\v')) NOT IN ('captured', 'paid')
         OR v_existing_payment.user_id IS DISTINCT FROM p_user_id THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'IDEMPOTENCY_CONFLICT',
          'error', 'Concurrent payment insertion conflicted with transaction invariants.'
        );
      END IF;
    END;

    IF v_existing_payment.invoice_number IS NOT NULL
       AND (v_existing_booking.invoice_number IS NULL OR pg_catalog.btrim(v_existing_booking.invoice_number, E' \t\n\r\f\v') = '') THEN
      UPDATE public.bookings
      SET invoice_number = v_existing_payment.invoice_number,
          updated_at = pg_catalog.now()
      WHERE id = v_existing_booking.id
      RETURNING * INTO v_existing_booking;
    END IF;

    -- Ensure CRM lead exists idempotently after healed payment
    SELECT id::text INTO v_existing_lead_id
    FROM public.crm_leads
    WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, v_clean_payment_id) > 0
    LIMIT 1;

    IF v_existing_lead_id IS NOT NULL THEN
      v_lead_status := 'already_exists';
    ELSE
      SELECT data_type INTO v_crm_id_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'crm_leads'
        AND column_name = 'id';

      IF v_crm_id_type = 'uuid' THEN
        v_crm_lead_uuid := pg_catalog.gen_random_uuid();
        EXECUTE $crm_uuid_b$
          INSERT INTO public.crm_leads (
            id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
        $crm_uuid_b$
        USING
          v_crm_lead_uuid,
          v_customer_name,
          v_customer_email,
          v_customer_phone,
          'Consultation Intake (Paid)',
          '1-on-1 Business Growth Consultation',
          ('Booking Code: ' || v_existing_booking.booking_code || ', Date: ' || v_existing_booking.booking_date::text || ' at ' || v_existing_booking.booking_time ||
           ', Payment: ' || v_clean_payment_id ||
           CASE WHEN v_existing_booking.status = 'reschedule_pending' THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
          'New',
          v_expected_total,
          pg_catalog.now(),
          pg_catalog.now();
        v_existing_lead_id := v_crm_lead_uuid::text;
      ELSE
        v_crm_lead_text := 'lead_' || pg_catalog.gen_random_uuid()::text;
        EXECUTE $crm_text_b$
          INSERT INTO public.crm_leads (
            id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
        $crm_text_b$
        USING
          v_crm_lead_text,
          v_customer_name,
          v_customer_email,
          v_customer_phone,
          'Consultation Intake (Paid)',
          '1-on-1 Business Growth Consultation',
          ('Booking Code: ' || v_existing_booking.booking_code || ', Date: ' || v_existing_booking.booking_date::text || ' at ' || v_existing_booking.booking_time ||
           ', Payment: ' || v_clean_payment_id ||
           CASE WHEN v_existing_booking.status = 'reschedule_pending' THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
          'New',
          v_expected_total,
          pg_catalog.now(),
          pg_catalog.now();
        v_existing_lead_id := v_crm_lead_text;
      END IF;
      v_lead_status := 'saved';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_ledger', true,
      'booking', pg_catalog.row_to_json(v_existing_booking),
      'payment', pg_catalog.row_to_json(v_existing_payment),
      'lead_status', v_lead_status,
      'lead_id', v_existing_lead_id,
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id
    );
  END IF;

  -- Resolve active slot conflict & meeting link safely (aligned with live public.bookings schema)
  SELECT id INTO v_conflicting_slot_id
  FROM public.bookings
  WHERE booking_date = v_booking_date
    AND booking_time = v_booking_time
    AND status IN ('confirmed', 'rescheduled')
    AND (razorpay_order_id IS NULL OR razorpay_order_id IS DISTINCT FROM v_clean_order_id)
  LIMIT 1
  FOR UPDATE;

  IF v_conflicting_slot_id IS NOT NULL THEN
    v_is_slot_conflicted := true;
    v_booking_status := 'reschedule_pending';
    v_booking_notes := 'SLOT_CONFLICT: Time slot taken by concurrent transaction. Payment captured (Razorpay ' || v_clean_payment_id || '). Priority reschedule required.';
  END IF;

  v_meeting_link := NULLIF(pg_catalog.btrim(COALESCE(p_booking_details->>'meeting_link', p_booking_details->>'meet_url', ''), E' \t\n\r\f\v'), '');
  v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
  v_booking_code := pg_catalog.substr(COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_booking_details->>'booking_code', ''), E' \t\n\r\f\v'), ''),
    ('DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)))
  ), 1, 30);

  -- Case C: Payment exists, booking missing -> heal booking inside bounded retry loop
  IF v_has_payment AND NOT v_has_booking THEN
    v_has_booking := false;
    FOR v_attempt IN 1..5 LOOP
      BEGIN
        INSERT INTO public.bookings (
          id, booking_code, customer_name, customer_email, customer_phone, business_name,
          primary_challenge, desired_outcome, website, linkedin, booking_date,
          booking_time, duration_minutes, base_amount, gst_rate, gst_amount,
          total_amount, currency, payment_id, razorpay_order_id, invoice_number,
          meeting_link, status, user_id, notes, created_at, updated_at
        ) VALUES (
          v_booking_id, v_booking_code, v_customer_name, v_customer_email, v_customer_phone, v_business_name,
          v_primary_challenge, v_desired_outcome, v_website, v_linkedin, v_booking_date,
          v_booking_time, v_duration_minutes, v_base_price, v_gst_rate, v_gst_amount,
          v_expected_total, 'INR', v_clean_payment_id, v_clean_order_id, v_existing_payment.invoice_number,
          v_meeting_link, v_booking_status, p_user_id,
          v_booking_notes, pg_catalog.now(), pg_catalog.now()
        )
        RETURNING * INTO v_existing_booking;
        v_has_booking := true;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_diag_constraint = CONSTRAINT_NAME, v_diag_message = MESSAGE_TEXT;

        IF (v_diag_constraint = 'idx_unique_active_booking_slot' OR v_diag_message LIKE '%idx_unique_active_booking_slot%')
           AND NOT v_is_slot_conflicted THEN
          v_is_slot_conflicted := true;
          v_booking_status := 'reschedule_pending';
          v_booking_notes := 'SLOT_CONFLICT: Concurrent checkout won active slot. Payment captured safely (Razorpay ' || v_clean_payment_id || '). Priority reschedule required.';
          v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
          v_booking_code := 'DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
                            pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));
        ELSIF v_diag_constraint IN ('bookings_booking_code_key', 'bookings_pkey')
           OR v_diag_message LIKE '%bookings_booking_code%'
           OR v_diag_message LIKE '%bookings_pkey%' THEN
          v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
          v_booking_code := 'DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
                            pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));
        ELSE
          v_bkg_by_pay := NULL;
          v_bkg_by_ord := NULL;
          v_bkg_by_pay_cnt := 0;
          v_bkg_by_ord_cnt := 0;

          FOR v_rec IN SELECT * FROM public.bookings WHERE payment_id = v_clean_payment_id FOR UPDATE LOOP
            v_bkg_by_pay_cnt := v_bkg_by_pay_cnt + 1;
            IF v_bkg_by_pay_cnt = 1 THEN v_bkg_by_pay := v_rec; END IF;
          END LOOP;

          FOR v_rec IN SELECT * FROM public.bookings WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
            v_bkg_by_ord_cnt := v_bkg_by_ord_cnt + 1;
            IF v_bkg_by_ord_cnt = 1 THEN v_bkg_by_ord := v_rec; END IF;
          END LOOP;

          IF v_bkg_by_pay_cnt > 1 OR v_bkg_by_ord_cnt > 1
             OR (v_bkg_by_pay.id IS NOT NULL AND v_bkg_by_ord.id IS NOT NULL AND v_bkg_by_pay.id IS DISTINCT FROM v_bkg_by_ord.id) THEN
            RETURN pg_catalog.jsonb_build_object(
              'success', false,
              'code', 'IDEMPOTENCY_CONFLICT',
              'error', 'Concurrent booking insertion resolved ambiguously across payment_id and order_id.'
            );
          END IF;

          IF v_bkg_by_pay.id IS NOT NULL THEN
            v_existing_booking := v_bkg_by_pay;
          ELSE
            v_existing_booking := v_bkg_by_ord;
          END IF;

          IF v_existing_booking.id IS NULL
             OR v_existing_booking.razorpay_order_id IS DISTINCT FROM v_clean_order_id
             OR v_existing_booking.payment_id IS DISTINCT FROM v_clean_payment_id
             OR v_existing_booking.total_amount IS NULL
             OR v_existing_booking.total_amount = 'NaN'::NUMERIC
             OR pg_catalog.round(v_existing_booking.total_amount, 2) IS DISTINCT FROM v_existing_booking.total_amount
             OR v_existing_booking.total_amount IS DISTINCT FROM v_expected_total
             OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_booking.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
             OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_booking.customer_email, ''), E' \t\n\r\f\v')) IS DISTINCT FROM v_customer_email
             OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_booking.status, ''), E' \t\n\r\f\v')) NOT IN ('confirmed', 'reschedule_pending', 'rescheduled', 'completed')
             OR v_existing_booking.user_id IS DISTINCT FROM p_user_id THEN
            RETURN pg_catalog.jsonb_build_object(
              'success', false,
              'code', 'IDEMPOTENCY_CONFLICT',
              'error', 'Concurrent booking insertion conflicted with transaction invariants.'
            );
          END IF;

          v_is_slot_conflicted := (v_existing_booking.status = 'reschedule_pending');
          v_has_booking := true;
          EXIT;
        END IF;
      END;
    END LOOP;

    IF NOT v_has_booking THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Exhausted retry attempts while healing consultation booking.';
    END IF;

    -- Ensure CRM lead exists idempotently after healed booking
    SELECT id::text INTO v_existing_lead_id
    FROM public.crm_leads
    WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, v_clean_payment_id) > 0
    LIMIT 1;

    IF v_existing_lead_id IS NOT NULL THEN
      v_lead_status := 'already_exists';
    ELSE
      SELECT data_type INTO v_crm_id_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'crm_leads'
        AND column_name = 'id';

      IF v_crm_id_type = 'uuid' THEN
        v_crm_lead_uuid := pg_catalog.gen_random_uuid();
        EXECUTE $crm_uuid_c$
          INSERT INTO public.crm_leads (
            id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
        $crm_uuid_c$
        USING
          v_crm_lead_uuid,
          v_customer_name,
          v_customer_email,
          v_customer_phone,
          'Consultation Intake (Paid)',
          '1-on-1 Business Growth Consultation',
          ('Booking Code: ' || v_existing_booking.booking_code || ', Date: ' || v_existing_booking.booking_date::text || ' at ' || v_existing_booking.booking_time ||
           ', Payment: ' || v_clean_payment_id ||
           CASE WHEN v_is_slot_conflicted THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
          'New',
          v_expected_total,
          pg_catalog.now(),
          pg_catalog.now();
        v_existing_lead_id := v_crm_lead_uuid::text;
      ELSE
        v_crm_lead_text := 'lead_' || pg_catalog.gen_random_uuid()::text;
        EXECUTE $crm_text_c$
          INSERT INTO public.crm_leads (
            id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
        $crm_text_c$
        USING
          v_crm_lead_text,
          v_customer_name,
          v_customer_email,
          v_customer_phone,
          'Consultation Intake (Paid)',
          '1-on-1 Business Growth Consultation',
          ('Booking Code: ' || v_existing_booking.booking_code || ', Date: ' || v_existing_booking.booking_date::text || ' at ' || v_existing_booking.booking_time ||
           ', Payment: ' || v_clean_payment_id ||
           CASE WHEN v_is_slot_conflicted THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
          'New',
          v_expected_total,
          pg_catalog.now(),
          pg_catalog.now();
        v_existing_lead_id := v_crm_lead_text;
      END IF;
      v_lead_status := 'saved';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_booking', true,
      'slot_conflict', v_is_slot_conflicted,
      'action_required', CASE WHEN v_is_slot_conflicted THEN 'reschedule_required' ELSE NULL END,
      'booking', pg_catalog.row_to_json(v_existing_booking),
      'payment', pg_catalog.row_to_json(v_existing_payment),
      'lead_status', v_lead_status,
      'lead_id', v_existing_lead_id,
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id
    );
  END IF;

  -- Case D: Fresh atomic transaction across payments (first for trigger-minted invoice_number), bookings, and crm_leads
  BEGIN
    INSERT INTO public.payments (
      user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status, created_at
    ) VALUES (
      p_user_id, 'consultation', v_target_product_id,
      COALESCE(v_product.name, 'Business Growth & Scaling Consultation'),
      v_expected_total, 'INR', v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
    )
    RETURNING * INTO v_new_payment;
  EXCEPTION WHEN unique_violation THEN
    v_pay_by_pay := NULL;
    v_pay_by_ord := NULL;
    v_bkg_by_pay := NULL;
    v_bkg_by_ord := NULL;
    v_pay_by_pay_cnt := 0;
    v_pay_by_ord_cnt := 0;
    v_bkg_by_pay_cnt := 0;
    v_bkg_by_ord_cnt := 0;

    FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
      v_pay_by_pay_cnt := v_pay_by_pay_cnt + 1;
      IF v_pay_by_pay_cnt = 1 THEN v_pay_by_pay := v_rec; END IF;
    END LOOP;
    FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
      v_pay_by_ord_cnt := v_pay_by_ord_cnt + 1;
      IF v_pay_by_ord_cnt = 1 THEN v_pay_by_ord := v_rec; END IF;
    END LOOP;
    FOR v_rec IN SELECT * FROM public.bookings WHERE payment_id = v_clean_payment_id FOR UPDATE LOOP
      v_bkg_by_pay_cnt := v_bkg_by_pay_cnt + 1;
      IF v_bkg_by_pay_cnt = 1 THEN v_bkg_by_pay := v_rec; END IF;
    END LOOP;
    FOR v_rec IN SELECT * FROM public.bookings WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
      v_bkg_by_ord_cnt := v_bkg_by_ord_cnt + 1;
      IF v_bkg_by_ord_cnt = 1 THEN v_bkg_by_ord := v_rec; END IF;
    END LOOP;

    IF v_pay_by_pay_cnt > 1 OR v_pay_by_ord_cnt > 1 OR v_bkg_by_pay_cnt > 1 OR v_bkg_by_ord_cnt > 1
       OR (v_pay_by_pay.id IS NOT NULL AND v_pay_by_ord.id IS NOT NULL AND v_pay_by_pay.id IS DISTINCT FROM v_pay_by_ord.id)
       OR (v_bkg_by_pay.id IS NOT NULL AND v_bkg_by_ord.id IS NOT NULL AND v_bkg_by_pay.id IS DISTINCT FROM v_bkg_by_ord.id) THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'error', 'Concurrent records resolved ambiguously across payment_id and order_id.'
      );
    END IF;

    IF v_pay_by_pay.id IS NOT NULL THEN
      v_existing_payment := v_pay_by_pay;
    ELSE
      v_existing_payment := v_pay_by_ord;
    END IF;

    IF v_bkg_by_pay.id IS NOT NULL THEN
      v_existing_booking := v_bkg_by_pay;
    ELSE
      v_existing_booking := v_bkg_by_ord;
    END IF;

    IF v_existing_payment.id IS NOT NULL
       AND v_existing_booking.id IS NOT NULL
       AND v_existing_payment.razorpay_order_id IS NOT DISTINCT FROM v_clean_order_id
       AND v_existing_payment.razorpay_payment_id IS NOT DISTINCT FROM v_clean_payment_id
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.item_type, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'consultation'
       AND NULLIF(pg_catalog.btrim(COALESCE(v_existing_payment.item_id::text, ''), E' \t\n\r\f\v'), '') IS NOT DISTINCT FROM v_target_product_id::text
       AND v_existing_payment.amount IS NOT NULL
       AND v_existing_payment.amount <> 'NaN'::NUMERIC
       AND pg_catalog.round(v_existing_payment.amount, 2) IS NOT DISTINCT FROM v_existing_payment.amount
       AND v_existing_payment.amount IS NOT DISTINCT FROM v_expected_total
       AND pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_payment.currency, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'INR'
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_payment.status, ''), E' \t\n\r\f\v')) IN ('captured', 'paid')
       AND v_existing_payment.user_id IS NOT DISTINCT FROM p_user_id
       AND v_existing_booking.razorpay_order_id IS NOT DISTINCT FROM v_clean_order_id
       AND v_existing_booking.payment_id IS NOT DISTINCT FROM v_clean_payment_id
       AND v_existing_booking.total_amount IS NOT NULL
       AND v_existing_booking.total_amount <> 'NaN'::NUMERIC
       AND pg_catalog.round(v_existing_booking.total_amount, 2) IS NOT DISTINCT FROM v_existing_booking.total_amount
       AND v_existing_booking.total_amount IS NOT DISTINCT FROM v_expected_total
       AND pg_catalog.upper(pg_catalog.btrim(COALESCE(v_existing_booking.currency, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'INR'
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_booking.customer_email, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM v_customer_email
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_existing_booking.status, ''), E' \t\n\r\f\v')) IN ('confirmed', 'reschedule_pending', 'rescheduled', 'completed')
       AND v_existing_booking.user_id IS NOT DISTINCT FROM p_user_id THEN
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
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Concurrent payment record violates consultation transaction invariants.'
    );
  END;

  v_has_booking := false;
  FOR v_attempt IN 1..5 LOOP
    BEGIN
      INSERT INTO public.bookings (
        id, booking_code, customer_name, customer_email, customer_phone, business_name,
        primary_challenge, desired_outcome, website, linkedin, booking_date,
        booking_time, duration_minutes, base_amount, gst_rate, gst_amount,
        total_amount, currency, payment_id, razorpay_order_id, invoice_number,
        meeting_link, status, user_id, notes, created_at, updated_at
      ) VALUES (
        v_booking_id, v_booking_code, v_customer_name, v_customer_email, v_customer_phone, v_business_name,
        v_primary_challenge, v_desired_outcome, v_website, v_linkedin, v_booking_date,
        v_booking_time, v_duration_minutes, v_base_price, v_gst_rate, v_gst_amount,
        v_expected_total, 'INR', v_clean_payment_id, v_clean_order_id, v_new_payment.invoice_number,
        v_meeting_link, v_booking_status, p_user_id,
        v_booking_notes, pg_catalog.now(), pg_catalog.now()
      )
      RETURNING * INTO v_new_booking;
      v_has_booking := true;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_diag_constraint = CONSTRAINT_NAME, v_diag_message = MESSAGE_TEXT;

      IF (v_diag_constraint = 'idx_unique_active_booking_slot' OR v_diag_message LIKE '%idx_unique_active_booking_slot%')
         AND NOT v_is_slot_conflicted THEN
        v_is_slot_conflicted := true;
        v_booking_status := 'reschedule_pending';
        v_booking_notes := 'SLOT_CONFLICT: Concurrent checkout won active slot. Payment captured safely (Razorpay ' || v_clean_payment_id || '). Priority reschedule required.';
        v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
        v_booking_code := 'DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
                          pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));
      ELSIF v_diag_constraint IN ('bookings_booking_code_key', 'bookings_pkey')
         OR v_diag_message LIKE '%bookings_booking_code%'
         OR v_diag_message LIKE '%bookings_pkey%' THEN
        v_booking_id := 'bkg_' || pg_catalog.gen_random_uuid()::text;
        v_booking_code := 'DM-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
                          pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));
      ELSE
        -- Roll back the outer payments insert atomically if an unexpected booking unique_violation occurred
        RAISE;
      END IF;
    END;
  END LOOP;

  IF NOT v_has_booking THEN
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Exhausted retry attempts while creating consultation booking.';
  END IF;

  -- Atomic CRM Lead Synchronization (no swallowed exceptions; supports uuid or text crm_leads.id; valid status 'New')
  SELECT id::text INTO v_existing_lead_id
  FROM public.crm_leads
  WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, v_clean_payment_id) > 0
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    v_lead_status := 'already_exists';
  ELSE
    SELECT data_type INTO v_crm_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_leads'
      AND column_name = 'id';

    IF v_crm_id_type = 'uuid' THEN
      v_crm_lead_uuid := pg_catalog.gen_random_uuid();
      EXECUTE $crm_uuid$
        INSERT INTO public.crm_leads (
          id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      $crm_uuid$
      USING
        v_crm_lead_uuid,
        v_customer_name,
        v_customer_email,
        v_customer_phone,
        'Consultation Intake (Paid)',
        '1-on-1 Business Growth Consultation',
        ('Booking Code: ' || v_booking_code || ', Date: ' || v_booking_date::text || ' at ' || v_booking_time ||
         ', Payment: ' || v_clean_payment_id ||
         CASE WHEN v_is_slot_conflicted THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
        'New',
        v_expected_total,
        pg_catalog.now(),
        pg_catalog.now();
      v_existing_lead_id := v_crm_lead_uuid::text;
    ELSE
      v_crm_lead_text := 'lead_' || pg_catalog.gen_random_uuid()::text;
      EXECUTE $crm_text$
        INSERT INTO public.crm_leads (
          id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      $crm_text$
      USING
        v_crm_lead_text,
        v_customer_name,
        v_customer_email,
        v_customer_phone,
        'Consultation Intake (Paid)',
        '1-on-1 Business Growth Consultation',
        ('Booking Code: ' || v_booking_code || ', Date: ' || v_booking_date::text || ' at ' || v_booking_time ||
         ', Payment: ' || v_clean_payment_id ||
         CASE WHEN v_is_slot_conflicted THEN ' [ATTENTION: Slot conflict occurred. Priority reschedule needed]' ELSE '' END),
        'New',
        v_expected_total,
        pg_catalog.now(),
        pg_catalog.now();
      v_existing_lead_id := v_crm_lead_text;
    END IF;
    v_lead_status := 'saved';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'fulfilled', true,
    'already_fulfilled', false,
    'slot_conflict', v_is_slot_conflicted,
    'action_required', CASE WHEN v_is_slot_conflicted THEN 'reschedule_required' ELSE NULL END,
    'booking', pg_catalog.row_to_json(v_new_booking),
    'payment', pg_catalog.row_to_json(v_new_payment),
    'lead_status', v_lead_status,
    'lead_id', v_existing_lead_id,
    'order_id', v_clean_order_id,
    'payment_id', v_clean_payment_id
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) OWNER TO postgres;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
