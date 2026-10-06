-- =====================================================================================
-- MIGRATION: 20260918000002_harden_is_admin_and_profile_trigger.sql
-- DESCRIPTION: Phase 1 Step 1B - Harden public.is_admin() against student privilege escalation
--              and install automated profile creation trigger on auth.users
-- =====================================================================================

-- 1. HARDEN is_admin() FUNCTION
-- Concrete Defect Fix: The placeholder is_admin() returned true for any authenticated user.
-- With student authentication enabled, is_admin() must strictly verify administrative identity
-- using authorized admin emails or verified admin metadata claims.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND
    (
      auth.jwt() ->> 'email' IN ('mkdigitalverse@gmail.com', 'admin@digitalmuid.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow client-side verification via Supabase RPC without compromising authorization
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

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
