-- =====================================================================================
-- MIGRATION: 20261029000001_harden_is_admin_remove_user_metadata.sql
-- DESCRIPTION: Remove client-mutable user_metadata role check from public.is_admin()
--              to prevent unauthorized privilege escalation by authenticated users.
--              Trust only the established admin email allowlist and protected app_metadata.role.
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND
    (
      lower(coalesce(auth.jwt() ->> 'email', '')) IN ('mkdigitalverse@gmail.com', 'admin@digitalmuid.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- Explicitly revoke execution privilege from pseudo-role PUBLIC (PostgreSQL default)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;

-- Grant execution privilege to authenticated users for client-side RPC calls and RLS policies
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Grant execution privilege to anon to support unified public catalog RLS policies
-- (e.g. articles, videos, resources, frameworks, courses: USING (status = 'published' OR public.is_admin()))
-- Function returns false for anonymous visitors because auth.role() = 'authenticated' is false.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
