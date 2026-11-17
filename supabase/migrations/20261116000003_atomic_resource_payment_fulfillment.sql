-- ==============================================================================
-- DIGITAL MUID — P1-4 ADDITIVE MIGRATION PROPOSAL
-- ATOMIC RESOURCE PURCHASE & PAYMENT LEDGER FULFILLMENT
-- Migration: 20261116000003_atomic_resource_payment_fulfillment.sql
-- ==============================================================================
-- STATUS: NOT EXECUTED IN DATABASE — ADDITIVE MIGRATION PROPOSAL ONLY
--
-- Summary of Corrections & Hardening:
--   1. Valid PostgreSQL syntax (no pg_catalog.coalesce / pg_catalog.nullif / pg_catalog.trim;
--      uses pg_catalog.btrim(..., E' \t\n\r\f\v')).
--   2. Fail-closed schema compatibility preflight for resource_purchases, resources,
--      payments, and crm_leads + resource_purchases.status normalization & validation.
--   3. Inspects BOTH pg_constraint (contype = 'u') AND pg_index (indisunique, indkey,
--      indpred, indisvalid, indisready) to reconcile uq_user_resource_purchase and any
--      alias unique constraints/indexes on (user_id, resource_id):
--      - Aligns with server/paymentRoutes.js pre-checkout repurchase policy: enforces
--        uniqueness ONLY on active authenticated purchases:
--        WHERE user_id IS NOT NULL AND status = 'active'
--        so refunded/revoked buyers may repurchase while concurrent active duplicate
--        purchases are blocked with DUPLICATE_USER_RESOURCE_PURCHASE.
--   4. Reconciles uq_resource_purchases_razorpay_payment_id and
--      uq_resource_purchases_razorpay_order_id cleanly against pg_index & duplicates.
--   5. Rewrites fulfill_resource_purchase with split by_pay / by_ord FOR UPDATE lookups,
--      multi-row safety, strict NaN / NULL / overflow / >2-decimal scale & invariant
--      checks across Step 4 and ALL unique_violation recovery blocks (Cases B, C, D),
--      atomic ROLLBACK on Case D partial failure, and strpos CRM lead dedup.
--
-- Rollback Instructions & Irreversibility Notes:
--   - Function & indexes added by this migration can be removed via:
--     DROP FUNCTION IF EXISTS public.fulfill_resource_purchase(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
--     DROP INDEX IF EXISTS public.uq_resource_purchases_razorpay_order_id;
--     DROP INDEX IF EXISTS public.uq_resource_purchases_razorpay_payment_id;
--     DROP INDEX IF EXISTS public.uq_user_resource_purchase;
--   - Irreversible changes once committed: ALTER COLUMN user_id DROP NOT NULL on
--     resource_purchases & payments, dropped legacy uq_user_resource_purchase table
--     constraint/index, and trimmed/lowercased status/payment/order strings cannot be
--     reverted automatically. Capture and test-restore a pg_dump backup beforehand.
-- ==============================================================================

-- 0. Fail-closed schema compatibility preflight
DO $$
DECLARE
  v_missing TEXT[];
  v_item_id_type TEXT;
BEGIN
  SELECT pg_catalog.array_agg(tbl)
  INTO v_missing
  FROM (VALUES ('resource_purchases'), ('resources'), ('payments'), ('crm_leads')) AS req(tbl)
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
END $$;

-- 1. Reconcile resource_purchases & payments columns, nullability, and active partial user+resource index
ALTER TABLE public.resource_purchases
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE public.resource_purchases
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.payments
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  v_rp_oid OID := 'public.resource_purchases'::regclass;
  v_user_attnum SMALLINT;
  v_res_attnum SMALLINT;
  v_con RECORD;
  v_idx RECORD;
  v_bad_status_count INTEGER;
  v_dup_count INTEGER;
  v_pred_regex TEXT;
BEGIN
  -- Normalize and validate resource_purchases.status strictly against ('active', 'revoked')
  UPDATE public.resource_purchases
  SET status = pg_catalog.lower(pg_catalog.btrim(status, E' \t\n\r\f\v'))
  WHERE status IS NOT NULL
    AND status IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(status, E' \t\n\r\f\v'));

  SELECT COUNT(*) INTO v_bad_status_count
  FROM public.resource_purchases
  WHERE status IS NULL OR status NOT IN ('active', 'revoked');

  IF v_bad_status_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % public.resource_purchases row(s) with unrecognized status outside (''active'', ''revoked'').', v_bad_status_count;
  END IF;

  SELECT a.attnum INTO v_user_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_rp_oid AND a.attname = 'user_id' AND NOT a.attisdropped;

  SELECT a.attnum INTO v_res_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_rp_oid AND a.attname = 'resource_id' AND NOT a.attisdropped;

  IF v_user_attnum IS NULL OR v_res_attnum IS NULL THEN
    RAISE EXCEPTION 'Compatibility failure: public.resource_purchases missing user_id or resource_id column.';
  END IF;

  -- Drop any table-wide UNIQUE constraint named uq_user_resource_purchase or spanning (user_id, resource_id)
  FOR v_con IN
    SELECT c.conname
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rp_oid
      AND c.contype = 'u'
      AND (c.conname = 'uq_user_resource_purchase' OR c.conkey = ARRAY[v_user_attnum, v_res_attnum])
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.resource_purchases DROP CONSTRAINT IF EXISTS %I', v_con.conname);
  END LOOP;

  -- Inspect standalone pg_index entry for uq_user_resource_purchase and drop if non-partial, wrong-predicate, or invalid
  v_pred_regex :=
    '^\s*\(*\s*user_id\s+IS\s+NOT\s+NULL\s*\)*\s+AND\s+\(*\s*status(?:::text)?\s*=\s*''active''(?:::text)?\s*\)*\s*$';

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
    AND c.relname = 'uq_user_resource_purchase';

  IF FOUND THEN
    IF v_idx.table_schema IS DISTINCT FROM 'public'
       OR v_idx.table_name IS DISTINCT FROM 'resource_purchases'
       OR v_idx.indisunique IS DISTINCT FROM TRUE
       OR v_idx.indisvalid IS DISTINCT FROM TRUE
       OR v_idx.indisready IS DISTINCT FROM TRUE
       OR v_idx.indexprs IS NOT NULL
       OR ARRAY(
            SELECT u.attnum
            FROM pg_catalog.unnest(v_idx.indkey::SMALLINT[])
                 WITH ORDINALITY AS u(attnum, ord)
            ORDER BY u.ord
          ) IS DISTINCT FROM ARRAY[v_user_attnum, v_res_attnum]
       OR v_idx.indpred IS NULL
       OR v_idx.pred_expr IS NULL
       OR v_idx.pred_expr !~* v_pred_regex THEN
      DROP INDEX IF EXISTS public.uq_user_resource_purchase;
    END IF;
  END IF;

  -- Drop any other non-partial standalone unique index on (user_id, resource_id) that would block revoked repurchase
  FOR v_idx IN
    SELECT c.relname AS idx_name
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
    WHERE i.indrelid = v_rp_oid
      AND i.indisunique = true
      AND i.indexprs IS NULL
      AND ARRAY(
            SELECT u.attnum
            FROM pg_catalog.unnest(i.indkey::SMALLINT[])
                 WITH ORDINALITY AS u(attnum, ord)
            ORDER BY u.ord
          ) = ARRAY[v_user_attnum, v_res_attnum]
      AND c.relname <> 'uq_user_resource_purchase'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint con WHERE con.conindid = c.oid
      )
  LOOP
    EXECUTE pg_catalog.format('DROP INDEX IF EXISTS %I.%I', 'public', v_idx.idx_name);
  END LOOP;

  -- Duplicate preflight aligned with active purchase policy
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT user_id, resource_id
    FROM public.resource_purchases
    WHERE user_id IS NOT NULL AND status = 'active'
    GROUP BY user_id, resource_id
    HAVING COUNT(*) > 1
  ) dup_usr;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % duplicate active (user_id, resource_id) pair(s) in public.resource_purchases.', v_dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_resource_purchase
  ON public.resource_purchases (user_id, resource_id)
  WHERE user_id IS NOT NULL AND status = 'active';

-- 2. Preflight checks & index reconciliation before creating unique partial indexes on payment_id & order_id
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
  UPDATE public.resource_purchases
  SET razorpay_payment_id = pg_catalog.btrim(razorpay_payment_id, E' \t\n\r\f\v')
  WHERE razorpay_payment_id IS NOT NULL
    AND razorpay_payment_id IS DISTINCT FROM pg_catalog.btrim(razorpay_payment_id, E' \t\n\r\f\v');

  UPDATE public.resource_purchases
  SET razorpay_order_id = pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v')
  WHERE razorpay_order_id IS NOT NULL
    AND razorpay_order_id IS DISTINCT FROM pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v');

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT pg_catalog.btrim(razorpay_payment_id, E' \t\n\r\f\v') AS clean_pay
    FROM public.resource_purchases
    WHERE razorpay_payment_id IS NOT NULL
      AND pg_catalog.btrim(razorpay_payment_id, E' \t\n\r\f\v') <> ''
    GROUP BY pg_catalog.btrim(razorpay_payment_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) dup_pay;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % duplicate razorpay_payment_id value(s) in public.resource_purchases. Reconcile duplicates before creating uq_resource_purchases_razorpay_payment_id.', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v') AS clean_ord
    FROM public.resource_purchases
    WHERE razorpay_order_id IS NOT NULL
      AND pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v') <> ''
    GROUP BY pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v')
    HAVING COUNT(*) > 1
  ) dup_ord;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Migration halt: Found % duplicate razorpay_order_id value(s) in public.resource_purchases. Reconcile duplicates before creating uq_resource_purchases_razorpay_order_id.', v_dup_count;
  END IF;

  FOR v_spec IN
    SELECT * FROM (VALUES
      ('uq_resource_purchases_razorpay_payment_id', 'razorpay_payment_id'),
      ('uq_resource_purchases_razorpay_order_id',   'razorpay_order_id')
    ) AS s(idx_name, col_name)
  LOOP
    SELECT a.attnum INTO v_attnum
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class tbl ON tbl.oid = a.attrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'resource_purchases'
      AND a.attname = v_spec.col_name
      AND NOT a.attisdropped;

    IF v_attnum IS NULL THEN
      RAISE EXCEPTION 'Compatibility failure: public.resource_purchases.% column not found.', v_spec.col_name;
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
         OR v_idx.table_name IS DISTINCT FROM 'resource_purchases'
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_purchases_razorpay_payment_id
  ON public.resource_purchases (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL AND pg_catalog.btrim(razorpay_payment_id, E' \t\n\r\f\v') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_purchases_razorpay_order_id
  ON public.resource_purchases (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL AND pg_catalog.btrim(razorpay_order_id, E' \t\n\r\f\v') <> '';

-- Inspect & create customer_email lookup index (forward compatibility if 20261022000001 was skipped/already recorded)
DO $$
DECLARE
  v_email_attnum SMALLINT;
  v_idx RECORD;
BEGIN
  SELECT a.attnum INTO v_email_attnum
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class tbl ON tbl.oid = a.attrelid
  JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'resource_purchases'
    AND a.attname = 'customer_email'
    AND NOT a.attisdropped;

  IF v_email_attnum IS NULL THEN
    RAISE EXCEPTION 'Compatibility failure: public.resource_purchases.customer_email column not found.';
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
    pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS pred_expr,
    pg_catalog.pg_get_indexdef(c.oid) AS index_def
  INTO v_idx
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
  JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
  JOIN pg_catalog.pg_namespace nc ON nc.oid = c.relnamespace
  JOIN pg_catalog.pg_namespace nt ON nt.oid = t.relnamespace
  WHERE nc.nspname = 'public'
    AND c.relname = 'idx_resource_purchases_email';

  IF FOUND THEN
    IF v_idx.table_schema IS DISTINCT FROM 'public'
       OR v_idx.table_name IS DISTINCT FROM 'resource_purchases'
       OR v_idx.indisunique IS DISTINCT FROM FALSE
       OR v_idx.indisvalid IS DISTINCT FROM TRUE
       OR v_idx.indisready IS DISTINCT FROM TRUE
       OR v_idx.indexprs IS NOT NULL
       OR ARRAY(
            SELECT u.attnum
            FROM pg_catalog.unnest(v_idx.indkey::SMALLINT[])
                 WITH ORDINALITY AS u(attnum, ord)
            ORDER BY u.ord
          ) IS DISTINCT FROM ARRAY[v_email_attnum]
       OR v_idx.indpred IS NOT NULL THEN
      RAISE EXCEPTION 'Migration halt: Existing index public.idx_resource_purchases_email conflicts with expected non-unique full-table index on public.resource_purchases(customer_email) (table=%.%, unique=%, valid=%, ready=%, predicate=%, def=%).',
        v_idx.table_schema,
        v_idx.table_name,
        v_idx.indisunique,
        v_idx.indisvalid,
        v_idx.indisready,
        COALESCE(v_idx.pred_expr, '<none>'),
        v_idx.index_def;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resource_purchases_email
  ON public.resource_purchases (customer_email);

-- 3. Atomic SECURITY DEFINER RPC for paid digital resource fulfillment
CREATE OR REPLACE FUNCTION public.fulfill_resource_purchase(
  p_user_id UUID,
  p_resource_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_order_id TEXT,
  p_payment_id TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_resource_title TEXT DEFAULT NULL
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
  v_resource public.resources%ROWTYPE;
  v_expected_price NUMERIC(10,2);
  v_effective_title TEXT;
  v_clean_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;

  v_rec RECORD;
  v_existing_pur_by_pay public.resource_purchases%ROWTYPE;
  v_existing_pur_by_ord public.resource_purchases%ROWTYPE;
  v_pur_by_pay_cnt INTEGER := 0;
  v_pur_by_ord_cnt INTEGER := 0;

  v_existing_pay_by_pay public.payments%ROWTYPE;
  v_existing_pay_by_ord public.payments%ROWTYPE;
  v_pay_by_pay_cnt INTEGER := 0;
  v_pay_by_ord_cnt INTEGER := 0;

  v_existing_user_pur public.resource_purchases%ROWTYPE;

  v_purchase public.resource_purchases%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_has_purchase BOOLEAN := false;
  v_has_payment BOOLEAN := false;

  v_existing_lead_id TEXT;
  v_crm_id_type TEXT;
  v_crm_lead_uuid UUID;
  v_crm_lead_text TEXT;
  v_lead_status TEXT := 'skipped';

  v_diag_constraint TEXT;
  v_diag_message TEXT;
BEGIN
  -- 1. Strict input validation
  v_clean_order_id := pg_catalog.btrim(COALESCE(p_order_id, ''), E' \t\n\r\f\v');
  v_clean_payment_id := pg_catalog.btrim(COALESCE(p_payment_id, ''), E' \t\n\r\f\v');

  IF p_resource_id IS NULL OR pg_catalog.length(v_clean_order_id) = 0 OR pg_catalog.length(v_clean_payment_id) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_PARAMETERS',
      'error', 'Valid resource_id, order_id, and payment_id are required for resource fulfillment.'
    );
  END IF;

  IF p_currency IS NULL OR pg_catalog.btrim(p_currency, E' \t\n\r\f\v') = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_CURRENCY',
      'error', 'Currency is mandatory and must be INR.'
    );
  END IF;

  v_currency := pg_catalog.upper(pg_catalog.btrim(p_currency, E' \t\n\r\f\v'));
  IF v_currency IS DISTINCT FROM 'INR' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_CURRENCY',
      'error', pg_catalog.format('Unsupported currency %s. Only INR resource payments are accepted.', v_currency)
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

  -- Serialize concurrent calls for the same payment_id / order_id / user+resource
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_res_pay:' || v_clean_payment_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_res_ord:' || v_clean_order_id, 0));
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fulfill_res_usr:' || p_user_id::TEXT || ':' || p_resource_id::TEXT, 0));
  END IF;

  -- 2. Authoritative catalog, published status & INR price verification (FOR SHARE)
  SELECT * INTO v_resource
  FROM public.resources
  WHERE id = p_resource_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'RESOURCE_NOT_FOUND',
      'error', 'Resource record was not found in authoritative catalog.'
    );
  END IF;

  IF pg_catalog.lower(pg_catalog.btrim(COALESCE(v_resource.status, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'published' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'RESOURCE_UNAVAILABLE',
      'error', 'Resource is not published and cannot be fulfilled.'
    );
  END IF;

  IF pg_catalog.lower(pg_catalog.btrim(COALESCE(v_resource.access_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'paid'
     OR v_resource.price IS NULL
     OR v_resource.price = 'NaN'::NUMERIC
     OR v_resource.price <= 0
     OR v_resource.price > 99999999.99
     OR pg_catalog.round(v_resource.price, 2) IS DISTINCT FROM v_resource.price
     OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_resource.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'INVALID_RESOURCE_PRICING',
      'error', 'Resource is not configured as an active paid INR product.'
    );
  END IF;

  v_expected_price := pg_catalog.round(v_resource.price, 2)::NUMERIC(10,2);

  IF p_amount IS NULL
     OR p_amount = 'NaN'::NUMERIC
     OR p_amount <= 0
     OR p_amount > 99999999.99
     OR pg_catalog.round(p_amount, 2) IS DISTINCT FROM p_amount
     OR p_amount IS DISTINCT FROM v_expected_price THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'AMOUNT_MISMATCH',
      'error', pg_catalog.format('Amount mismatch: expected INR %s, received %s.', v_expected_price, COALESCE(p_amount::TEXT, 'NULL'))
    );
  END IF;

  v_effective_title := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_resource_title, ''), E' \t\n\r\f\v'), ''),
    v_resource.title,
    'Digital Resource Toolkit'
  );
  v_clean_name := NULLIF(pg_catalog.btrim(COALESCE(p_customer_name, ''), E' \t\n\r\f\v'), '');
  v_clean_email := NULLIF(pg_catalog.lower(pg_catalog.btrim(COALESCE(p_customer_email, ''), E' \t\n\r\f\v')), '');
  v_clean_phone := NULLIF(pg_catalog.btrim(COALESCE(p_customer_phone, ''), E' \t\n\r\f\v'), '');

  -- 3. Lock & inspect existing records in BOTH tables separately (zero OR ambiguity)
  FOR v_rec IN SELECT * FROM public.resource_purchases WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
    v_pur_by_pay_cnt := v_pur_by_pay_cnt + 1;
    IF v_pur_by_pay_cnt = 1 THEN v_existing_pur_by_pay := v_rec; END IF;
  END LOOP;

  FOR v_rec IN SELECT * FROM public.resource_purchases WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
    v_pur_by_ord_cnt := v_pur_by_ord_cnt + 1;
    IF v_pur_by_ord_cnt = 1 THEN v_existing_pur_by_ord := v_rec; END IF;
  END LOOP;

  FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
    v_pay_by_pay_cnt := v_pay_by_pay_cnt + 1;
    IF v_pay_by_pay_cnt = 1 THEN v_existing_pay_by_pay := v_rec; END IF;
  END LOOP;

  FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
    v_pay_by_ord_cnt := v_pay_by_ord_cnt + 1;
    IF v_pay_by_ord_cnt = 1 THEN v_existing_pay_by_ord := v_rec; END IF;
  END LOOP;

  IF v_pur_by_pay_cnt > 1 OR v_pur_by_ord_cnt > 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Multiple resource purchase rows matched payment_id or order_id.'
    );
  END IF;

  IF v_pay_by_pay_cnt > 1 OR v_pay_by_ord_cnt > 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Multiple payment ledger rows matched payment_id or order_id.'
    );
  END IF;

  IF v_existing_pur_by_pay.id IS NOT NULL
     AND v_existing_pur_by_ord.id IS NOT NULL
     AND v_existing_pur_by_pay.id IS DISTINCT FROM v_existing_pur_by_ord.id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Payment ID and Order ID resolve to different resource_purchases records.'
    );
  END IF;

  IF v_existing_pay_by_pay.id IS NOT NULL
     AND v_existing_pay_by_ord.id IS NOT NULL
     AND v_existing_pay_by_pay.id IS DISTINCT FROM v_existing_pay_by_ord.id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Payment ID and Order ID resolve to different payment ledger records.'
    );
  END IF;

  IF v_existing_pur_by_ord.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_existing_pur_by_ord.razorpay_payment_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_payment_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing resource purchase for this order_id is bound to a different payment_id.'
    );
  END IF;

  IF v_existing_pur_by_pay.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_existing_pur_by_pay.razorpay_order_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_order_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing resource purchase for this payment_id is bound to a different order_id.'
    );
  END IF;

  IF v_existing_pay_by_ord.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_existing_pay_by_ord.razorpay_payment_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_payment_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing payment ledger record for this order_id is bound to a different payment_id.'
    );
  END IF;

  IF v_existing_pay_by_pay.id IS NOT NULL
     AND pg_catalog.btrim(COALESCE(v_existing_pay_by_pay.razorpay_order_id, ''), E' \t\n\r\f\v') IS DISTINCT FROM v_clean_order_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Existing payment ledger record for this payment_id is bound to a different order_id.'
    );
  END IF;

  IF v_existing_pur_by_pay.id IS NOT NULL THEN
    v_purchase := v_existing_pur_by_pay;
    v_has_purchase := true;
  ELSIF v_existing_pur_by_ord.id IS NOT NULL THEN
    v_purchase := v_existing_pur_by_ord;
    v_has_purchase := true;
  END IF;

  IF v_existing_pay_by_pay.id IS NOT NULL THEN
    v_payment := v_existing_pay_by_pay;
    v_has_payment := true;
  ELSIF v_existing_pay_by_ord.id IS NOT NULL THEN
    v_payment := v_existing_pay_by_ord;
    v_has_payment := true;
  END IF;

  -- 4. Validate all invariants including strict scale/NaN and symmetric user_id ownership
  IF v_has_purchase THEN
    IF v_purchase.razorpay_order_id IS DISTINCT FROM v_clean_order_id
       OR v_purchase.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
       OR v_purchase.resource_id IS DISTINCT FROM v_resource.id
       OR v_purchase.amount IS NULL
       OR v_purchase.amount = 'NaN'::NUMERIC
       OR pg_catalog.round(v_purchase.amount, 2) IS DISTINCT FROM v_purchase.amount
       OR v_purchase.amount IS DISTINCT FROM v_expected_price
       OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_purchase.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_purchase.status, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'active'
       OR v_purchase.user_id IS DISTINCT FROM p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'error', 'Existing resource_purchases record conflicts with order, payment, resource, currency, user ownership, status, or amount.'
      );
    END IF;
  END IF;

  IF v_has_payment THEN
    IF v_payment.razorpay_order_id IS DISTINCT FROM v_clean_order_id
       OR v_payment.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_payment.item_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'resource'
       OR NULLIF(pg_catalog.btrim(COALESCE(v_payment.item_id::TEXT, ''), E' \t\n\r\f\v'), '') IS DISTINCT FROM v_resource.id::TEXT
       OR v_payment.amount IS NULL
       OR v_payment.amount = 'NaN'::NUMERIC
       OR pg_catalog.round(v_payment.amount, 2) IS DISTINCT FROM v_payment.amount
       OR v_payment.amount IS DISTINCT FROM v_expected_price
       OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_payment.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_payment.status, ''), E' \t\n\r\f\v')) NOT IN ('captured', 'paid')
       OR v_payment.user_id IS DISTINCT FROM p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'error', 'Existing payment ledger record conflicts with order, payment, resource, item type, currency, user ownership, status, or amount.'
      );
    END IF;
  END IF;

  -- Explicit pre-check for duplicate active authenticated user+resource purchase under a DIFFERENT order/payment
  -- Aligned with uq_user_resource_purchase partial index (revoked buyers may repurchase)
  IF NOT v_has_purchase AND p_user_id IS NOT NULL THEN
    SELECT * INTO v_existing_user_pur
    FROM public.resource_purchases
    WHERE user_id = p_user_id
      AND resource_id = v_resource.id
      AND status = 'active'
    FOR UPDATE;

    IF v_existing_user_pur.id IS NOT NULL
       AND (v_existing_user_pur.razorpay_order_id IS DISTINCT FROM v_clean_order_id
            OR v_existing_user_pur.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id) THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'DUPLICATE_USER_RESOURCE_PURCHASE',
        'error', 'Authenticated user already owns an active purchase for this resource under a different transaction.'
      );
    END IF;
  END IF;

  -- 5A. Case A: Both records exist and match all invariants
  IF v_has_purchase AND v_has_payment THEN
    IF v_payment.invoice_number IS NOT NULL
       AND (v_purchase.invoice_number IS NULL OR pg_catalog.btrim(v_purchase.invoice_number, E' \t\n\r\f\v') = '') THEN
      UPDATE public.resource_purchases
      SET invoice_number = v_payment.invoice_number
      WHERE id = v_purchase.id
      RETURNING * INTO v_purchase;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_ledger', false,
      'healed_purchase', false,
      'purchase', pg_catalog.row_to_json(v_purchase),
      'payment', pg_catalog.row_to_json(v_payment),
      'lead_status', 'already_exists',
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id,
      'resource_id', v_resource.id
    );
  END IF;

  -- 5B. Case B: Payment exists, resource_purchases missing -> heal purchase inside subtransaction
  IF v_has_payment AND NOT v_has_purchase THEN
    BEGIN
      INSERT INTO public.resource_purchases (
        user_id, customer_email, customer_phone, resource_id,
        razorpay_order_id, razorpay_payment_id, amount, currency,
        status, invoice_number, purchased_at, created_at
      ) VALUES (
        p_user_id, v_clean_email, v_clean_phone, v_resource.id,
        v_clean_order_id, v_clean_payment_id, v_expected_price, 'INR',
        'active', v_payment.invoice_number, pg_catalog.now(), pg_catalog.now()
      )
      RETURNING * INTO v_purchase;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_diag_constraint = CONSTRAINT_NAME, v_diag_message = MESSAGE_TEXT;
      IF v_diag_constraint = 'uq_user_resource_purchase' OR v_diag_message LIKE '%uq_user_resource_purchase%' THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'DUPLICATE_USER_RESOURCE_PURCHASE',
          'error', 'Authenticated user already owns a purchase for this resource.'
        );
      END IF;

      v_existing_pur_by_pay := NULL;
      v_existing_pur_by_ord := NULL;
      v_pur_by_pay_cnt := 0;
      v_pur_by_ord_cnt := 0;

      FOR v_rec IN SELECT * FROM public.resource_purchases WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
        v_pur_by_pay_cnt := v_pur_by_pay_cnt + 1;
        IF v_pur_by_pay_cnt = 1 THEN v_existing_pur_by_pay := v_rec; END IF;
      END LOOP;

      FOR v_rec IN SELECT * FROM public.resource_purchases WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
        v_pur_by_ord_cnt := v_pur_by_ord_cnt + 1;
        IF v_pur_by_ord_cnt = 1 THEN v_existing_pur_by_ord := v_rec; END IF;
      END LOOP;

      IF v_pur_by_pay_cnt > 1 OR v_pur_by_ord_cnt > 1
         OR (v_existing_pur_by_pay.id IS NOT NULL AND v_existing_pur_by_ord.id IS NOT NULL AND v_existing_pur_by_pay.id IS DISTINCT FROM v_existing_pur_by_ord.id) THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'IDEMPOTENCY_CONFLICT',
          'error', 'Concurrent resource purchase insertion resolved ambiguously across payment_id and order_id.'
        );
      END IF;

      IF v_existing_pur_by_pay.id IS NOT NULL THEN
        v_purchase := v_existing_pur_by_pay;
      ELSE
        v_purchase := v_existing_pur_by_ord;
      END IF;

      IF v_purchase.id IS NULL
         OR v_purchase.razorpay_order_id IS DISTINCT FROM v_clean_order_id
         OR v_purchase.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
         OR v_purchase.resource_id IS DISTINCT FROM v_resource.id
         OR v_purchase.amount IS NULL
         OR v_purchase.amount = 'NaN'::NUMERIC
         OR pg_catalog.round(v_purchase.amount, 2) IS DISTINCT FROM v_purchase.amount
         OR v_purchase.amount IS DISTINCT FROM v_expected_price
         OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_purchase.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_purchase.status, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'active'
         OR v_purchase.user_id IS DISTINCT FROM p_user_id THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'IDEMPOTENCY_CONFLICT',
          'error', 'Concurrent resource purchase insertion conflicted with transaction invariants.'
        );
      END IF;
    END;

    IF v_payment.invoice_number IS NOT NULL
       AND (v_purchase.invoice_number IS NULL OR pg_catalog.btrim(v_purchase.invoice_number, E' \t\n\r\f\v') = '') THEN
      UPDATE public.resource_purchases
      SET invoice_number = v_payment.invoice_number
      WHERE id = v_purchase.id
      RETURNING * INTO v_purchase;
    END IF;

    -- Ensure CRM lead exists idempotently
    IF v_clean_email IS NOT NULL OR v_clean_name IS NOT NULL THEN
      SELECT id::TEXT INTO v_existing_lead_id
      FROM public.crm_leads
      WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, v_clean_payment_id) > 0
      LIMIT 1;

      IF v_existing_lead_id IS NOT NULL THEN
        v_lead_status := 'already_exists';
      ELSE
        SELECT data_type INTO v_crm_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'id';

        IF v_crm_id_type = 'uuid' THEN
          v_crm_lead_uuid := pg_catalog.gen_random_uuid();
          EXECUTE $crm_uuid_rb$
            INSERT INTO public.crm_leads (
              id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
          $crm_uuid_rb$
          USING
            v_crm_lead_uuid,
            COALESCE(v_clean_name, 'Resource Buyer'),
            COALESCE(v_clean_email, ''),
            v_clean_phone,
            'Resource Purchase (Paid)',
            'Purchased: ' || v_effective_title,
            'Paid INR ' || v_expected_price::TEXT || '. Order: ' || v_clean_order_id || ', Payment: ' || v_clean_payment_id,
            'Converted',
            v_expected_price,
            pg_catalog.now(),
            pg_catalog.now();
          v_existing_lead_id := v_crm_lead_uuid::TEXT;
        ELSE
          v_crm_lead_text := 'lead_' || pg_catalog.gen_random_uuid()::TEXT;
          EXECUTE $crm_text_rb$
            INSERT INTO public.crm_leads (
              id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
          $crm_text_rb$
          USING
            v_crm_lead_text,
            COALESCE(v_clean_name, 'Resource Buyer'),
            COALESCE(v_clean_email, ''),
            v_clean_phone,
            'Resource Purchase (Paid)',
            'Purchased: ' || v_effective_title,
            'Paid INR ' || v_expected_price::TEXT || '. Order: ' || v_clean_order_id || ', Payment: ' || v_clean_payment_id,
            'Converted',
            v_expected_price,
            pg_catalog.now(),
            pg_catalog.now();
          v_existing_lead_id := v_crm_lead_text;
        END IF;
        v_lead_status := 'saved';
      END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_ledger', false,
      'healed_purchase', true,
      'purchase', pg_catalog.row_to_json(v_purchase),
      'payment', pg_catalog.row_to_json(v_payment),
      'lead_status', v_lead_status,
      'lead_id', v_existing_lead_id,
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id,
      'resource_id', v_resource.id
    );
  END IF;

  -- 5C. Case C: Purchase exists, payment ledger missing -> heal payment inside subtransaction
  IF v_has_purchase AND NOT v_has_payment THEN
    BEGIN
      INSERT INTO public.payments (
        user_id, item_type, item_id, item_title, amount, currency,
        razorpay_order_id, razorpay_payment_id, status, created_at
      ) VALUES (
        p_user_id, 'resource', v_resource.id, v_effective_title,
        v_expected_price, 'INR', v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
      )
      RETURNING * INTO v_payment;
    EXCEPTION WHEN unique_violation THEN
      v_existing_pay_by_pay := NULL;
      v_existing_pay_by_ord := NULL;
      v_pay_by_pay_cnt := 0;
      v_pay_by_ord_cnt := 0;

      FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
        v_pay_by_pay_cnt := v_pay_by_pay_cnt + 1;
        IF v_pay_by_pay_cnt = 1 THEN v_existing_pay_by_pay := v_rec; END IF;
      END LOOP;

      FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
        v_pay_by_ord_cnt := v_pay_by_ord_cnt + 1;
        IF v_pay_by_ord_cnt = 1 THEN v_existing_pay_by_ord := v_rec; END IF;
      END LOOP;

      IF v_pay_by_pay_cnt > 1 OR v_pay_by_ord_cnt > 1
         OR (v_existing_pay_by_pay.id IS NOT NULL AND v_existing_pay_by_ord.id IS NOT NULL AND v_existing_pay_by_pay.id IS DISTINCT FROM v_existing_pay_by_ord.id) THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'IDEMPOTENCY_CONFLICT',
          'error', 'Concurrent payment insertion resolved ambiguously across payment_id and order_id.'
        );
      END IF;

      IF v_existing_pay_by_pay.id IS NOT NULL THEN
        v_payment := v_existing_pay_by_pay;
      ELSE
        v_payment := v_existing_pay_by_ord;
      END IF;

      IF v_payment.id IS NULL
         OR v_payment.razorpay_order_id IS DISTINCT FROM v_clean_order_id
         OR v_payment.razorpay_payment_id IS DISTINCT FROM v_clean_payment_id
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_payment.item_type, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'resource'
         OR NULLIF(pg_catalog.btrim(COALESCE(v_payment.item_id::TEXT, ''), E' \t\n\r\f\v'), '') IS DISTINCT FROM v_resource.id::TEXT
         OR v_payment.amount IS NULL
         OR v_payment.amount = 'NaN'::NUMERIC
         OR pg_catalog.round(v_payment.amount, 2) IS DISTINCT FROM v_payment.amount
         OR v_payment.amount IS DISTINCT FROM v_expected_price
         OR pg_catalog.upper(pg_catalog.btrim(COALESCE(v_payment.currency, ''), E' \t\n\r\f\v')) IS DISTINCT FROM 'INR'
         OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_payment.status, ''), E' \t\n\r\f\v')) NOT IN ('captured', 'paid')
         OR v_payment.user_id IS DISTINCT FROM p_user_id THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'code', 'IDEMPOTENCY_CONFLICT',
          'error', 'Concurrent payment insertion conflicted with transaction invariants.'
        );
      END IF;
    END;

    IF v_payment.invoice_number IS NOT NULL
       AND (v_purchase.invoice_number IS NULL OR pg_catalog.btrim(v_purchase.invoice_number, E' \t\n\r\f\v') = '') THEN
      UPDATE public.resource_purchases
      SET invoice_number = v_payment.invoice_number
      WHERE id = v_purchase.id
      RETURNING * INTO v_purchase;
    END IF;

    -- Ensure CRM lead exists idempotently
    IF v_clean_email IS NOT NULL OR v_clean_name IS NOT NULL THEN
      SELECT id::TEXT INTO v_existing_lead_id
      FROM public.crm_leads
      WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, v_clean_payment_id) > 0
      LIMIT 1;

      IF v_existing_lead_id IS NOT NULL THEN
        v_lead_status := 'already_exists';
      ELSE
        SELECT data_type INTO v_crm_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'id';

        IF v_crm_id_type = 'uuid' THEN
          v_crm_lead_uuid := pg_catalog.gen_random_uuid();
          EXECUTE $crm_uuid_rc$
            INSERT INTO public.crm_leads (
              id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
          $crm_uuid_rc$
          USING
            v_crm_lead_uuid,
            COALESCE(v_clean_name, 'Resource Buyer'),
            COALESCE(v_clean_email, ''),
            v_clean_phone,
            'Resource Purchase (Paid)',
            'Purchased: ' || v_effective_title,
            'Paid INR ' || v_expected_price::TEXT || '. Order: ' || v_clean_order_id || ', Payment: ' || v_clean_payment_id,
            'Converted',
            v_expected_price,
            pg_catalog.now(),
            pg_catalog.now();
          v_existing_lead_id := v_crm_lead_uuid::TEXT;
        ELSE
          v_crm_lead_text := 'lead_' || pg_catalog.gen_random_uuid()::TEXT;
          EXECUTE $crm_text_rc$
            INSERT INTO public.crm_leads (
              id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
          $crm_text_rc$
          USING
            v_crm_lead_text,
            COALESCE(v_clean_name, 'Resource Buyer'),
            COALESCE(v_clean_email, ''),
            v_clean_phone,
            'Resource Purchase (Paid)',
            'Purchased: ' || v_effective_title,
            'Paid INR ' || v_expected_price::TEXT || '. Order: ' || v_clean_order_id || ', Payment: ' || v_clean_payment_id,
            'Converted',
            v_expected_price,
            pg_catalog.now(),
            pg_catalog.now();
          v_existing_lead_id := v_crm_lead_text;
        END IF;
        v_lead_status := 'saved';
      END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'fulfilled', true,
      'already_fulfilled', true,
      'healed_ledger', true,
      'healed_purchase', false,
      'purchase', pg_catalog.row_to_json(v_purchase),
      'payment', pg_catalog.row_to_json(v_payment),
      'lead_status', v_lead_status,
      'lead_id', v_existing_lead_id,
      'order_id', v_clean_order_id,
      'payment_id', v_clean_payment_id,
      'resource_id', v_resource.id
    );
  END IF;

  -- 5D. Case D: Fresh atomic fulfillment across payments, resource_purchases, and crm_leads
  BEGIN
    INSERT INTO public.payments (
      user_id, item_type, item_id, item_title, amount, currency,
      razorpay_order_id, razorpay_payment_id, status, created_at
    ) VALUES (
      p_user_id, 'resource', v_resource.id, v_effective_title,
      v_expected_price, 'INR', v_clean_order_id, v_clean_payment_id, 'captured', pg_catalog.now()
    )
    RETURNING * INTO v_payment;
  EXCEPTION WHEN unique_violation THEN
    v_existing_pay_by_pay := NULL;
    v_existing_pay_by_ord := NULL;
    v_existing_pur_by_pay := NULL;
    v_existing_pur_by_ord := NULL;
    v_pay_by_pay_cnt := 0;
    v_pay_by_ord_cnt := 0;
    v_pur_by_pay_cnt := 0;
    v_pur_by_ord_cnt := 0;

    FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
      v_pay_by_pay_cnt := v_pay_by_pay_cnt + 1;
      IF v_pay_by_pay_cnt = 1 THEN v_existing_pay_by_pay := v_rec; END IF;
    END LOOP;
    FOR v_rec IN SELECT * FROM public.payments WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
      v_pay_by_ord_cnt := v_pay_by_ord_cnt + 1;
      IF v_pay_by_ord_cnt = 1 THEN v_existing_pay_by_ord := v_rec; END IF;
    END LOOP;
    FOR v_rec IN SELECT * FROM public.resource_purchases WHERE razorpay_payment_id = v_clean_payment_id FOR UPDATE LOOP
      v_pur_by_pay_cnt := v_pur_by_pay_cnt + 1;
      IF v_pur_by_pay_cnt = 1 THEN v_existing_pur_by_pay := v_rec; END IF;
    END LOOP;
    FOR v_rec IN SELECT * FROM public.resource_purchases WHERE razorpay_order_id = v_clean_order_id FOR UPDATE LOOP
      v_pur_by_ord_cnt := v_pur_by_ord_cnt + 1;
      IF v_pur_by_ord_cnt = 1 THEN v_existing_pur_by_ord := v_rec; END IF;
    END LOOP;

    IF v_pay_by_pay_cnt > 1 OR v_pay_by_ord_cnt > 1 OR v_pur_by_pay_cnt > 1 OR v_pur_by_ord_cnt > 1
       OR (v_existing_pay_by_pay.id IS NOT NULL AND v_existing_pay_by_ord.id IS NOT NULL AND v_existing_pay_by_pay.id IS DISTINCT FROM v_existing_pay_by_ord.id)
       OR (v_existing_pur_by_pay.id IS NOT NULL AND v_existing_pur_by_ord.id IS NOT NULL AND v_existing_pur_by_pay.id IS DISTINCT FROM v_existing_pur_by_ord.id) THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'error', 'Concurrent resource records resolved ambiguously across payment_id and order_id.'
      );
    END IF;

    IF v_existing_pay_by_pay.id IS NOT NULL THEN
      v_payment := v_existing_pay_by_pay;
    ELSE
      v_payment := v_existing_pay_by_ord;
    END IF;

    IF v_existing_pur_by_pay.id IS NOT NULL THEN
      v_purchase := v_existing_pur_by_pay;
    ELSE
      v_purchase := v_existing_pur_by_ord;
    END IF;

    IF v_payment.id IS NOT NULL
       AND v_purchase.id IS NOT NULL
       AND v_payment.razorpay_order_id IS NOT DISTINCT FROM v_clean_order_id
       AND v_payment.razorpay_payment_id IS NOT DISTINCT FROM v_clean_payment_id
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_payment.item_type, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'resource'
       AND NULLIF(pg_catalog.btrim(COALESCE(v_payment.item_id::TEXT, ''), E' \t\n\r\f\v'), '') IS NOT DISTINCT FROM v_resource.id::TEXT
       AND v_payment.amount IS NOT NULL
       AND v_payment.amount <> 'NaN'::NUMERIC
       AND pg_catalog.round(v_payment.amount, 2) IS NOT DISTINCT FROM v_payment.amount
       AND v_payment.amount IS NOT DISTINCT FROM v_expected_price
       AND pg_catalog.upper(pg_catalog.btrim(COALESCE(v_payment.currency, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'INR'
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_payment.status, ''), E' \t\n\r\f\v')) IN ('captured', 'paid')
       AND v_payment.user_id IS NOT DISTINCT FROM p_user_id
       AND v_purchase.razorpay_order_id IS NOT DISTINCT FROM v_clean_order_id
       AND v_purchase.razorpay_payment_id IS NOT DISTINCT FROM v_clean_payment_id
       AND v_purchase.resource_id IS NOT DISTINCT FROM v_resource.id
       AND v_purchase.amount IS NOT NULL
       AND v_purchase.amount <> 'NaN'::NUMERIC
       AND pg_catalog.round(v_purchase.amount, 2) IS NOT DISTINCT FROM v_purchase.amount
       AND v_purchase.amount IS NOT DISTINCT FROM v_expected_price
       AND pg_catalog.upper(pg_catalog.btrim(COALESCE(v_purchase.currency, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'INR'
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(v_purchase.status, ''), E' \t\n\r\f\v')) IS NOT DISTINCT FROM 'active'
       AND v_purchase.user_id IS NOT DISTINCT FROM p_user_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'fulfilled', true,
        'already_fulfilled', true,
        'concurrency_deduplicated', true,
        'purchase', pg_catalog.row_to_json(v_purchase),
        'payment', pg_catalog.row_to_json(v_payment),
        'lead_status', 'already_exists',
        'order_id', v_clean_order_id,
        'payment_id', v_clean_payment_id,
        'resource_id', v_resource.id
      );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'code', 'IDEMPOTENCY_CONFLICT',
      'error', 'Concurrent payment record violates resource purchase invariants.'
    );
  END;

  BEGIN
    INSERT INTO public.resource_purchases (
      user_id, customer_email, customer_phone, resource_id,
      razorpay_order_id, razorpay_payment_id, amount, currency,
      status, invoice_number, purchased_at, created_at
    ) VALUES (
      p_user_id, v_clean_email, v_clean_phone, v_resource.id,
      v_clean_order_id, v_clean_payment_id, v_expected_price, 'INR',
      'active', v_payment.invoice_number, pg_catalog.now(), pg_catalog.now()
    )
    RETURNING * INTO v_purchase;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_diag_constraint = CONSTRAINT_NAME, v_diag_message = MESSAGE_TEXT;
    IF v_diag_constraint = 'uq_user_resource_purchase' OR v_diag_message LIKE '%uq_user_resource_purchase%' THEN
      RAISE EXCEPTION 'DUPLICATE_USER_RESOURCE_PURCHASE: Authenticated user already owns an active purchase for this resource.';
    END IF;

    -- Roll back outer payments insert atomically if any unexpected unique_violation occurs
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Concurrent resource_purchases insertion prevented atomic completion (%).',
      COALESCE(v_diag_constraint, v_diag_message);
  END;

  -- Atomic CRM lead synchronization (no swallowed exceptions; supports uuid or text crm_leads.id)
  IF v_clean_email IS NOT NULL OR v_clean_name IS NOT NULL THEN
    SELECT id::TEXT INTO v_existing_lead_id
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
          COALESCE(v_clean_name, 'Resource Buyer'),
          COALESCE(v_clean_email, ''),
          v_clean_phone,
          'Resource Purchase (Paid)',
          'Purchased: ' || v_effective_title,
          'Paid INR ' || v_expected_price::TEXT || '. Order: ' || v_clean_order_id || ', Payment: ' || v_clean_payment_id,
          'Converted',
          v_expected_price,
          pg_catalog.now(),
          pg_catalog.now();
        v_existing_lead_id := v_crm_lead_uuid::TEXT;
      ELSE
        v_crm_lead_text := 'lead_' || pg_catalog.gen_random_uuid()::TEXT;
        EXECUTE $crm_text$
          INSERT INTO public.crm_leads (
            id, name, email, phone, source, interest, notes, status, amount, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
        $crm_text$
        USING
          v_crm_lead_text,
          COALESCE(v_clean_name, 'Resource Buyer'),
          COALESCE(v_clean_email, ''),
          v_clean_phone,
          'Resource Purchase (Paid)',
          'Purchased: ' || v_effective_title,
          'Paid INR ' || v_expected_price::TEXT || '. Order: ' || v_clean_order_id || ', Payment: ' || v_clean_payment_id,
          'Converted',
          v_expected_price,
          pg_catalog.now(),
          pg_catalog.now();
        v_existing_lead_id := v_crm_lead_text;
      END IF;
      v_lead_status := 'saved';
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'fulfilled', true,
    'already_fulfilled', false,
    'healed_ledger', false,
    'healed_purchase', false,
    'purchase', pg_catalog.row_to_json(v_purchase),
    'payment', pg_catalog.row_to_json(v_payment),
    'lead_status', v_lead_status,
    'lead_id', v_existing_lead_id,
    'order_id', v_clean_order_id,
    'payment_id', v_clean_payment_id,
    'resource_id', v_resource.id
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.fulfill_resource_purchase(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fulfill_resource_purchase(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_resource_purchase(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
