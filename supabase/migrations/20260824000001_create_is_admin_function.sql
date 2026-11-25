-- =====================================================================================
-- MIGRATION: 20260824000001_create_is_admin_function.sql
-- DESCRIPTION: Foundational creation of canonical hardened public.is_admin() helper function
--              prior to early table creation and RLS policy evaluations.
-- =====================================================================================

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
  IF v_email_confirmed_at IS NULL THEN
    RETURN FALSE;
  END IF;
  IF (v_app_meta ->> 'role') = 'admin' THEN
    RETURN TRUE;
  END IF;
  IF v_email IN ('mkdigitalverse@gmail.com', 'admin@digitalmuid.com') THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

ALTER FUNCTION public.is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role, postgres;
