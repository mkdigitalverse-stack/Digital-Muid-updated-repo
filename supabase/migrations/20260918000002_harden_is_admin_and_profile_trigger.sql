-- =====================================================================================
-- MIGRATION: 20260918000002_harden_is_admin_and_profile_trigger.sql
-- DESCRIPTION: Phase 1 Step 1B - Canonical hardened public.is_admin()
--              and install automated profile creation trigger on auth.users
-- =====================================================================================

-- 1. HARDEN is_admin() FUNCTION
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

-- 2. AUTOMATED PROFILE CREATION TRIGGER
-- Whenever a user registers via Supabase Auth, guarantee a corresponding record in public.profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
