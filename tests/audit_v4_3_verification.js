// ==============================================================================
// DIGITALMUID V4.3 — FINAL SECURITY HARDENING VERIFICATION SUITE
// Tests all 6 audit findings: SEC-01 through SEC-06
// ==============================================================================
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  generateSignedInvoiceToken,
  verifySignedInvoiceToken,
  getInvoiceTokenHmacSecret,
  paymentRateLimiter,
  resetPaymentRateLimits,
  getClientIp
} from "../server/paymentRoutes.js";
import { checkIsAdmin } from "../server/supabaseServer.js";

console.log("==================================================================");
console.log("DIGITALMUID V4.3 — FINAL SECURITY HARDENING TEST SUITE");
console.log("Testing SEC-01 through SEC-06 fixes");
console.log("==================================================================");

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  testsTotal++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// ------------------------------------------------------------------------------
// 1. SEC-01: Migration Locking Audit
// ------------------------------------------------------------------------------
runTest("SEC-01.1: Phase A contains no executable CREATE UNIQUE INDEX in transaction", () => {
  const phaseAPath = path.resolve("supabase/migrations/20261107000001_student_id_and_invoices.sql");
  const sql = fs.readFileSync(phaseAPath, "utf8");

  // Split into lines to check executable (non-commented) statements
  const lines = sql.split("\n");
  const activeUniqueIndexLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) return false; // Ignore comments
    return /^CREATE\s+UNIQUE\s+INDEX/i.test(trimmed);
  });

  assert.strictEqual(
    activeUniqueIndexLines.length,
    0,
    `Phase A must NOT have any executable in-transaction CREATE UNIQUE INDEX statements. Found: ${activeUniqueIndexLines.join(", ")}`
  );
});

runTest("SEC-01.2: Phase B contains non-blocking concurrent indexes", () => {
  const phaseBPath = path.resolve("supabase/migrations/20261107000002_concurrent_indexes.sql");
  const sql = fs.readFileSync(phaseBPath, "utf8");

  const requiredIndexes = [
    "idx_credit_notes_number",
    "idx_credit_notes_refund_id",
    "idx_credit_notes_payment_id",
    "idx_credit_notes_user_id",
    "idx_profiles_student_id",
    "idx_course_enrollments_enrollment_id",
    "idx_payments_invoice_number",
    "idx_payments_credit_note_number"
  ];

  for (const idx of requiredIndexes) {
    assert.ok(sql.includes(idx), `Phase B must define ${idx}`);
    assert.ok(
      sql.includes(`INDEX CONCURRENTLY IF NOT EXISTS ${idx}`) || sql.includes(`INDEX CONCURRENTLY ${idx}`),
      `Phase B must create ${idx} using INDEX CONCURRENTLY`
    );
  }
});

// ------------------------------------------------------------------------------
// 2. SEC-02: Credit Note RPC Bypass Removal
// ------------------------------------------------------------------------------
runTest("SEC-02.1: server/paymentRoutes.js contains ZERO direct inserts into credit_notes", () => {
  const routesPath = path.resolve("server/paymentRoutes.js");
  const code = fs.readFileSync(routesPath, "utf8");

  assert.ok(!code.includes('.from("credit_notes").insert'), 'Must not have .from("credit_notes").insert');
  assert.ok(!code.includes(".from('credit_notes').insert"), "Must not have .from('credit_notes').insert");
  assert.ok(!code.includes('.from("credit_notes").upsert'), 'Must not have .from("credit_notes").upsert');
});

runTest("SEC-02.2: Controlled error response handling for RPC failures", () => {
  const routesPath = path.resolve("server/paymentRoutes.js");
  const code = fs.readFileSync(routesPath, "utf8");

  // Verify controlled HTTP 500 error codes
  assert.ok(code.includes("CREDIT_NOTE_RPC_FAILED"), "Must return CREDIT_NOTE_RPC_FAILED on RPC failure");
  assert.ok(code.includes("CREDIT_NOTE_EMPTY_RESULT"), "Must return CREDIT_NOTE_EMPTY_RESULT when RPC returns empty row");
  assert.ok(code.includes("pending_manual_reconciliation"), "Must return reconciliation tracking data on failure");
  assert.ok(code.includes("REFUND_LIMIT_EXCEEDED"), "Must return REFUND_LIMIT_EXCEEDED for business limit errors");
});

// ------------------------------------------------------------------------------
// 3. SEC-03: Invoice HMAC Secret Hardening
// ------------------------------------------------------------------------------
runTest("SEC-03.1: Hardcoded fallback salt completely removed", () => {
  const routesPath = path.resolve("server/paymentRoutes.js");
  const code = fs.readFileSync(routesPath, "utf8");

  assert.ok(!code.includes("dm_invoice_secure_salt_8731"), "Hardcoded salt 'dm_invoice_secure_salt_8731' must not exist anywhere in code");
});

runTest("SEC-03.2: getInvoiceTokenHmacSecret enforces >= 32 bytes of entropy and supports INVOICE_TOKEN_HMAC_SECRET", () => {
  const originalInvSecret = process.env.INVOICE_TOKEN_HMAC_SECRET;
  const originalSecret = process.env.PAYMENT_VERIFICATION_SECRET;
  const originalAssetSecret = process.env.ASSET_TOKEN_HMAC_SECRET;
  const originalRzpSecret = process.env.RAZORPAY_KEY_SECRET;

  try {
    delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    delete process.env.PAYMENT_VERIFICATION_SECRET;
    delete process.env.ASSET_TOKEN_HMAC_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    // Missing secrets => returns null
    assert.strictEqual(getInvoiceTokenHmacSecret(), null, "Must return null when all secrets are missing");

    // Short secret (< 32 bytes) => returns null
    process.env.PAYMENT_VERIFICATION_SECRET = "short_secret_only_24_bytes_";
    assert.strictEqual(getInvoiceTokenHmacSecret(), null, "Must return null for secret with < 32 bytes");

    // Dedicated INVOICE_TOKEN_HMAC_SECRET takes precedence
    const dedicatedSecret = "dedicated_invoice_token_secret_32_bytes_ok!";
    process.env.INVOICE_TOKEN_HMAC_SECRET = dedicatedSecret;
    process.env.PAYMENT_VERIFICATION_SECRET = "fallback_secret_32_bytes_longer_than_needed!";
    assert.strictEqual(getInvoiceTokenHmacSecret(), dedicatedSecret, "Must prioritize dedicated INVOICE_TOKEN_HMAC_SECRET");
    delete process.env.INVOICE_TOKEN_HMAC_SECRET;

    // Valid secret (>= 32 bytes) => returns secret
    const valid32Byte = "a".repeat(32);
    process.env.PAYMENT_VERIFICATION_SECRET = valid32Byte;
    assert.strictEqual(getInvoiceTokenHmacSecret(), valid32Byte, "Must return valid 32-byte secret");

    // Valid 64-byte secret => returns secret
    const valid64Byte = crypto.randomBytes(32).toString("hex");
    process.env.PAYMENT_VERIFICATION_SECRET = valid64Byte;
    assert.strictEqual(getInvoiceTokenHmacSecret(), valid64Byte, "Must return valid 64-byte hex secret");
  } finally {
    if (originalInvSecret !== undefined) process.env.INVOICE_TOKEN_HMAC_SECRET = originalInvSecret;
    else delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    if (originalSecret !== undefined) process.env.PAYMENT_VERIFICATION_SECRET = originalSecret;
    else delete process.env.PAYMENT_VERIFICATION_SECRET;
    if (originalAssetSecret !== undefined) process.env.ASSET_TOKEN_HMAC_SECRET = originalAssetSecret;
    else delete process.env.ASSET_TOKEN_HMAC_SECRET;
    if (originalRzpSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = originalRzpSecret;
    else delete process.env.RAZORPAY_KEY_SECRET;
  }
});

runTest("SEC-03.3: generateSignedInvoiceToken fails closed when secret is missing", () => {
  const originalInvSecret = process.env.INVOICE_TOKEN_HMAC_SECRET;
  const originalSecret = process.env.PAYMENT_VERIFICATION_SECRET;
  const originalAssetSecret = process.env.ASSET_TOKEN_HMAC_SECRET;
  const originalRzpSecret = process.env.RAZORPAY_KEY_SECRET;

  try {
    delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    delete process.env.PAYMENT_VERIFICATION_SECRET;
    delete process.env.ASSET_TOKEN_HMAC_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    assert.throws(
      () => generateSignedInvoiceToken("pay_test_12345"),
      /Invoice HMAC secret missing or insufficient entropy/,
      "Must throw error when secret is missing"
    );

    assert.strictEqual(
      verifySignedInvoiceToken("pay_test_12345", "123456789.abcdef"),
      false,
      "verifySignedInvoiceToken must return false when secret is missing"
    );
  } finally {
    if (originalInvSecret !== undefined) process.env.INVOICE_TOKEN_HMAC_SECRET = originalInvSecret;
    else delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    if (originalSecret !== undefined) process.env.PAYMENT_VERIFICATION_SECRET = originalSecret;
    else delete process.env.PAYMENT_VERIFICATION_SECRET;
    if (originalAssetSecret !== undefined) process.env.ASSET_TOKEN_HMAC_SECRET = originalAssetSecret;
    else delete process.env.ASSET_TOKEN_HMAC_SECRET;
    if (originalRzpSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = originalRzpSecret;
    else delete process.env.RAZORPAY_KEY_SECRET;
  }
});

runTest("SEC-03.4: Signed invoice token generation and cryptographic verification", () => {
  const originalSecret = process.env.PAYMENT_VERIFICATION_SECRET;
  try {
    process.env.PAYMENT_VERIFICATION_SECRET = "super_secure_32_byte_secret_key_prod_test_entropy!";
    const paymentId = "pay_live_test_99999";

    const token = generateSignedInvoiceToken(paymentId);
    assert.ok(typeof token === "string" && token.includes("."), "Token must be formatted as exp.signature");

    // Valid token verifies successfully
    assert.strictEqual(verifySignedInvoiceToken(paymentId, token), true, "Valid token must verify true");

    // Cross-payment tampering rejected
    assert.strictEqual(verifySignedInvoiceToken("pay_attacker_wrong", token), false, "Wrong payment ID must be rejected");

    // Tampered signature rejected
    const [exp, sig] = token.split(".");
    const tamperedSig = sig.slice(0, -2) + (sig.slice(-2) === "aa" ? "bb" : "aa");
    assert.strictEqual(verifySignedInvoiceToken(paymentId, `${exp}.${tamperedSig}`), false, "Tampered signature must be rejected");

    // Expired token rejected
    const expiredToken = generateSignedInvoiceToken(paymentId, -5000);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, expiredToken), false, "Expired token must be rejected");
  } finally {
    process.env.PAYMENT_VERIFICATION_SECRET = originalSecret;
  }
});

// ------------------------------------------------------------------------------
// 4. SEC-04: Administrator Authorization & Email Confirmation
// ------------------------------------------------------------------------------
runTest("SEC-04.1: Confirmed whitelisted admin emails are ALLOWED", () => {
  const confirmedAdmin1 = {
    id: "admin-uuid-1",
    email: "mkdigitalverse@gmail.com",
    email_confirmed_at: "2026-01-01T00:00:00Z"
  };
  assert.strictEqual(checkIsAdmin(confirmedAdmin1), true, "Confirmed mkdigitalverse@gmail.com must be admin");

  const confirmedAdmin2 = {
    id: "admin-uuid-2",
    email: "admin@digitalmuid.com",
    confirmed_at: "2026-01-01T00:00:00Z"
  };
  assert.strictEqual(checkIsAdmin(confirmedAdmin2), true, "Confirmed admin@digitalmuid.com must be admin");
});

runTest("SEC-04.2: UNCONFIRMED whitelisted admin emails are DENIED", () => {
  const unconfirmedAdmin1 = {
    id: "attacker-unconfirmed-1",
    email: "mkdigitalverse@gmail.com",
    email_confirmed_at: null,
    confirmed_at: null
  };
  assert.strictEqual(checkIsAdmin(unconfirmedAdmin1), false, "Unconfirmed mkdigitalverse@gmail.com must NOT be admin");

  const unconfirmedAdmin2 = {
    id: "attacker-unconfirmed-2",
    email: "admin@digitalmuid.com"
  };
  assert.strictEqual(checkIsAdmin(unconfirmedAdmin2), false, "Unconfirmed admin@digitalmuid.com must NOT be admin");
});

runTest("SEC-04.3: Non-admin users are DENIED", () => {
  const student = {
    id: "student-uuid-1",
    email: "student@example.com",
    email_confirmed_at: "2026-01-01T00:00:00Z"
  };
  assert.strictEqual(checkIsAdmin(student), false, "Regular student must NOT be admin");

  assert.strictEqual(checkIsAdmin(null), false, "Null user must NOT be admin");
  assert.strictEqual(checkIsAdmin({}), false, "Empty user must NOT be admin");
});

runTest("SEC-04.4: App metadata admin role is ALLOWED", () => {
  const appAdmin = {
    id: "app-admin-uuid",
    email: "ops@domain.internal",
    app_metadata: { role: "admin" }
  };
  assert.strictEqual(checkIsAdmin(appAdmin), true, "app_metadata.role === 'admin' must be admin");
});

// ------------------------------------------------------------------------------
// 5. SEC-05: Rate Limiting & Reverse Proxy Trust
// ------------------------------------------------------------------------------
runTest("SEC-05.1: server.ts sets trust proxy 1", () => {
  const serverPath = path.resolve("server.ts");
  const code = fs.readFileSync(serverPath, "utf8");

  assert.ok(code.includes('app.set("trust proxy", 1)'), 'server.ts must configure app.set("trust proxy", 1)');
});

runTest("SEC-05.2: Rate limiter allows up to 30 requests and blocks request #31 with 429", () => {
  resetPaymentRateLimits();

  const ip = "192.168.1.100";
  const req = {
    ip,
    headers: {}
  };

  let statusCode = 200;
  let responseData = null;
  let headersSent = {};

  const createRes = () => ({
    setHeader(name, val) {
      headersSent[name] = val;
    },
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
          return this;
        }
      };
    }
  });

  // Execute 30 valid requests
  for (let i = 1; i <= 30; i++) {
    let nextCalled = false;
    const res = createRes();
    paymentRateLimiter(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, `Request ${i} should be allowed`);
  }

  // Request #31 must be blocked with HTTP 429
  let nextCalled31 = false;
  const res31 = createRes();
  paymentRateLimiter(req, res31, () => {
    nextCalled31 = true;
  });

  assert.strictEqual(nextCalled31, false, "Request 31 must NOT call next()");
  assert.strictEqual(statusCode, 429, "Request 31 must return HTTP 429");
  assert.strictEqual(responseData?.code, "RATE_LIMIT_EXCEEDED", "Error code must be RATE_LIMIT_EXCEEDED");
  assert.ok(headersSent["Retry-After"], "Retry-After header must be set");
  assert.ok(Number(headersSent["Retry-After"]) > 0, "Retry-After seconds must be positive");

  resetPaymentRateLimits();
});

runTest("SEC-05.3: Reverse proxy X-Forwarded-For client IP extraction", () => {
  const reqWithProxy = {
    headers: {
      "x-forwarded-for": "203.0.113.195, 10.0.0.1"
    }
  };
  const extracted = getClientIp(reqWithProxy);
  assert.strictEqual(extracted, "203.0.113.195", "Must extract real client IP from X-Forwarded-For");
});

// ------------------------------------------------------------------------------
// 6. SEC-06: Invalid Index Recovery & Post-Deployment Validation
// ------------------------------------------------------------------------------
runTest("SEC-06.1: Phase B includes invalid index detection query (indisvalid = false)", () => {
  const phaseBPath = path.resolve("supabase/migrations/20261107000002_concurrent_indexes.sql");
  const sql = fs.readFileSync(phaseBPath, "utf8");

  assert.ok(sql.includes("i.indisvalid = false"), "Phase B must include query detecting indisvalid = false");
  assert.ok(sql.includes("i.indisready = false"), "Phase B must include query detecting indisready = false");
});

runTest("SEC-06.2: Phase B includes post-deployment validation for indisvalid AND indisready", () => {
  const phaseBPath = path.resolve("supabase/migrations/20261107000002_concurrent_indexes.sql");
  const sql = fs.readFileSync(phaseBPath, "utf8");

  assert.ok(sql.includes("i.indisvalid AS is_valid"), "Must check is_valid");
  assert.ok(sql.includes("i.indisready AS is_ready"), "Must check is_ready");
});

runTest("SEC-06.3: Phase B includes non-blocking DROP INDEX CONCURRENTLY IF EXISTS for all indexes", () => {
  const phaseBPath = path.resolve("supabase/migrations/20261107000002_concurrent_indexes.sql");
  const sql = fs.readFileSync(phaseBPath, "utf8");

  const requiredDropIndexes = [
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_number",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_refund_id",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_payment_id",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_user_id",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_profiles_student_id",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_course_enrollments_enrollment_id",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_payments_invoice_number",
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_payments_credit_note_number"
  ];

  for (const dropStmt of requiredDropIndexes) {
    assert.ok(sql.includes(dropStmt), `Phase B recovery must include: ${dropStmt}`);
  }
});

console.log("==================================================================");
console.log(`ALL ${testsPassed}/${testsTotal} DIGITALMUID V4.3 TESTS PASSED!`);
console.log("==================================================================");
