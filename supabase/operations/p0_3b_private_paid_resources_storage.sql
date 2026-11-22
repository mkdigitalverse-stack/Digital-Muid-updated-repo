-- ==============================================================================
-- DIGITALMUID V4.3 — P0-3 STEP B: SEPARATE OPERATIONAL STORAGE PRIVATIZATION
-- Script: supabase/operations/p0_3b_private_paid_resources_storage.sql
-- ==============================================================================
-- STRICT OPERATIONAL SEPARATION NOTICE:
--   1. This script is intentionally placed OUTSIDE `supabase/migrations/` and is
--      NOT part of the atomic database migration transaction (Step A).
--   2. On managed Supabase projects, `storage.objects` is owned by
--      `supabase_storage_admin`. Running ALTER/CREATE POLICY on `storage.objects`
--      as an unprivileged role may fail with `42501: must be owner of table objects`.
--      Therefore, Step B MUST be executed ONLY during a scheduled staging/cutover
--      window AFTER Step A succeeds and after confirming executing role privileges.
--   3. DO NOT EXECUTE AGAINST PRODUCTION WITHOUT EXPLICIT CUTOVER APPROVAL.
--
-- REQUIRED MAINTENANCE / ASSET CUTOVER SEQUENCE (STAGING FIRST):
--   Phase B1 (Preflight):
--     - Run the read-only ownership/role check block below. If the executing role
--       lacks ownership or storage admin rights, apply the bucket + policies via
--       the Supabase Dashboard -> Storage -> Policies UI (or Supabase CLI with
--       storage admin role) using the exact policy definitions below.
--   Phase B2 (Private Bucket & Strict Policies):
--     - Create private bucket `paid-resources` (`public = false`).
--     - Enforce service_role-only access on `storage.objects` where
--       `bucket_id = 'paid-resources'` (zero PUBLIC/anon/authenticated policies).
--   Phase B3 (Maintenance Window Asset Cutover):
--     - Enable maintenance notice for paid resource downloads.
--     - Upload all paid deliverables to `paid-resources/<canonical-path>` via
--       service_role / Storage admin.
--     - Update `public.resources.file_url` for paid rows to
--       `supabase://paid-resources/<canonical-path>`.
--     - Verify authenticated buyer + verified guest signed URL downloads return
--       HTTP 200 with valid PDF/XLSX magic bytes and SHA-256 checksums match.
--     - Verify unauthenticated plain Storage URL requests to both:
--         (a) `/storage/v1/object/public/paid-resources/<path>`
--         (b) legacy `/storage/v1/object/public/resources/<paid-path>` (after deletion)
--       return HTTP 400/403/404 with zero cached CDN edge bypass (`Cache-Control`
--       verified across fresh edge requests).
--     - ONLY AFTER signed downloads AND plain-URL 403/404 checks pass, remove
--       legacy paid objects from the old public `resources` bucket and exit
--       maintenance mode.
--
-- ROLLBACK GUIDANCE (BEFORE LEGACY DELETION):
--   - Repoint `public.resources.file_url` back to previous canonical values while
--     keeping `public.resources` base-table RLS and server-side signing intact.
--   - Never make `paid-resources` bucket `public = true` as a rollback shortcut.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PHASE B1: PREFLIGHT OWNERSHIP & PRIVILEGE CHECK (FAIL-CLOSED)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_objects_owner TEXT;
  v_buckets_owner TEXT;
  v_current_user TEXT := current_user;
  v_is_superuser BOOLEAN;
  v_can_manage_objects BOOLEAN;
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3B PREFLIGHT ABORT: Supabase storage schema (storage.buckets / storage.objects) not present in this database.';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(c.relowner)
    INTO v_objects_owner
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects';

  SELECT pg_catalog.pg_get_userbyid(c.relowner)
    INTO v_buckets_owner
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'buckets';

  SELECT r.rolsuper INTO v_is_superuser
  FROM pg_catalog.pg_roles r
  WHERE r.rolname = v_current_user;

  v_can_manage_objects :=
    COALESCE(v_is_superuser, FALSE)
    OR v_current_user = v_objects_owner
    OR pg_catalog.pg_has_role(v_current_user, v_objects_owner, 'MEMBER');

  IF NOT v_can_manage_objects THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = pg_catalog.format(
        'P0-3B PREFLIGHT ABORT: Role "%s" cannot alter policies on storage.objects (owner: "%s", storage.buckets owner: "%s"). Apply Phase B2 via Supabase Dashboard Storage Policies UI or storage-owner role.',
        v_current_user,
        v_objects_owner,
        v_buckets_owner
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- PHASE B2: CREATE PRIVATE paid-resources BUCKET & STRICT STORAGE POLICIES
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'paid-resources',
  'paid-resources',
  FALSE,
  52428800, -- 50 MiB ceiling
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Fail-closed check: verify no non-service-role policy exists for paid-resources
DO $$
DECLARE
  v_allowed_storage_policies CONSTANT TEXT[] := ARRAY[
    'Service Role Full Access Paid Resources'
  ];
  v_unexpected_storage_policies TEXT;
BEGIN
  SELECT pg_catalog.string_agg(p.policyname, ', ' ORDER BY p.policyname)
    INTO v_unexpected_storage_policies
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects'
    AND (
      COALESCE(p.qual, '') ILIKE '%paid-resources%'
      OR COALESCE(p.with_check, '') ILIKE '%paid-resources%'
    )
    AND NOT (p.policyname = ANY (v_allowed_storage_policies));

  IF v_unexpected_storage_policies IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = pg_catalog.format(
        'P0-3B FAIL-CLOSED ABORT: Unexpected storage.objects policies referencing paid-resources: [%s].',
        v_unexpected_storage_policies
      );
  END IF;
END $$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Full Access Paid Resources" ON storage.objects;

CREATE POLICY "Service Role Full Access Paid Resources"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'paid-resources')
  WITH CHECK (bucket_id = 'paid-resources');

-- Post-apply assertion: bucket MUST remain private
DO $$
DECLARE
  v_is_public BOOLEAN;
BEGIN
  SELECT b.public INTO v_is_public
  FROM storage.buckets b
  WHERE b.id = 'paid-resources';

  IF v_is_public IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'P0-3B POST-CHECK FAILED: paid-resources bucket is not private (public <> false).';
  END IF;
END $$;

COMMIT;
