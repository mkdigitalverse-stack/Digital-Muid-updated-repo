-- ==============================================================================
-- DIGITALMUID V4.3 — P0-3 STEP A: HARDEN RESOURCES ACCESS, ADMIN VERIFICATION,
-- PUBLIC_RESOURCES VIEW & ATOMIC PERSISTENT FREE-DOWNLOAD COUNTER
-- Migration: 20261121000001_p0_3a_harden_resources_and_free_downloads.sql
-- ==============================================================================
-- STRICT SCOPE:
--   Atomic PostgreSQL database migration ONLY (public schema objects & grants).
--   Supabase Storage bucket/object policy changes are strictly separated into:
--     supabase/operations/p0_3b_private_paid_resources_storage.sql
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. FAIL-CLOSED POLICY INVENTORY ON public.resources
--    Never blindly drop unknown policies. Verify the exact existing policy set
--    against the approved allowlist and abort the entire transaction if any
--    unexpected policy is present.
-- ==============================================================================
DO $$
DECLARE
  v_allowed_policies CONSTANT TEXT[] := ARRAY[
    'Public Read Published Resources',
    'Admin All Resources'
  ];
  v_unexpected_policies TEXT;
BEGIN
  SELECT pg_catalog.string_agg(p.policyname, ', ' ORDER BY p.policyname)
    INTO v_unexpected_policies
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = 'resources'
    AND NOT (p.policyname = ANY (v_allowed_policies));

  IF v_unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = pg_catalog.format(
        'P0-3A FAIL-CLOSED ABORT: Unexpected RLS policies detected on public.resources: [%s]. Review and reconcile before applying migration.',
        v_unexpected_policies
      );
  END IF;
END $$;

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Remove ONLY the intentionally replaced policies
DROP POLICY IF EXISTS "Public Read Published Resources" ON public.resources;
DROP POLICY IF EXISTS "Admin All Resources" ON public.resources;

-- Base table privileges:
--   - PUBLIC / anon: NO direct base-table SELECT/INSERT/UPDATE/DELETE privileges.
--   - authenticated: Table privileges retained solely so confirmed admins can use
--     the Admin CMS; non-admins and unconfirmed admins are strictly blocked by RLS.
--   - service_role / postgres: Full server-side access preserved.
REVOKE ALL ON TABLE public.resources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resources TO authenticated;
GRANT ALL ON TABLE public.resources TO service_role, postgres;

-- ==============================================================================
-- 2. REMOVE LEGACY CLIENT-CALLABLE DOWNLOAD COUNTER RPC
-- ==============================================================================
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.increment_resource_downloads(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.increment_resource_downloads(UUID) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.increment_resource_downloads(UUID);

-- ==============================================================================
-- 3. HARDEN public.is_admin() — REQUIRE auth.users.email_confirmed_at IS NOT NULL
--    FOR ALL ADMIN AUTHORIZATION PATHS (BOTH app_metadata.role AND EMAIL ALLOWLIST)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_app_meta JSONB;
BEGIN
  -- Short-circuit immediately for anon or unauthenticated sessions without
  -- reading auth.users. Required so anon RLS evaluations on public catalog
  -- tables (articles, videos, frameworks, courses, consultation_products)
  -- always evaluate cleanly and safely to FALSE.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN FALSE;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT
    pg_catalog.lower(pg_catalog.btrim(COALESCE(u.email, ''))),
    u.email_confirmed_at,
    COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  INTO
    v_email,
    v_email_confirmed_at,
    v_app_meta
  FROM auth.users u
  WHERE u.id = v_uid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mandatory email confirmation gate for ALL admin authorization paths
  IF v_email_confirmed_at IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Path 1: Service-managed app_metadata role (never raw_user_meta_data)
  IF (v_app_meta ->> 'role') = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Path 2: Explicitly allowlisted, verified admin emails
  IF v_email IN ('mkdigitalverse@gmail.com', 'admin@digitalmuid.com') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

ALTER FUNCTION public.is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
-- NOTE: GRANT EXECUTE TO anon is intentionally retained because existing catalog
-- tables (articles, videos, frameworks, courses, consultation_products,
-- framework_categories) evaluate `USING (status = 'published' OR public.is_admin())`
-- during anon reads. public.is_admin() returns FALSE immediately when
-- auth.role() IS DISTINCT FROM 'authenticated'.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role, postgres;

-- Recreate admin-only policy on public.resources referencing the hardened is_admin()
CREATE POLICY "Admin All Resources"
  ON public.resources
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ==============================================================================
-- 4. PROTECTED RESOURCE URL CLASSIFIER (USED BY public_resources VIEW)
--    Redacts Supabase Storage URLs, protected/paid paths, server download
--    endpoints, path traversal, control characters, and known paid product
--    identifiers — including single/multi-layer percent-encoded variants —
--    while preserving legitimate free static public downloads
--    (/downloads/*.pdf, /downloads/*.xlsx, and safe encoded spaces/UTF-8).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_protected_resource_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_cand TEXT;
  v_decoded TEXT;
  v_round INTEGER;
  v_len INTEGER;
  v_pos INTEGER;
  v_ch TEXT;
  v_hex TEXT;
  v_byte INTEGER;
BEGIN
  v_cand := pg_catalog.btrim(p_url);
  IF v_cand = '' THEN
    RETURN FALSE;
  END IF;

  -- Bounded iterative decoding (up to 3 rounds) to neutralize percent-encoded
  -- evasion (e.g. /%70rotected_downloads/, /%2570aid/, /storage/v1/object%2f)
  -- without breaking legitimate free URLs (/downloads/My%20Free%20Guide.pdf).
  FOR v_round IN 1..3 LOOP
    -- Raw/decoded control characters, backslashes, or traversal segments fail closed
    IF v_cand ~ '[\x00-\x1f\x7f\\]'
       OR v_cand ~* '%(?:[01][0-9a-f]|7f|5c)'
       OR v_cand ~ '(^|/)\.\.(/|$)' THEN
      RETURN TRUE;
    END IF;

    IF v_cand ~* '^supabase://'
       OR v_cand ~* '/storage/v1/object/'
       OR v_cand ~* '(^|/)protected_downloads(/|$)'
       OR v_cand ~* '(^|/)paid-resources(/|$)'
       OR v_cand ~* '(^|/)paid(/|$)'
       OR v_cand ~* '(^|/)private(/|$)'
       OR v_cand ~* '/api/payments/download-paid-asset'
       OR v_cand ~* '(meta-ads-campaign-planner-workbook|the-ad-budget-break-even-calculator|the-ad-budget-breat-even-calculate|10-high-converting-meta-ads-copy-frameworks|pre-launch-tracking-audit-checklist|meta-ads-campaign-planner-bundle)' THEN
      RETURN TRUE;
    END IF;

    -- Stop decoding if no ASCII percent-encoded sequences remain
    IF v_cand !~ '%[0-7][0-9A-Fa-f]' THEN
      EXIT;
    END IF;

    v_decoded := '';
    v_len := pg_catalog.length(v_cand);
    v_pos := 1;

    WHILE v_pos <= v_len LOOP
      v_ch := pg_catalog.substr(v_cand, v_pos, 1);
      IF v_ch = '%' AND v_pos + 2 <= v_len THEN
        v_hex := pg_catalog.substr(v_cand, v_pos + 1, 2);
        IF v_hex ~ '^[0-9A-Fa-f]{2}$' THEN
          v_byte := pg_catalog.get_byte(pg_catalog.decode(v_hex, 'hex'), 0);
          IF v_byte < 32 OR v_byte = 127 THEN
            RETURN TRUE;
          ELSIF v_byte <= 126 THEN
            v_decoded := v_decoded || pg_catalog.chr(v_byte);
            v_pos := v_pos + 3;
            CONTINUE;
          ELSE
            -- Preserve valid non-ASCII UTF-8 percent-encoded bytes (>= 0x80) verbatim
            v_decoded := v_decoded || '%' || v_hex;
            v_pos := v_pos + 3;
            CONTINUE;
          END IF;
        END IF;
      END IF;
      v_decoded := v_decoded || v_ch;
      v_pos := v_pos + 1;
    END LOOP;

    IF v_decoded = v_cand THEN
      EXIT;
    END IF;
    v_cand := v_decoded;
  END LOOP;

  -- Final evaluation after decoding; also fail closed if unresolved ASCII
  -- percent-encoding persists after 3 decode rounds (blocks 4x+ nested evasion).
  IF v_cand ~ '[\x00-\x1f\x7f\\]'
     OR v_cand ~ '%[0-7][0-9A-Fa-f]'
     OR v_cand ~ '(^|/)\.\.(/|$)'
     OR v_cand ~* '^supabase://'
     OR v_cand ~* '/storage/v1/object/'
     OR v_cand ~* '(^|/)protected_downloads(/|$)'
     OR v_cand ~* '(^|/)paid-resources(/|$)'
     OR v_cand ~* '(^|/)paid(/|$)'
     OR v_cand ~* '(^|/)private(/|$)'
     OR v_cand ~* '/api/payments/download-paid-asset'
     OR v_cand ~* '(meta-ads-campaign-planner-workbook|the-ad-budget-break-even-calculator|the-ad-budget-breat-even-calculate|10-high-converting-meta-ads-copy-frameworks|pre-launch-tracking-audit-checklist|meta-ads-campaign-planner-bundle)' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

ALTER FUNCTION public.is_protected_resource_url(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_protected_resource_url(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_protected_resource_url(TEXT) TO anon, authenticated, service_role, postgres;

-- ==============================================================================
-- 5. COMPLETE 28-COLUMN public.public_resources VIEW
--    - Owned by postgres, security_barrier = true, security_invoker = false
--      so guests and authenticated students read published catalog metadata
--      without direct SELECT grants on public.resources.
--    - Redacts BOTH file_url and external_url on paid rows, misconfigured free
--      rows with price > 0, paid slug/ID rows, and any protected URL pattern.
--    - Preserves public /downloads/*.pdf and /downloads/*.xlsx URLs for
--      legitimate published free resources.
-- ==============================================================================
CREATE OR REPLACE VIEW public.public_resources
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  r.id,
  r.title,
  r.slug,
  r.description,
  r.resource_type,
  r.category,
  CASE
    WHEN r.access_type = 'free'
      AND COALESCE(r.price, 0) = 0
      AND r.slug NOT IN (
        'meta-ads-campaign-planner-workbook',
        'the-ad-budget-break-even-calculator',
        'the-ad-budget-breat-even-calculate',
        '10-high-converting-meta-ads-copy-frameworks',
        'pre-launch-tracking-audit-checklist',
        'meta-ads-campaign-planner-bundle'
      )
      AND r.file_url IS NOT NULL
      AND NOT public.is_protected_resource_url(r.file_url)
    THEN r.file_url
    ELSE NULL
  END AS file_url,
  CASE
    WHEN r.access_type = 'free'
      AND COALESCE(r.price, 0) = 0
      AND r.slug NOT IN (
        'meta-ads-campaign-planner-workbook',
        'the-ad-budget-break-even-calculator',
        'the-ad-budget-breat-even-calculate',
        '10-high-converting-meta-ads-copy-frameworks',
        'pre-launch-tracking-audit-checklist',
        'meta-ads-campaign-planner-bundle'
      )
      AND r.external_url IS NOT NULL
      AND NOT public.is_protected_resource_url(r.external_url)
    THEN r.external_url
    ELSE NULL
  END AS external_url,
  r.thumbnail_url,
  r.author,
  r.file_type,
  r.file_size,
  r.reading_time_minutes,
  r.tags,
  r.status,
  r.is_featured,
  r.published_at,
  r.download_count,
  r.preview_points,
  r.what_is_included,
  r.lead_capture_required,
  r.seo_title,
  r.seo_description,
  r.access_type,
  r.price,
  r.currency,
  r.created_at,
  r.updated_at
FROM public.resources r
WHERE r.status = 'published';

ALTER VIEW public.public_resources OWNER TO postgres;
REVOKE ALL ON public.public_resources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_resources TO anon, authenticated, service_role, postgres;

-- ==============================================================================
-- 6. SHARED ATOMIC PERSISTENT RATE-LIMIT TABLE + FAIL-CLOSED SCHEMA VERIFICATION
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.resource_download_rate_limits (
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  client_hash TEXT NOT NULL CHECK (client_hash ~ '^[0-9a-f]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL CHECK (hit_count >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resource_download_rate_limits_pkey PRIMARY KEY (resource_id, client_hash, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_resource_download_rate_limits_window
  ON public.resource_download_rate_limits (window_started_at);

-- IMPORTANT MANAGED SUPABASE ROLE DEPENDENCY (E-7):
--   `FORCE ROW LEVEL SECURITY` with zero RLS policies blocks even the table owner
--   UNLESS the owner role (`postgres`) holds `rolbypassrls = true` or `rolsuper = true`.
--   On standard PostgreSQL 17, `postgres` is a superuser. On managed Supabase,
--   `postgres` is non-superuser and relies on `rolbypassrls = true`, which MUST NOT
--   be assumed without runtime verification. The fail-closed DO block below inspects
--   `pg_catalog.pg_roles` for `postgres` and aborts the migration transaction if
--   neither `rolsuper` nor `rolbypassrls` is true, preventing silent RPC breakage.
ALTER TABLE public.resource_download_rate_limits OWNER TO postgres;
ALTER TABLE public.resource_download_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_download_rate_limits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resource_download_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resource_download_rate_limits TO service_role, postgres;

-- Fail-closed schema, constraint, index, RLS, policy, role BYPASSRLS, and privilege verification
DO $$
DECLARE
  v_relid OID;
  v_relkind "char";
  v_rls BOOLEAN;
  v_force_rls BOOLEAN;
  v_col_count INTEGER;
  v_expected_col_count INTEGER;
  v_pk_exists BOOLEAN;
  v_idx_exists BOOLEAN;
  v_policy_count INTEGER;
  v_pg_super BOOLEAN;
  v_pg_bypassrls BOOLEAN;
BEGIN
  SELECT c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity
    INTO v_relid, v_relkind, v_rls, v_force_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'resource_download_rate_limits';

  IF v_relid IS NULL OR v_relkind <> 'r' OR NOT v_rls OR NOT v_force_rls THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3A FAIL-CLOSED ABORT: public.resource_download_rate_limits missing, not a regular table, or RLS/FORCE RLS disabled.';
  END IF;

  SELECT COUNT(*) INTO v_col_count
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_relid
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT COUNT(*) INTO v_expected_col_count
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = v_relid
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND (
      (a.attname = 'resource_id' AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'uuid' AND a.attnotnull) OR
      (a.attname = 'client_hash' AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'text' AND a.attnotnull) OR
      (a.attname = 'window_started_at' AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'timestamp with time zone' AND a.attnotnull) OR
      (a.attname = 'hit_count' AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'integer' AND a.attnotnull) OR
      (a.attname = 'updated_at' AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'timestamp with time zone' AND a.attnotnull)
    );

  IF v_col_count <> 5 OR v_expected_col_count <> 5 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = pg_catalog.format(
        'P0-3A FAIL-CLOSED ABORT: public.resource_download_rate_limits column drift detected (found=%s, matched=%s).',
        v_col_count,
        v_expected_col_count
      );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = v_relid
      AND con.contype = 'p'
      AND con.conname = 'resource_download_rate_limits_pkey'
  ) INTO v_pk_exists;

  IF NOT v_pk_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3A FAIL-CLOSED ABORT: Primary key resource_download_rate_limits_pkey missing.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index idx
    JOIN pg_catalog.pg_class ic ON ic.oid = idx.indexrelid
    WHERE idx.indrelid = v_relid
      AND ic.relname = 'idx_resource_download_rate_limits_window'
      AND idx.indisvalid
  ) INTO v_idx_exists;

  IF NOT v_idx_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3A FAIL-CLOSED ABORT: Index idx_resource_download_rate_limits_window missing or invalid.';
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = 'resource_download_rate_limits';

  IF v_policy_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = pg_catalog.format(
        'P0-3A FAIL-CLOSED ABORT: Unexpected RLS policies (%s) on public.resource_download_rate_limits.',
        v_policy_count
      );
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.resource_download_rate_limits', 'SELECT, INSERT, UPDATE, DELETE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.resource_download_rate_limits', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3A FAIL-CLOSED ABORT: anon or authenticated retains direct privileges on public.resource_download_rate_limits.';
  END IF;

  -- Verify `postgres` role can bypass FORCE ROW LEVEL SECURITY inside SECURITY DEFINER RPC
  -- rather than assuming managed Supabase role attributes without evidence.
  SELECT r.rolsuper, r.rolbypassrls
    INTO v_pg_super, v_pg_bypassrls
  FROM pg_catalog.pg_roles r
  WHERE r.rolname = 'postgres';

  IF NOT (COALESCE(v_pg_super, FALSE) OR COALESCE(v_pg_bypassrls, FALSE)) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3A FAIL-CLOSED ABORT: Role "postgres" lacks both rolsuper and rolbypassrls; SECURITY DEFINER record_free_resource_download() cannot write to FORCE-RLS table public.resource_download_rate_limits with zero policies. Reconcile role attributes or add a dedicated owner policy before applying.';
  END IF;
END $$;

-- ==============================================================================
-- 7. RACE-FREE ATOMIC FREE-DOWNLOAD COUNTER & PERSISTENT RATE LIMITER RPC
--    - Locks target resource row with SELECT ... FOR UPDATE before checking
--      eligibility, serializing against concurrent admin free->paid or
--      published->archived transitions.
--    - Defensive UPDATE re-verifies published + free + price=0 predicates and
--      checks GET DIAGNOSTICS ROW_COUNT = 1.
--    - On ROW_COUNT <> 1, raises inside an explicit subtransaction to roll back
--      the rate-limit hit and returns allowed=false, incremented=false.
--    - Executable ONLY by service_role and postgres.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_free_resource_download(
  p_resource_id UUID,
  p_client_hash TEXT,
  p_window_seconds INTEGER DEFAULT 900,
  p_max_hits INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_window_start TIMESTAMPTZ;
  v_retry_after INTEGER;
  v_res RECORD;
  v_hit_count INTEGER;
  v_new_count INTEGER;
  v_rows_updated INTEGER;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', FALSE,
      'incremented', FALSE,
      'code', 'INVALID_RESOURCE_ID'
    );
  END IF;

  IF p_client_hash IS NULL OR p_client_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', FALSE,
      'incremented', FALSE,
      'code', 'INVALID_CLIENT_HASH'
    );
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', FALSE,
      'incremented', FALSE,
      'code', 'INVALID_WINDOW'
    );
  END IF;

  IF p_max_hits IS NULL OR p_max_hits < 1 OR p_max_hits > 100 THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', FALSE,
      'incremented', FALSE,
      'code', 'INVALID_MAX_HITS'
    );
  END IF;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(EXTRACT(EPOCH FROM v_now) / p_window_seconds) * p_window_seconds
  );

  v_retry_after := GREATEST(
    1,
    CEIL(
      EXTRACT(
        EPOCH FROM (
          v_window_start + pg_catalog.make_interval(secs => p_window_seconds) - v_now
        )
      )
    )::INTEGER
  );

  -- Acquire row-level lock BEFORE checking eligibility so concurrent admin
  -- changes (free -> paid, published -> archived/draft, price > 0) serialize
  -- deterministically with download counter increments.
  SELECT
    r.id,
    r.status,
    r.access_type,
    r.price,
    COALESCE(r.download_count, 0) AS download_count
  INTO v_res
  FROM public.resources r
  WHERE r.id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', FALSE,
      'incremented', FALSE,
      'code', 'NOT_FOUND'
    );
  END IF;

  IF v_res.status IS DISTINCT FROM 'published'
     OR v_res.access_type IS DISTINCT FROM 'free'
     OR COALESCE(v_res.price, 0) <> 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', FALSE,
      'incremented', FALSE,
      'code', 'NOT_ELIGIBLE',
      'download_count', v_res.download_count
    );
  END IF;

  -- Explicit subtransaction guarantees that if the final defensive UPDATE
  -- affects zero rows (e.g. defensive guard trigger), the rate-limit upsert
  -- is rolled back cleanly with zero phantom hit recorded.
  BEGIN
    INSERT INTO public.resource_download_rate_limits (
      resource_id,
      client_hash,
      window_started_at,
      hit_count,
      updated_at
    )
    VALUES (
      p_resource_id,
      p_client_hash,
      v_window_start,
      1,
      v_now
    )
    ON CONFLICT (resource_id, client_hash, window_started_at)
    DO UPDATE SET
      hit_count = LEAST(public.resource_download_rate_limits.hit_count + 1, p_max_hits + 1),
      updated_at = v_now
    RETURNING hit_count INTO v_hit_count;

    IF v_hit_count > p_max_hits THEN
      RETURN pg_catalog.jsonb_build_object(
        'allowed', FALSE,
        'incremented', FALSE,
        'code', 'RATE_LIMITED',
        'retry_after_seconds', v_retry_after,
        'remaining', 0,
        'download_count', v_res.download_count
      );
    END IF;

    UPDATE public.resources
    SET download_count = COALESCE(download_count, 0) + 1
    WHERE id = p_resource_id
      AND status = 'published'
      AND access_type = 'free'
      AND COALESCE(price, 0) = 0
    RETURNING download_count INTO v_new_count;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'P0_3_UPDATE_AFFECTED_ZERO_ROWS';
    END IF;

    -- Bounded, indexed opportunistic pruning of expired rate-limit windows (> 24 hours old).
    -- Uses idx_resource_download_rate_limits_window with LIMIT 50 + FOR UPDATE SKIP LOCKED
    -- so concurrent free downloads never perform unbounded full-table sweeps or contend on locks (E-7).
    DELETE FROM public.resource_download_rate_limits rl
    USING (
      SELECT resource_id, client_hash, window_started_at
      FROM public.resource_download_rate_limits
      WHERE window_started_at < (v_now - INTERVAL '24 hours')
      ORDER BY window_started_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    ) expired
    WHERE rl.resource_id = expired.resource_id
      AND rl.client_hash = expired.client_hash
      AND rl.window_started_at = expired.window_started_at;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', TRUE,
      'incremented', TRUE,
      'code', 'OK',
      'download_count', v_new_count,
      'remaining', GREATEST(0, p_max_hits - v_hit_count),
      'retry_after_seconds', 0
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN pg_catalog.jsonb_build_object(
        'allowed', FALSE,
        'incremented', FALSE,
        'code', 'UPDATE_AFFECTED_ZERO_ROWS',
        'download_count', v_res.download_count
      );
  END;
END;
$$;

ALTER FUNCTION public.record_free_resource_download(UUID, TEXT, INTEGER, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_free_resource_download(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_free_resource_download(UUID, TEXT, INTEGER, INTEGER) TO service_role, postgres;

-- Refresh PostgREST schema cache so public_resources view and hardened RPC are immediately visible
NOTIFY pgrst, 'reload schema';

COMMIT;
