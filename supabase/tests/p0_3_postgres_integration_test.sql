-- ==============================================================================
-- DIGITALMUID V4.3 — P0-3 STANDALONE POSTGRESQL 17 INTEGRATION TEST SCRIPT
-- File: supabase/tests/p0_3_postgres_integration_test.sql
-- ==============================================================================
-- SAFETY & HYGIENE GUARANTEES:
--   1. Runs ONLY against disposable CI PostgreSQL 17 or approved staging DB.
--      NEVER execute against production!
--   2. Uses ONLY synthetic fixture UUIDs (`99000000-...`, `99100000-...`).
--      Zero references to real DigitalMuid production paid resource UUIDs.
--   3. Collision guard ABORTS before inserting if any synthetic fixture ID/slug
--      already exists. Zero `ON CONFLICT DO UPDATE` fixture mutations.
--   4. Cleanup deletes ONLY records created by this test script.
--   5. Separately tests effective SQL table privileges (`has_table_privilege`)
--      versus RLS enforcement (`SET LOCAL ROLE authenticated` + JWT claims).
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ==============================================================================
-- 0. COLLISION GUARD — ABORT IF ANY SYNTHETIC FIXTURE ALREADY EXISTS
-- ==============================================================================
DO $$
DECLARE
  v_fixture_resource_ids CONSTANT UUID[] := ARRAY[
    '99000000-0000-4000-8000-000000000001'::uuid,
    '99000000-0000-4000-8000-000000000002'::uuid,
    '99000000-0000-4000-8000-000000000003'::uuid,
    '99000000-0000-4000-8000-000000000004'::uuid,
    '99000000-0000-4000-8000-000000000005'::uuid,
    '99000000-0000-4000-8000-000000000006'::uuid,
    '99000000-0000-4000-8000-000000000007'::uuid
  ];
  v_fixture_user_ids CONSTANT UUID[] := ARRAY[
    '99100000-0000-4000-8000-000000000001'::uuid,
    '99100000-0000-4000-8000-000000000002'::uuid,
    '99100000-0000-4000-8000-000000000003'::uuid,
    '99100000-0000-4000-8000-000000000004'::uuid,
    '99100000-0000-4000-8000-000000000005'::uuid
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM public.resources WHERE id = ANY (v_fixture_resource_ids) OR slug LIKE 'p03-synth-%') THEN
    RAISE EXCEPTION 'P0-3 TEST COLLISION: Synthetic resource fixture already exists. Aborting cleanly.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = ANY (v_fixture_user_ids)
       OR email LIKE 'p03.synth.%@example.test'
       OR pg_catalog.lower(email) = 'admin@digitalmuid.com'
  ) THEN
    RAISE EXCEPTION 'P0-3 TEST COLLISION: Synthetic auth.users fixture or allowlisted test email already exists. Aborting cleanly.';
  END IF;
END $$;

-- ==============================================================================
-- 1. SEED SYNTHETIC USERS & 7 SYNTHETIC RESOURCE FIXTURES (ALL CONSTRAINTS MET)
-- ==============================================================================
INSERT INTO auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('99100000-0000-4000-8000-000000000001', 'p03.synth.student@example.test', NOW(), '{}'::jsonb, '{"role":"admin"}'::jsonb),
  ('99100000-0000-4000-8000-000000000002', 'p03.synth.unconfirmed.admin@example.test', NULL, '{"role":"admin"}'::jsonb, '{}'::jsonb),
  ('99100000-0000-4000-8000-000000000003', 'p03.synth.confirmed.admin@example.test', NOW(), '{"role":"admin"}'::jsonb, '{}'::jsonb),
  ('99100000-0000-4000-8000-000000000004', 'p03.synth.unconfirmed.email@example.test', NULL, '{}'::jsonb, '{}'::jsonb),
  -- Synthetic UUID bound to allowlisted email (starts unconfirmed; promoted to confirmed inside rollback-only test)
  ('99100000-0000-4000-8000-000000000005', 'admin@digitalmuid.com', NULL, '{}'::jsonb, '{}'::jsonb);

INSERT INTO public.resources (
  id, title, slug, description, resource_type, category,
  file_url, external_url, thumbnail_url, author, file_type, file_size,
  reading_time_minutes, tags, status, is_featured, published_at, download_count,
  preview_points, what_is_included, lead_capture_required, seo_title, seo_description,
  access_type, price, currency
)
VALUES
  -- 1. Legitimate published free PDF under /downloads/
  ('99000000-0000-4000-8000-000000000001', 'P03 Free PDF', 'p03-synth-free-pdf', 'Free PDF desc', 'Guide', 'Growth',
   '/downloads/p03-synthetic-free.pdf', 'https://example.test/free-companion', 'https://example.test/t1.png', 'Digital Muid', 'PDF', '1.2 MB',
   5, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], true, 'Free PDF', 'Free PDF SEO', 'free', 0, 'INR'),
  -- 2. Legitimate published free XLSX under /downloads/
  ('99000000-0000-4000-8000-000000000002', 'P03 Free XLSX', 'p03-synth-free-xlsx', 'Free XLSX desc', 'Template', 'Growth',
   '/downloads/p03-synthetic-sheet.xlsx', NULL, 'https://example.test/t2.png', 'Digital Muid', 'XLSX', '0.5 MB',
   3, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'Free XLSX', 'Free XLSX SEO', 'free', 0, 'INR'),
  -- 3. Published paid resource (private storage URL + external_url -> BOTH must be redacted)
  ('99000000-0000-4000-8000-000000000003', 'P03 Paid Playbook', 'p03-synth-paid-playbook', 'Paid desc', 'Workbook', 'Paid Ads',
   'supabase://paid-resources/synthetic/p03-paid.pdf', 'https://example.test/paid-mirror', 'https://example.test/t3.png', 'Digital Muid', 'PDF', '4.1 MB',
   15, ARRAY['paid'], 'published', true, NOW(), 0, '{}'::text[], '{}'::text[], false, 'Paid Playbook', 'Paid SEO', 'paid', 299, 'INR'),
  -- 4. Draft free resource (must be invisible in public_resources, rejected by counter RPC)
  ('99000000-0000-4000-8000-000000000004', 'P03 Draft Free', 'p03-synth-draft-free', 'Draft desc', 'Guide', 'Growth',
   '/downloads/p03-draft.pdf', NULL, 'https://example.test/t4.png', 'Digital Muid', 'PDF', '1.0 MB',
   4, ARRAY['draft'], 'draft', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'Draft', 'Draft SEO', 'free', 0, 'INR'),
  -- 5. Archived free resource (must be invisible in public_resources, rejected by counter RPC)
  ('99000000-0000-4000-8000-000000000005', 'P03 Archived Free', 'p03-synth-archived-free', 'Archived desc', 'Guide', 'Growth',
   '/downloads/p03-archived.pdf', NULL, 'https://example.test/t5.png', 'Digital Muid', 'PDF', '1.0 MB',
   4, ARRAY['archived'], 'archived', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'Archived', 'Archived SEO', 'free', 0, 'INR'),
  -- 6. Misconfigured free resource with price > 0 (URLs must be redacted, counter RPC rejects)
  ('99000000-0000-4000-8000-000000000006', 'P03 Free Nonzero Price', 'p03-synth-free-nonzero', 'Nonzero desc', 'Checklist', 'Growth',
   '/downloads/p03-nonzero.pdf', 'https://example.test/nonzero', 'https://example.test/t6.png', 'Digital Muid', 'PDF', '1.0 MB',
   4, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'Nonzero', 'Nonzero SEO', 'free', 99, 'INR'),
  -- 7. Published free resource pointing to protected URL (must be redacted)
  ('99000000-0000-4000-8000-000000000007', 'P03 Free Protected URL', 'p03-synth-free-protected-url', 'Protected URL desc', 'Toolkit', 'Growth',
   '/protected_downloads/p03-secret.pdf', 'supabase://paid-resources/secret.pdf', 'https://example.test/t7.png', 'Digital Muid', 'PDF', '1.0 MB',
   4, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'Protected', 'Protected SEO', 'free', 0, 'INR');

-- ==============================================================================
-- 2. PRIVILEGE VS RLS MATRIX CHECKS
-- ==============================================================================
DO $$
BEGIN
  -- Effective SQL privilege checks (separate from RLS)
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.resources', 'SELECT'), 'anon must NOT have SELECT on public.resources';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.resources', 'INSERT'), 'anon must NOT have INSERT on public.resources';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.resources', 'UPDATE'), 'anon must NOT have UPDATE on public.resources';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.resources', 'DELETE'), 'anon must NOT have DELETE on public.resources';

  ASSERT pg_catalog.has_table_privilege('anon', 'public.public_resources', 'SELECT'), 'anon must have SELECT on public.public_resources';
  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.public_resources', 'UPDATE'), 'anon must NOT have UPDATE on public.public_resources';
  ASSERT pg_catalog.has_table_privilege('authenticated', 'public.public_resources', 'SELECT'), 'authenticated must have SELECT on public.public_resources';

  ASSERT NOT pg_catalog.has_table_privilege('anon', 'public.resource_download_rate_limits', 'SELECT'), 'anon must NOT access rate limits table';
  ASSERT NOT pg_catalog.has_table_privilege('authenticated', 'public.resource_download_rate_limits', 'SELECT'), 'authenticated must NOT access rate limits table';

  ASSERT pg_catalog.to_regprocedure('public.increment_resource_downloads(uuid)') IS NULL, 'Legacy increment_resource_downloads(uuid) must be dropped';
  ASSERT NOT pg_catalog.has_function_privilege('anon', 'public.record_free_resource_download(uuid, text, integer, integer)', 'EXECUTE'), 'anon must NOT execute record_free_resource_download';
  ASSERT NOT pg_catalog.has_function_privilege('authenticated', 'public.record_free_resource_download(uuid, text, integer, integer)', 'EXECUTE'), 'authenticated must NOT execute record_free_resource_download';
  ASSERT pg_catalog.has_function_privilege('service_role', 'public.record_free_resource_download(uuid, text, integer, integer)', 'EXECUTE'), 'service_role must execute record_free_resource_download';
END $$;

-- ==============================================================================
-- 3. RLS & VIEW ASSERTIONS ACROSS ROLES (ANON, STUDENT, UNCONFIRMED ADMIN, CONFIRMED ADMIN)
-- ==============================================================================
-- 3A. Anon sees published free URLs, redacted paid/protected URLs, zero drafts/archived via public_resources
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE
  v_free_pdf_url TEXT;
  v_free_xlsx_url TEXT;
  v_paid_file_url TEXT;
  v_paid_ext_url TEXT;
  v_nonzero_file_url TEXT;
  v_prot_file_url TEXT;
  v_prot_ext_url TEXT;
  v_hidden_cnt INTEGER;
BEGIN
  ASSERT NOT public.is_admin(), 'anon must NEVER be admin';

  SELECT file_url INTO v_free_pdf_url FROM public.public_resources WHERE id = '99000000-0000-4000-8000-000000000001';
  ASSERT v_free_pdf_url = '/downloads/p03-synthetic-free.pdf', 'Legitimate free PDF URL must be preserved';

  SELECT file_url INTO v_free_xlsx_url FROM public.public_resources WHERE id = '99000000-0000-4000-8000-000000000002';
  ASSERT v_free_xlsx_url = '/downloads/p03-synthetic-sheet.xlsx', 'Legitimate free XLSX URL must be preserved';

  SELECT file_url, external_url INTO v_paid_file_url, v_paid_ext_url FROM public.public_resources WHERE id = '99000000-0000-4000-8000-000000000003';
  ASSERT v_paid_file_url IS NULL AND v_paid_ext_url IS NULL, 'Paid resource URLs must be redacted to NULL';

  SELECT file_url INTO v_nonzero_file_url FROM public.public_resources WHERE id = '99000000-0000-4000-8000-000000000006';
  ASSERT v_nonzero_file_url IS NULL, 'Free resource with price > 0 must have URL redacted';

  SELECT file_url, external_url INTO v_prot_file_url, v_prot_ext_url FROM public.public_resources WHERE id = '99000000-0000-4000-8000-000000000007';
  ASSERT v_prot_file_url IS NULL AND v_prot_ext_url IS NULL, 'Protected URLs on free row must be redacted';

  SELECT COUNT(*) INTO v_hidden_cnt FROM public.public_resources WHERE id IN ('99000000-0000-4000-8000-000000000004', '99000000-0000-4000-8000-000000000005');
  ASSERT v_hidden_cnt = 0, 'Draft and archived rows must be invisible in public_resources';

  -- Percent-encoded protected URL evasion tests (E-7) vs safe legitimate free downloads
  ASSERT NOT public.is_protected_resource_url('/downloads/p03-synthetic-free.pdf'), 'Free PDF path must remain public';
  ASSERT NOT public.is_protected_resource_url('/downloads/p03-synthetic-sheet.xlsx'), 'Free XLSX path must remain public';
  ASSERT NOT public.is_protected_resource_url('/downloads/My%20Free%20Guide.pdf'), 'Free PDF with encoded spaces must remain public';
  ASSERT NOT public.is_protected_resource_url('/downloads/100%25-Guide.pdf'), 'Free PDF with encoded percent must remain public';
  ASSERT public.is_protected_resource_url('/%70rotected_downloads/p03-secret.pdf'), 'Single percent-encoded protected_downloads must be redacted';
  ASSERT public.is_protected_resource_url('/%2570rotected_downloads/p03-secret.pdf'), 'Double percent-encoded protected_downloads must be redacted';
  ASSERT public.is_protected_resource_url('/%25252570aid/playbook.pdf'), 'Unresolved multi-encoded paid path must fail closed (redacted)';
  ASSERT public.is_protected_resource_url('/storage/v1/object%2fpublic%2fpaid-resources%2fa.pdf'), 'Encoded storage path must be redacted';
  ASSERT public.is_protected_resource_url('supabase%3A%2F%2Fpaid-resources/secret.pdf'), 'Encoded supabase:// scheme must be redacted';
  ASSERT public.is_protected_resource_url('/downloads/..%2fprotected_downloads/secret.pdf'), 'Encoded traversal path must be redacted';
END $$;

RESET ROLE;

-- 3B. Authenticated student (even with spoofed user_metadata.role='admin'): 0 rows on base table, 0 rows affected on UPDATE
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_base_cnt INTEGER;
  v_upd_cnt INTEGER;
  v_paid_url TEXT;
BEGIN
  ASSERT NOT public.is_admin(), 'Student with spoofed user_metadata.role=admin must NOT be admin';
  SELECT COUNT(*) INTO v_base_cnt FROM public.resources WHERE slug LIKE 'p03-synth-%';
  ASSERT v_base_cnt = 0, 'Authenticated non-admin must see 0 rows in public.resources';

  SELECT file_url INTO v_paid_url FROM public.public_resources WHERE id = '99000000-0000-4000-8000-000000000003';
  ASSERT v_paid_url IS NULL, 'Authenticated student must see NULL paid file_url in public_resources';

  UPDATE public.resources SET download_count = 9999 WHERE id = '99000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_upd_cnt = ROW_COUNT;
  ASSERT v_upd_cnt = 0, 'Authenticated non-admin UPDATE on public.resources must affect 0 rows';
END $$;

-- 3C. Authenticated UNCONFIRMED admin (app_metadata.role='admin' but email_confirmed_at IS NULL): DENIED
SELECT set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000002', true);

DO $$
DECLARE
  v_base_cnt INTEGER;
  v_upd_cnt INTEGER;
BEGIN
  ASSERT NOT public.is_admin(), 'Unconfirmed app_metadata admin must NOT pass public.is_admin()';
  SELECT COUNT(*) INTO v_base_cnt FROM public.resources WHERE slug LIKE 'p03-synth-%';
  ASSERT v_base_cnt = 0, 'Unconfirmed admin must see 0 rows in public.resources';

  UPDATE public.resources SET title = 'Tampered' WHERE id = '99000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_upd_cnt = ROW_COUNT;
  ASSERT v_upd_cnt = 0, 'Unconfirmed admin UPDATE on public.resources must affect 0 rows';
END $$;

-- 3D. Authenticated CONFIRMED admin: sees all 7 synthetic fixtures + retains CMS INSERT/UPDATE/DELETE
SELECT set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000003', true);

DO $$
DECLARE
  v_base_cnt INTEGER;
  v_paid_url TEXT;
  v_cms_id CONSTANT UUID := '99000000-0000-4000-8000-000000000088'::uuid;
BEGIN
  ASSERT public.is_admin(), 'Confirmed app_metadata admin MUST pass public.is_admin()';
  SELECT COUNT(*) INTO v_base_cnt FROM public.resources WHERE slug LIKE 'p03-synth-%';
  ASSERT v_base_cnt = 7, 'Confirmed admin must see all 7 synthetic fixtures in public.resources';

  SELECT file_url INTO v_paid_url FROM public.resources WHERE id = '99000000-0000-4000-8000-000000000003';
  ASSERT v_paid_url = 'supabase://paid-resources/synthetic/p03-paid.pdf', 'Confirmed admin must see raw paid file_url in CMS';

  INSERT INTO public.resources (id, title, slug, status, access_type, price, currency)
  VALUES (v_cms_id, 'P03 CMS Temp', 'p03-synth-cms-temp', 'draft', 'free', 0, 'INR');

  UPDATE public.resources SET title = 'P03 CMS Updated' WHERE id = v_cms_id;
  DELETE FROM public.resources WHERE id = v_cms_id;
END $$;

-- 3E. Email-allowlisted UNCONFIRMED admin (admin@digitalmuid.com, email_confirmed_at IS NULL, no app_metadata.role): DENIED
SELECT set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000005', true);

DO $$
DECLARE
  v_base_cnt INTEGER;
BEGIN
  ASSERT NOT public.is_admin(), 'Unconfirmed email-allowlisted admin must NOT pass public.is_admin()';
  SELECT COUNT(*) INTO v_base_cnt FROM public.resources WHERE slug LIKE 'p03-synth-%';
  ASSERT v_base_cnt = 0, 'Unconfirmed email-allowlisted admin must see 0 rows in public.resources';
END $$;

RESET ROLE;

-- Promote synthetic allowlisted admin user to confirmed inside this rollback-only transaction
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = '99100000-0000-4000-8000-000000000005'::uuid;

-- 3F. Email-allowlisted CONFIRMED admin (admin@digitalmuid.com, email_confirmed_at IS NOT NULL): ALLOWED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000005', true);

DO $$
DECLARE
  v_base_cnt INTEGER;
BEGIN
  ASSERT public.is_admin(), 'Confirmed email-allowlisted admin MUST pass public.is_admin()';
  SELECT COUNT(*) INTO v_base_cnt FROM public.resources WHERE slug LIKE 'p03-synth-%';
  ASSERT v_base_cnt = 7, 'Confirmed email-allowlisted admin must see all 7 synthetic fixtures in public.resources';
END $$;

RESET ROLE;

-- ==============================================================================
-- 4. SERVICE-ROLE ATOMIC FREE-DOWNLOAD COUNTER, RATE-LIMIT & ZERO-ROW ROLLBACK TESTS
-- ==============================================================================
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_hash CONSTANT TEXT := repeat('a', 64);
  v_res JSONB;
  i INTEGER;
BEGIN
  -- Hits 1..10 succeed
  FOR i IN 1..10 LOOP
    v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000001'::uuid, v_hash, 900, 10);
    ASSERT (v_res ->> 'allowed')::boolean = TRUE, 'Hit ' || i || ' must be allowed';
    ASSERT (v_res ->> 'incremented')::boolean = TRUE, 'Hit ' || i || ' must be incremented';
    ASSERT (v_res ->> 'download_count')::integer = i, 'Expected download_count ' || i;
  END LOOP;

  -- Hit 11 rate-limited
  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000001'::uuid, v_hash, 900, 10);
  ASSERT (v_res ->> 'allowed')::boolean = FALSE AND (v_res ->> 'code') = 'RATE_LIMITED', 'Hit 11 must be RATE_LIMITED';
  ASSERT (v_res ->> 'download_count')::integer = 10, 'download_count must remain 10 after rate limit';

  -- Paid, draft, archived, and free-with-nonzero-price all return NOT_ELIGIBLE
  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000003'::uuid, v_hash, 900, 10);
  ASSERT (v_res ->> 'code') = 'NOT_ELIGIBLE', 'Paid resource must return NOT_ELIGIBLE';

  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000004'::uuid, v_hash, 900, 10);
  ASSERT (v_res ->> 'code') = 'NOT_ELIGIBLE', 'Draft resource must return NOT_ELIGIBLE';

  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000005'::uuid, v_hash, 900, 10);
  ASSERT (v_res ->> 'code') = 'NOT_ELIGIBLE', 'Archived resource must return NOT_ELIGIBLE';

  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000006'::uuid, v_hash, 900, 10);
  ASSERT (v_res ->> 'code') = 'NOT_ELIGIBLE', 'Free resource with price > 0 must return NOT_ELIGIBLE';

  -- Non-existent UUID returns NOT_FOUND
  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000099'::uuid, v_hash, 900, 10);
  ASSERT (v_res ->> 'code') = 'NOT_FOUND', 'Missing resource must return NOT_FOUND';
END $$;

RESET ROLE;

-- 4B. Zero-row defensive UPDATE subtransaction rollback verification
CREATE OR REPLACE FUNCTION pg_temp.suppress_p03_test_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id = '99000000-0000-4000-8000-000000000002'::uuid THEN
    RETURN NULL; -- Forces UPDATE ROW_COUNT = 0
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_p03_zero_row_test
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION pg_temp.suppress_p03_test_update();

DO $$
DECLARE
  v_hash_zero CONSTANT TEXT := repeat('b', 64);
  v_res JSONB;
  v_rl_cnt INTEGER;
  v_dl_cnt INTEGER;
BEGIN
  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000002'::uuid, v_hash_zero, 900, 10);
  ASSERT (v_res ->> 'allowed')::boolean = FALSE, 'Zero-row UPDATE must return allowed=false';
  ASSERT (v_res ->> 'incremented')::boolean = FALSE, 'Zero-row UPDATE must return incremented=false';
  ASSERT (v_res ->> 'code') = 'UPDATE_AFFECTED_ZERO_ROWS', 'Zero-row UPDATE must return UPDATE_AFFECTED_ZERO_ROWS';

  SELECT download_count INTO v_dl_cnt FROM public.resources WHERE id = '99000000-0000-4000-8000-000000000002'::uuid;
  ASSERT v_dl_cnt = 0, 'download_count must remain 0 after zero-row UPDATE';

  SELECT COUNT(*) INTO v_rl_cnt
  FROM public.resource_download_rate_limits
  WHERE resource_id = '99000000-0000-4000-8000-000000000002'::uuid
    AND client_hash = v_hash_zero;
  ASSERT v_rl_cnt = 0, 'Subtransaction rollback must leave ZERO phantom rate-limit hits';
END $$;

DROP TRIGGER trg_p03_zero_row_test ON public.resources;

-- 4C. Bounded indexed rate-limit pruning verification (LIMIT 50 per allowed download — E-7)
DO $$
DECLARE
  v_i INTEGER;
  v_expired_before INTEGER;
  v_expired_after INTEGER;
  v_res JSONB;
  v_cleanup_hash CONSTANT TEXT := repeat('c', 64);
BEGIN
  FOR v_i IN 1..65 LOOP
    INSERT INTO public.resource_download_rate_limits (
      resource_id, client_hash, window_started_at, hit_count, updated_at
    )
    VALUES (
      '99000000-0000-4000-8000-000000000002'::uuid,
      pg_catalog.lpad(pg_catalog.to_hex(v_i), 64, '0'),
      NOW() - INTERVAL '48 hours' - (v_i * INTERVAL '1 minute'),
      1,
      NOW() - INTERVAL '48 hours'
    );
  END LOOP;

  SELECT COUNT(*) INTO v_expired_before
  FROM public.resource_download_rate_limits
  WHERE resource_id = '99000000-0000-4000-8000-000000000002'::uuid
    AND window_started_at < (NOW() - INTERVAL '24 hours');
  ASSERT v_expired_before = 65, 'Expected 65 seeded expired rows before bounded prune';

  v_res := public.record_free_resource_download('99000000-0000-4000-8000-000000000002'::uuid, v_cleanup_hash, 900, 10);
  ASSERT (v_res ->> 'code') = 'OK' AND (v_res ->> 'incremented')::boolean = TRUE, 'Bounded prune trigger call must succeed';

  SELECT COUNT(*) INTO v_expired_after
  FROM public.resource_download_rate_limits
  WHERE resource_id = '99000000-0000-4000-8000-000000000002'::uuid
    AND window_started_at < (NOW() - INTERVAL '24 hours');
  ASSERT v_expired_after = 15, 'Bounded LIMIT 50 prune must leave 15 of 65 expired rows (got ' || v_expired_after || ')';
END $$;

-- ==============================================================================
-- 5. TEST-OWNED CLEANUP ONLY (ROLLBACK TRANSACTION FOR ZERO RESIDUE)
-- ==============================================================================
DELETE FROM public.resource_download_rate_limits
WHERE resource_id IN (
  '99000000-0000-4000-8000-000000000001'::uuid,
  '99000000-0000-4000-8000-000000000002'::uuid,
  '99000000-0000-4000-8000-000000000003'::uuid,
  '99000000-0000-4000-8000-000000000004'::uuid,
  '99000000-0000-4000-8000-000000000005'::uuid,
  '99000000-0000-4000-8000-000000000006'::uuid,
  '99000000-0000-4000-8000-000000000007'::uuid
);

DELETE FROM public.resources
WHERE id IN (
  '99000000-0000-4000-8000-000000000001'::uuid,
  '99000000-0000-4000-8000-000000000002'::uuid,
  '99000000-0000-4000-8000-000000000003'::uuid,
  '99000000-0000-4000-8000-000000000004'::uuid,
  '99000000-0000-4000-8000-000000000005'::uuid,
  '99000000-0000-4000-8000-000000000006'::uuid,
  '99000000-0000-4000-8000-000000000007'::uuid
);

DELETE FROM auth.users
WHERE id IN (
  '99100000-0000-4000-8000-000000000001'::uuid,
  '99100000-0000-4000-8000-000000000002'::uuid,
  '99100000-0000-4000-8000-000000000003'::uuid,
  '99100000-0000-4000-8000-000000000004'::uuid,
  '99100000-0000-4000-8000-000000000005'::uuid
);

ROLLBACK;
