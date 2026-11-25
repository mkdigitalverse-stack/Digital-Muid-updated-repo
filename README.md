# DIGITALMUID V4.3 — GitHub Synchronization Package

## Target Branch
`ci/local-supabase-integration`

## Upload Instructions (Manual GitHub UI)
1. In your GitHub repository (`mkdigitalverse-stack/Digital-Muid-updated-repo`), create and switch to branch `ci/local-supabase-integration` from `main`.
2. Upload or create the following 3 new files at their exact repository-root paths:
   - `supabase/config.toml`
   - `.github/workflows/supabase-local-integration.yml`
   - `supabase/tests/supabase_local_storage_auth_test.mjs`
3. Update `supabase/operations/p0_3b_private_paid_resources_storage.sql` with the corrected regex (`(^|[^a-zA-Z0-9_])bucket_id([^a-zA-Z0-9_]|$)`).
4. Open a Pull Request from `ci/local-supabase-integration` into `main` and verify that the file diff contains *only* these four files.
5. Once merged into `main`, open **Actions** -> **Local Supabase CLI Auth & Storage Integration Tests** -> **Run workflow**.

## Included File SHA-256 Hashes
- `supabase/config.toml`: `d0774dbfa8b7a5765c4b5a8d99446a90a0283d27a1c107d070da5e60ebb6195d`
- `.github/workflows/supabase-local-integration.yml`: `a882592aa5771218239c0cdac8020aa6b545c19e9476b50fbccdb82c7346bda8`
- `supabase/tests/supabase_local_storage_auth_test.mjs`: `9c904d1578250345f624a5d8513872a75facfd0b38c4b3addd87b4c06f1da0a4`
- `supabase/operations/p0_3b_private_paid_resources_storage.sql`: `95f4f2ebaf472cbcf4fb6d628972a4bb5c27169ca15685b41b3b7c238aba9176`
