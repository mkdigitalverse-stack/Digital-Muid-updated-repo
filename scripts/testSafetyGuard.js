/**
 * AUTOMATED TESTS: STAGING SAFETY GUARD & PRODUCTION PROTECTION VERIFICATION
 *
 * Verifies that fail-closed assertions cannot be bypassed by:
 * - Missing variables
 * - Blank variables
 * - Malformed URLs
 * - Known production Supabase project (kpuxtsworzkueyffjaaz)
 * - Production Supabase project paired with ALLOW_STAGING_TEST_WRITES=true
 * - Split-brain Supabase configuration (server=staging, client=production)
 * - Encoded production URLs (percent-encoded bypass attempts)
 * - Live Razorpay credentials (rzp_live_...) in server or client variables
 * - Case variations of live keys (RZP_LIVE_...)
 * - Missing bundle upload flag
 *
 * 100% Mocked: Makes ZERO network requests, does not contact Supabase, Razorpay, or Resend.
 */

import { validateStagingSafety, redactSecret, KNOWN_PRODUCTION_HOST } from "./safetyGuard.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("================================================================================");
console.log("RUNNING MOCKED SAFETY GUARD TESTS (ZERO NETWORK CALLS)");
console.log("================================================================================\n");

// TEST 1: Missing all environment variables
console.log("[Test 1] Missing all environment variables (blank env)");
{
  const res = validateStagingSafety({}, {});
  assert(!res.isSafe, "Fails closed when environment is completely empty");
  assert(res.code === "SUPABASE_URL_MISSING", `Expected SUPABASE_URL_MISSING, got ${res.code}`);
}

// TEST 2: Blank / whitespace environment variables
console.log("\n[Test 2] Blank / whitespace environment variables");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "   ",
    RAZORPAY_KEY_ID: "   ",
    ALLOW_STAGING_TEST_WRITES: "   "
  });
  assert(!res.isSafe, "Fails closed when variables contain only whitespace");
  assert(res.code === "SUPABASE_URL_MISSING", `Expected SUPABASE_URL_MISSING, got ${res.code}`);
}

// TEST 3: Malformed Supabase URL
console.log("\n[Test 3] Malformed Supabase URL");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "not-a-valid-url-scheme",
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed on malformed Supabase URL string");
  assert(res.code === "SUPABASE_URL_MALFORMED", `Expected SUPABASE_URL_MALFORMED, got ${res.code}`);
}

// TEST 4: Production Supabase project URL without staging flag
console.log("\n[Test 4] Known production Supabase URL (kpuxtsworzkueyffjaaz.supabase.co)");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: `https://${KNOWN_PRODUCTION_HOST}`,
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "false"
  });
  assert(!res.isSafe, "Fails closed when URL matches production Supabase host");
  assert(res.code === "PRODUCTION_SUPABASE_DETECTED", `Expected PRODUCTION_SUPABASE_DETECTED, got ${res.code}`);
}

// TEST 5: CRITICAL BYPASS ATTEMPT - Production Supabase URL paired with ALLOW_STAGING_TEST_WRITES=true
console.log("\n[Test 5] BYPASS ATTEMPT: Production Supabase URL with ALLOW_STAGING_TEST_WRITES=true");
{
  const res = validateStagingSafety({}, {
    VITE_SUPABASE_URL: `https://${KNOWN_PRODUCTION_HOST}`,
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed despite ALLOW_STAGING_TEST_WRITES=true when URL is production");
  assert(res.code === "PRODUCTION_SUPABASE_DETECTED", `Expected PRODUCTION_SUPABASE_DETECTED, got ${res.code}`);
  assert(!res.error.includes("rzp_test_mock123"), "Error message does not reveal keys");
}

// TEST 6: Production project ID embedded in custom domain
console.log("\n[Test 6] Production project ID embedded in custom domain");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://kpuxtsworzkueyffjaaz.custom-domain.net",
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed when production project ID appears anywhere in host");
  assert(res.code === "PRODUCTION_SUPABASE_DETECTED", `Expected PRODUCTION_SUPABASE_DETECTED, got ${res.code}`);
}

// TEST 7: Live Razorpay key with staging database URL
console.log("\n[Test 7] Live Razorpay key (rzp_live_...) with staging Supabase URL");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://staging-demo-test.supabase.co",
    RAZORPAY_KEY_ID: "rzp_live_Secret1234567890LiveKey",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed when Razorpay key starts with rzp_live_");
  assert(res.code === "LIVE_RAZORPAY_DETECTED", `Expected LIVE_RAZORPAY_DETECTED, got ${res.code}`);
  assert(!res.error.includes("Secret1234567890LiveKey"), "Error message redacts live secret");
}

// TEST 8: Live Razorpay key case-insensitive uppercase (RZP_LIVE_...)
console.log("\n[Test 8] Live Razorpay key uppercase (RZP_LIVE_...)");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://staging-demo-test.supabase.co",
    RAZORPAY_KEY_ID: "RZP_LIVE_UPPERCASE123456",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed case-insensitively on RZP_LIVE_");
  assert(res.code === "LIVE_RAZORPAY_DETECTED", `Expected LIVE_RAZORPAY_DETECTED, got ${res.code}`);
}

// TEST 9: Staging database and test key, but missing ALLOW_STAGING_TEST_WRITES flag
console.log("\n[Test 9] Staging database and test key, but missing staging flag");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://staging-demo-test.supabase.co",
    RAZORPAY_KEY_ID: "rzp_test_validtestkey123",
    ALLOW_STAGING_TEST_WRITES: "false"
  });
  assert(!res.isSafe, "Fails closed when ALLOW_STAGING_TEST_WRITES is not strictly 'true'");
  assert(res.code === "STAGING_FLAG_MISSING", `Expected STAGING_FLAG_MISSING, got ${res.code}`);
}

// TEST 10: Valid isolated staging configuration
console.log("\n[Test 10] Valid isolated staging configuration (all assertions met)");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://dm-staging-isolated.supabase.co",
    RAZORPAY_KEY_ID: "rzp_test_safestagingkey456",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(res.isSafe === true, "Valid staging configuration passes safety validation");
  assert(!res.error, "No error returned for valid staging configuration");
  assert(res.details.supabaseHost === "dm-staging-isolated.supabase.co", "Records staging host in details");
  assert(res.details.razorpayKeyType === "TEST", "Identifies Razorpay key as TEST");
}

// TEST 11: Bundle upload safety guard
console.log("\n[Test 11] Bundle upload protection check");
{
  const withoutFlag = validateStagingSafety({ requireBundleUploadFlag: true }, {
    SUPABASE_URL: "https://dm-staging-isolated.supabase.co",
    RAZORPAY_KEY_ID: "rzp_test_safestagingkey456",
    ALLOW_STAGING_TEST_WRITES: "true",
    ALLOW_BUNDLE_ASSET_UPLOAD: "false"
  });
  assert(!withoutFlag.isSafe, "Bundle generator fails closed without ALLOW_BUNDLE_ASSET_UPLOAD=true");
  assert(withoutFlag.code === "BUNDLE_UPLOAD_FLAG_MISSING", `Expected BUNDLE_UPLOAD_FLAG_MISSING, got ${withoutFlag.code}`);

  const withFlag = validateStagingSafety({ requireBundleUploadFlag: true }, {
    SUPABASE_URL: "https://dm-staging-isolated.supabase.co",
    RAZORPAY_KEY_ID: "rzp_test_safestagingkey456",
    ALLOW_STAGING_TEST_WRITES: "true",
    ALLOW_BUNDLE_ASSET_UPLOAD: "true"
  });
  assert(withFlag.isSafe === true, "Bundle generator succeeds when explicit staging upload flag is present");
}

// TEST 12: Secret Redaction Utility Verification
console.log("\n[Test 12] Secret redaction utility");
{
  const liveSample = "rzp_live_abcdefghijklmnopqrstuvwxyz";
  const redacted = redactSecret(liveSample);
  assert(!redacted.includes("abcdefghijklm"), "Redacted key does not leak secret body");
  assert(redacted.startsWith("rzp_"), "Redacted key preserves safe prefix for debugging");
  assert(redactSecret("") === "[NOT_SET]", "Handles empty secret safely");
  assert(redactSecret("short") === "[REDACTED]", "Fully masks short secrets");
}

// TEST 13: Split-Brain Supabase URL (server points to staging, client points to production)
console.log("\n[Test 13] Split-Brain URL detection (server=staging, client=production)");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://dm-staging-isolated.supabase.co",
    VITE_SUPABASE_URL: `https://${KNOWN_PRODUCTION_HOST}`,
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed on split-brain configuration");
  assert(res.code === "SUPABASE_SPLIT_BRAIN_DETECTED", `Expected SUPABASE_SPLIT_BRAIN_DETECTED, got ${res.code}`);
}

// TEST 14: Client Supabase URL pointing to production while SUPABASE_URL is unset
console.log("\n[Test 14] Client Supabase URL pointing to production while SUPABASE_URL is unset");
{
  const res = validateStagingSafety({}, {
    VITE_SUPABASE_URL: `https://${KNOWN_PRODUCTION_HOST}`,
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed when client URL points to production even if SUPABASE_URL is unset");
  assert(res.code === "PRODUCTION_SUPABASE_DETECTED", `Expected PRODUCTION_SUPABASE_DETECTED, got ${res.code}`);
}

// TEST 15: Encoded Supabase production URL (percent-encoded bypass attempt)
console.log("\n[Test 15] Encoded Supabase production URL (https%3A%2F%2F...)");
{
  const encodedProdUrl = `https%3A%2F%2F${KNOWN_PRODUCTION_HOST}`;
  const res = validateStagingSafety({}, {
    SUPABASE_URL: encodedProdUrl,
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed on percent-encoded production Supabase URL");
  assert(res.code === "PRODUCTION_SUPABASE_DETECTED", `Expected PRODUCTION_SUPABASE_DETECTED, got ${res.code}`);
}

// TEST 16: Live key present in VITE_RAZORPAY_KEY_ID while server key is test
console.log("\n[Test 16] Live key in VITE_RAZORPAY_KEY_ID while server key is test");
{
  const res = validateStagingSafety({}, {
    SUPABASE_URL: "https://dm-staging-isolated.supabase.co",
    RAZORPAY_KEY_ID: "rzp_test_mock123",
    VITE_RAZORPAY_KEY_ID: "rzp_live_ClientKeySneakIn123",
    ALLOW_STAGING_TEST_WRITES: "true"
  });
  assert(!res.isSafe, "Fails closed when VITE_RAZORPAY_KEY_ID is live");
  assert(res.code === "LIVE_RAZORPAY_DETECTED", `Expected LIVE_RAZORPAY_DETECTED, got ${res.code}`);
}

console.log("\n================================================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
}
