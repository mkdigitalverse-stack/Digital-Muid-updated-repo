/**
 * DIGITALMUID V4.3 — LOCAL SUPABASE AUTH & STORAGE INTEGRATION TEST SUITE
 * File: supabase/tests/supabase_local_storage_auth_test.mjs
 *
 * Verifies local Supabase CLI stack behavior:
 *   1. Strict local-only URL guard (rejects non-local URLs).
 *   2. Supabase Auth signup, signin, and JWT session handling via authClient.
 *   3. Strict client isolation: anonClient is never authenticated and is used exclusively for anonymous operations.
 *   4. Private `paid-resources` bucket privacy (public = false).
 *   5. Anonymous download denial against an EXISTING private paid storage object (asserting HTTP 401/403/404 status).
 *   6. Service role secure upload to `paid-resources` via adminClient.
 *   7. Signed URL generation (900s TTL) and authorized fetch success.
 *   8. public_resources view RLS protection tested with BOTH anonClient and userClient (asserting paid file_url / external_url are NULL for both, and free resource file_url is preserved).
 */

import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

// Strict local-only URL guard: allow only http://127.0.0.1:54321 or http://localhost:54321
const normalizedUrl = SUPABASE_URL.replace(/\/+$/, "");
const allowedLocalUrls = ["http://127.0.0.1:54321", "http://localhost:54321"];
if (!allowedLocalUrls.includes(normalizedUrl)) {
  console.error(`ERROR: Strict local-only URL guard violated. SUPABASE_URL must be http://127.0.0.1:54321 or http://localhost:54321, got: ${SUPABASE_URL}`);
  process.exit(1);
}

try {
  const parsed = new URL(normalizedUrl);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "54321") {
    console.error(`ERROR: Strict local-only URL guard rejected non-local or non-standard port URL: ${SUPABASE_URL}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`ERROR: Invalid SUPABASE_URL format: ${SUPABASE_URL}`);
  process.exit(1);
}

// 1. anonClient: Strictly anonymous client with zero session persistence or login calls
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// 2. authClient: Dedicated client for user signup and password signin
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runTests() {
  console.log("=== Starting Local Supabase Auth & Storage Integration Tests (Isolated Clients & Local Guard) ===");

  // 1. Supabase Auth: Synthetic user sign up and sign in using authClient (keeping anonClient pristine)
  const testEmail = `local.student.${Date.now()}@example.test`;
  const testPassword = "SecurePassword123!";

  console.log(`- Testing Auth signup for ${testEmail} via authClient...`);
  const { data: signUpData, error: signUpErr } = await authClient.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: { data: { full_name: "Local Test Student" } }
  });
  assert.strictEqual(signUpErr, null, `Auth signup failed: ${signUpErr?.message}`);
  assert.ok(signUpData.user || signUpData.session, "Auth signup should return user or session");

  console.log("- Testing Auth sign in with authenticated JWT via authClient...");
  const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  assert.strictEqual(signInErr, null, `Auth signin failed: ${signInErr?.message}`);
  assert.ok(signInData.session?.access_token, "Auth signin should return access token");

  // 3. userClient: Authenticated client using the user's access token explicitly in headers, with autoRefreshToken: false
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } }
  });

  // 2. Storage: Verify paid-resources bucket exists and is private
  console.log("- Verifying paid-resources bucket privacy...");
  const { data: buckets, error: bucketErr } = await adminClient.storage.listBuckets();
  assert.strictEqual(bucketErr, null, `Failed to list buckets: ${bucketErr?.message}`);
  const paidBucket = buckets.find((b) => b.id === "paid-resources");
  assert.ok(paidBucket, "paid-resources bucket must exist");
  assert.strictEqual(paidBucket.public, false, "paid-resources bucket must be private (public = false)");

  // 3. Storage: Upload synthetic paid file FIRST via adminClient, then test anonymous download denial on the EXISTING object using pristine anonClient
  console.log("- Uploading synthetic paid file via adminClient...");
  const fakePdfContent = Buffer.from("%PDF-1.4 synthetic signed deliverable content");
  const objectPath = "synthetic/test-protected.pdf";
  const { error: uploadErr } = await adminClient.storage
    .from("paid-resources")
    .upload(objectPath, fakePdfContent, {
      contentType: "application/pdf",
      upsert: true
    });
  assert.strictEqual(uploadErr, null, `Service role upload failed: ${uploadErr?.message}`);

  console.log("- Testing anonymous download denial on EXISTING private asset using pristine anonClient...");
  const { data: unauthData, error: unauthErr } = await anonClient.storage
    .from("paid-resources")
    .download(objectPath);
  
  assert.ok(unauthErr, "Anonymous client download of private object must return an error response");
  
  // Inspect Supabase Storage SDK error structure strictly (accepting only HTTP 401, 403, or 404). Network/DNS/5xx errors are test failures.
  const rawStatus = unauthErr.statusCode || unauthErr.status || unauthErr.error;
  const errStatus = typeof rawStatus === "string" ? parseInt(rawStatus, 10) : Number(rawStatus);

  assert.ok(
    [401, 403, 404].includes(errStatus),
    `Expected HTTP status 401, 403, or 404 for anonymous private storage access denial, got status code ${errStatus} (raw: ${rawStatus}): ${unauthErr.message}`
  );

  // 4. Storage: Signed URL generation (900s TTL) and authorized fetch success
  console.log("- Testing signed URL generation (900s TTL)...");
  const { data: signedUrlData, error: signedUrlErr } = await adminClient.storage
    .from("paid-resources")
    .createSignedUrl(objectPath, 900);
  assert.strictEqual(signedUrlErr, null, `Signed URL generation failed: ${signedUrlErr?.message}`);
  assert.ok(signedUrlData?.signedUrl, "Signed URL should be generated");

  console.log("- Fetching asset via signed URL...");
  const fetchRes = await fetch(signedUrlData.signedUrl);
  assert.strictEqual(fetchRes.status, 200, `Signed URL fetch returned status ${fetchRes.status}`);
  const fetchedBody = await fetchRes.text();
  assert.strictEqual(fetchedBody, fakePdfContent.toString(), "Signed URL body must match uploaded content");

  // 5. Database / RLS: Insert synthetic free and paid records, assert public_resources view masks paid URLs for BOTH anonClient and userClient
  console.log("- Inserting synthetic free and paid resource records for public_resources view RLS test...");
  const freeResId = "88000000-0000-4000-8000-000000000001";
  const paidResId = "88000000-0000-4000-8000-000000000002";

  const { error: upsertErr } = await adminClient.from("resources").upsert([
    {
      id: freeResId,
      title: "Local CI Free Guide",
      slug: "local-ci-free-guide",
      resource_type: "Guide",
      access_type: "free",
      price: 0,
      currency: "INR",
      status: "published",
      file_url: "/downloads/local-ci-free.pdf",
      external_url: "https://example.test/free-companion"
    },
    {
      id: paidResId,
      title: "Local CI Paid Workbook",
      slug: "local-ci-paid-workbook",
      resource_type: "Workbook",
      access_type: "paid",
      price: 299,
      currency: "INR",
      status: "published",
      file_url: "supabase://paid-resources/synthetic/test-protected.pdf",
      external_url: "https://example.test/paid-mirror"
    }
  ]);
  assert.strictEqual(upsertErr, null, `Synthetic resources upsert failed: ${upsertErr?.message}`);

  // Test public_resources view with pristine anonClient
  console.log("- Querying public_resources view as pristine anonClient...");
  const { data: anonPubRes, error: anonPubErr } = await anonClient
    .from("public_resources")
    .select("id, title, access_type, file_url, external_url");
  assert.strictEqual(anonPubErr, null, `Anon public_resources query failed: ${anonPubErr?.message}`);

  const anonFreeRow = anonPubRes.find((r) => r.id === freeResId);
  const anonPaidRow = anonPubRes.find((r) => r.id === paidResId);

  assert.ok(anonFreeRow, "Free resource should be visible to anon in public_resources");
  assert.strictEqual(anonFreeRow.file_url, "/downloads/local-ci-free.pdf", "Anon free file_url must be preserved");

  assert.ok(anonPaidRow, "Paid resource should be visible in public_resources metadata to anon");
  assert.strictEqual(anonPaidRow.file_url, null, "Anon paid file_url must be redacted to NULL");
  assert.strictEqual(anonPaidRow.external_url, null, "Anon paid external_url must be redacted to NULL");

  // Test public_resources view with userClient
  console.log("- Querying public_resources view as userClient (JWT-authenticated)...");
  const { data: userPubRes, error: userPubErr } = await userClient
    .from("public_resources")
    .select("id, title, access_type, file_url, external_url");
  assert.strictEqual(userPubErr, null, `User public_resources query failed: ${userPubErr?.message}`);

  const userFreeRow = userPubRes.find((r) => r.id === freeResId);
  const userPaidRow = userPubRes.find((r) => r.id === paidResId);

  assert.ok(userFreeRow, "Free resource should be visible to authenticated user in public_resources");
  assert.strictEqual(userFreeRow.file_url, "/downloads/local-ci-free.pdf", "User free file_url must be preserved");

  assert.ok(userPaidRow, "Paid resource should be visible in public_resources metadata to authenticated user");
  assert.strictEqual(userPaidRow.file_url, null, "User paid file_url must be redacted to NULL");
  assert.strictEqual(userPaidRow.external_url, null, "User paid external_url must be redacted to NULL");

  console.log("=== ALL LOCAL SUPABASE AUTH & STORAGE INTEGRATION TESTS PASSED (ISOLATED CLIENTS & LOCAL GUARD) ===");
}

runTests().catch((err) => {
  console.error("Local Supabase Test Failure:", err);
  process.exit(1);
});
