/**
 * DIGITALMUID V4.3 — SAFE HMAC SECRET CUTOVER REGRESSION SUITE
 *
 * Strictly isolated unit, Express route, and compiled server health tests (no live Supabase/Razorpay).
 * Verifies:
 * 1. Invoice token generation uses INVOICE_TOKEN_HMAC_SECRET exclusively.
 * 2. Invoice token verification supports INVOICE_TOKEN_HMAC_SECRET + legacy fallbacks
 *    (PAYMENT_VERIFICATION_SECRET, ASSET_TOKEN_HMAC_SECRET, RAZORPAY_KEY_SECRET) in priority order (>= 32 bytes).
 * 3. Expired, tampered, and weak (< 32-byte) invoice tokens remain strictly rejected.
 * 4. RESOURCE_TOKEN_HMAC_SECRET fails closed BEFORE any DB fulfillment write on guest verification.
 * 5. Resource tokens work with a valid dedicated secret and reject missing/placeholder secrets.
 * 6. Compiled dist/server.cjs /healthz endpoint reports boolean indicators, fails health (503/degraded)
 *    when required token secrets are missing, passes (200/ok) when all 3 are set, and never leaks secrets or lengths.
 */

import assert from "node:assert";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";

// Pre-configure isolated test safety env BEFORE importing payment modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.VITE_SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_cutover_suite_12345";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_cutover_secret_placeholder_ok";

const {
  getInvoiceTokenHmacSecret,
  isInvoiceTokenSecretConfigured,
  getInvoiceTokenVerificationSecrets,
  generateSignedInvoiceToken,
  tryGenerateSignedInvoiceToken,
  verifySignedInvoiceToken
} = await import("../server/invoiceToken.js");
const {
  getResourceTokenHmacSecret,
  isResourceTokenSecretConfigured,
  generateGuestResourceToken,
  tryGenerateGuestResourceToken,
  verifyGuestResourceToken
} = await import("../server/resourceToken.js");
const { default: paymentRoutes, resetPaymentRateLimits } = await import("../server/paymentRoutes.js");
const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const { setMockRazorpayClient } = await import("../server/razorpay.js");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

function legacySignInvoice(paymentId, secret, expiresInMs = 60_000) {
  const exp = Date.now() + expiresInMs;
  const sig = crypto.createHmac("sha256", secret).update(`${paymentId}:${exp}`).digest("hex");
  return `${exp}.${sig}`;
}

function snapshotSecretEnv() {
  return {
    INVOICE_TOKEN_HMAC_SECRET: process.env.INVOICE_TOKEN_HMAC_SECRET,
    PAYMENT_VERIFICATION_SECRET: process.env.PAYMENT_VERIFICATION_SECRET,
    ASSET_TOKEN_HMAC_SECRET: process.env.ASSET_TOKEN_HMAC_SECRET,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RESOURCE_TOKEN_HMAC_SECRET: process.env.RESOURCE_TOKEN_HMAC_SECRET
  };
}

function restoreSecretEnv(snap) {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

console.log("==============================================================================");
console.log("   DIGITALMUID V4.3 — SAFE HMAC SECRET CUTOVER REGRESSION TESTS");
console.log("==============================================================================\n");

// -----------------------------------------------------------------------------
// SECTION 1: INVOICE TOKEN EXCLUSIVE GENERATION & BACKWARD COMPATIBILITY
// -----------------------------------------------------------------------------
console.log("[1] Invoice Token Exclusive Generation & Legacy Verification Fallback");

runTest("1.1 New invoice tokens MUST require dedicated INVOICE_TOKEN_HMAC_SECRET (>= 32 bytes) exclusively", () => {
  const snap = snapshotSecretEnv();
  try {
    delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    process.env.PAYMENT_VERIFICATION_SECRET = "legacy_pay_verify_secret_at_least_32_bytes_long!";
    process.env.ASSET_TOKEN_HMAC_SECRET = "legacy_asset_secret_at_least_32_bytes_long_abc!";
    process.env.RAZORPAY_KEY_SECRET = "legacy_rzp_secret_at_least_32_bytes_long_xyz!";

    assert.strictEqual(getInvoiceTokenHmacSecret(), null);
    assert.strictEqual(isInvoiceTokenSecretConfigured(), false);
    assert.strictEqual(tryGenerateSignedInvoiceToken("pay_exclusive_01"), null);
    assert.throws(
      () => generateSignedInvoiceToken("pay_exclusive_01"),
      /Invoice HMAC secret missing or insufficient entropy/
    );

    // Reject placeholder and < 32-byte dedicated secret
    process.env.INVOICE_TOKEN_HMAC_SECRET = "generate_at_least_32_bytes_random_hex_secret_here";
    assert.strictEqual(getInvoiceTokenHmacSecret(), null);
    assert.strictEqual(isInvoiceTokenSecretConfigured(), false);

    process.env.INVOICE_TOKEN_HMAC_SECRET = "too_short_31_bytes_123456789012";
    assert.strictEqual(getInvoiceTokenHmacSecret(), null);
    assert.strictEqual(tryGenerateSignedInvoiceToken("pay_exclusive_01"), null);
  } finally {
    restoreSecretEnv(snap);
  }
});

runTest("1.2 New invoice tokens are signed exclusively with INVOICE_TOKEN_HMAC_SECRET and never fallback secret", () => {
  const snap = snapshotSecretEnv();
  try {
    const dedicated = "dedicated_invoice_secret_32_bytes_minimum_value_1!";
    const legacyPay = "legacy_payment_verif_secret_32_bytes_minimum_value!";
    process.env.INVOICE_TOKEN_HMAC_SECRET = dedicated;
    process.env.PAYMENT_VERIFICATION_SECRET = legacyPay;

    const paymentId = "pay_dedicated_only_01";
    const token = generateSignedInvoiceToken(paymentId, 60_000);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, token), true);

    // Confirm signature matches ONLY dedicated secret, not fallback secret
    delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    assert.strictEqual(verifySignedInvoiceToken(paymentId, token), false);
  } finally {
    restoreSecretEnv(snap);
  }
});

runTest("1.3 Existing unexpired invoice tokens signed with legacy fallbacks remain verifiable in priority order", () => {
  const snap = snapshotSecretEnv();
  try {
    const dedicated = "dedicated_invoice_secret_priority_32_bytes_long_0!";
    const legacyPay = "legacy_payment_verif_priority_32_bytes_long_1!";
    const legacyAsset = "legacy_asset_secret_priority_32_bytes_long_2!";
    const legacyRzp = "legacy_rzp_secret_priority_32_bytes_long_3!";

    const paymentId = "pay_legacy_chain_01";
    const tokPay = legacySignInvoice(paymentId, legacyPay, 120_000);
    const tokAsset = legacySignInvoice(paymentId, legacyAsset, 120_000);
    const tokRzp = legacySignInvoice(paymentId, legacyRzp, 120_000);

    process.env.INVOICE_TOKEN_HMAC_SECRET = dedicated;
    process.env.PAYMENT_VERIFICATION_SECRET = legacyPay;
    process.env.ASSET_TOKEN_HMAC_SECRET = legacyAsset;
    process.env.RAZORPAY_KEY_SECRET = legacyRzp;

    assert.deepStrictEqual(getInvoiceTokenVerificationSecrets(), [
      dedicated,
      legacyPay,
      legacyAsset,
      legacyRzp
    ]);

    assert.strictEqual(verifySignedInvoiceToken(paymentId, tokPay), true);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, tokAsset), true);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, tokRzp), true);
    assert.strictEqual(verifySignedInvoiceToken("pay_other_user_id", tokPay), false);
  } finally {
    restoreSecretEnv(snap);
  }
});

runTest("1.4 Expired, malformed, tampered, and < 32-byte fallback invoice tokens are rejected", () => {
  const snap = snapshotSecretEnv();
  try {
    const shortLegacy = "short_legacy_rzp_secret_24";
    const validDedicated = "valid_dedicated_invoice_hmac_secret_32_bytes_long!";
    process.env.INVOICE_TOKEN_HMAC_SECRET = validDedicated;
    process.env.PAYMENT_VERIFICATION_SECRET = shortLegacy;
    delete process.env.ASSET_TOKEN_HMAC_SECRET;
    process.env.RAZORPAY_KEY_SECRET = shortLegacy;

    // Short (< 32 byte) fallback secret MUST NOT verify tokens
    const paymentId = "pay_neg_checks_01";
    const tokenFromShortSecret = legacySignInvoice(paymentId, shortLegacy, 60_000);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, tokenFromShortSecret), false);

    // Expired token signed with valid legacy or dedicated secret must fail
    const validLegacy = "valid_legacy_32_byte_secret_for_expiry_check_ok!";
    process.env.PAYMENT_VERIFICATION_SECRET = validLegacy;
    const expiredLegacyTok = legacySignInvoice(paymentId, validLegacy, -5_000);
    const expiredDedicatedTok = legacySignInvoice(paymentId, validDedicated, -5_000);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, expiredLegacyTok), false);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, expiredDedicatedTok), false);

    // Tampered signature & non-hex garbage must fail
    const validTok = generateSignedInvoiceToken(paymentId, 60_000);
    const [exp, sig] = validTok.split(".");
    const tampered = `${exp}.${sig.slice(0, -2)}${sig.endsWith("00") ? "ff" : "00"}`;
    assert.strictEqual(verifySignedInvoiceToken(paymentId, tampered), false);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, `${exp}.not_hex_zzzz`), false);
    assert.strictEqual(verifySignedInvoiceToken(paymentId, `${exp}.${sig}.extra`), false);
  } finally {
    restoreSecretEnv(snap);
  }
});

// -----------------------------------------------------------------------------
// SECTION 2: RESOURCE TOKEN SECURITY & PRE-FULFILLMENT GUARD
// -----------------------------------------------------------------------------
console.log("\n[2] Resource Token Mandatory Enforcement & Pre-Fulfillment Fail-Closed");

runTest("2.1 RESOURCE_TOKEN_HMAC_SECRET enforces 32-byte minimum, placeholder rejection, and zero fallback", () => {
  const snap = snapshotSecretEnv();
  try {
    process.env.INVOICE_TOKEN_HMAC_SECRET = "valid_invoice_secret_32_bytes_minimum_value_ok!";
    process.env.ASSET_TOKEN_HMAC_SECRET = "valid_asset_secret_32_bytes_minimum_value_ok!";
    delete process.env.RESOURCE_TOKEN_HMAC_SECRET;

    assert.strictEqual(getResourceTokenHmacSecret(), null);
    assert.strictEqual(isResourceTokenSecretConfigured(), false);
    assert.strictEqual(
      tryGenerateGuestResourceToken({ paymentId: "pay_1", orderId: "order_1", resourceId: "res_1" }).ok,
      false
    );
    assert.strictEqual(verifyGuestResourceToken("abc.def").code, "RESOURCE_TOKEN_SECRET_MISSING");

    process.env.RESOURCE_TOKEN_HMAC_SECRET = "generate_at_least_32_bytes_random_hex_secret_here";
    assert.strictEqual(isResourceTokenSecretConfigured(), false);

    const validSecret = "valid_resource_hmac_secret_at_least_32_bytes_ok!";
    process.env.RESOURCE_TOKEN_HMAC_SECRET = validSecret;
    assert.strictEqual(isResourceTokenSecretConfigured(), true);
    const token = generateGuestResourceToken({
      paymentId: "pay_res_1",
      orderId: "order_res_1",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      email: "guest@example.com"
    });
    const verified = verifyGuestResourceToken(token, {
      paymentId: "pay_res_1",
      orderId: "order_res_1",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17"
    });
    assert.strictEqual(verified.valid, true);
  } finally {
    restoreSecretEnv(snap);
  }
});

await runAsyncTest("2.2 Guest /verify-resource-payment detects missing RESOURCE_TOKEN_HMAC_SECRET BEFORE any DB fulfillment RPC/write", async () => {
  const snap = snapshotSecretEnv();
  const BUNDLE_ID = "2d50e5e3-711d-4461-a70d-0ed54dd29f17";
  const USER_ID = "10000000-0000-4000-8000-000000000001";
  let rpcCalls = 0;

  const rzpSecret = "rzp_test_cutover_secret_32_bytes_ok!";
  process.env.RAZORPAY_KEY_SECRET = rzpSecret;
  process.env.INVOICE_TOKEN_HMAC_SECRET = "inv_cutover_secret_32_bytes_minimum_ok!";

  const mockDb = {
    auth: {
      async getUser(token) {
        if (token === "auth-user-token") {
          return { data: { user: { id: USER_ID, email: "authbuyer@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" } }, error: null };
        }
        return { data: { user: null }, error: new Error("Invalid") };
      }
    },
    from(table) {
      if (table === "resources") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: { id: BUNDLE_ID, slug: "meta-ads-campaign-planner-bundle", title: "Meta Ads Bundle", status: "published", access_type: "paid", price: 299, currency: "INR" },
              error: null
            };
          }
        };
      }
      if (table === "email_logs") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: null, error: null }; }
        };
      }
      throw new Error(`Unexpected direct DB mutation/query on table '${table}' during pre-fulfillment guard test`);
    },
    async rpc(fnName) {
      rpcCalls++;
      if (fnName === "fulfill_resource_purchase") {
        return {
          data: {
            success: true,
            fulfilled: true,
            already_fulfilled: false,
            purchase: { id: "rp_1", resource_id: BUNDLE_ID, payment_id: "pay_auth_ok" },
            payment: { id: "pm_1", razorpay_payment_id: "pay_auth_ok" },
            lead_status: "saved",
            lead_id: "lead_1"
          },
          error: null
        };
      }
      return { data: null, error: null };
    }
  };

  const gatewayOrders = new Map([
    ["order_guest_guard", { id: "order_guest_guard", amount: 29900, currency: "INR", notes: { itemType: "resource", resourceId: BUNDLE_ID, customerEmail: "guest@example.com" } }],
    ["order_auth_guard", { id: "order_auth_guard", amount: 29900, currency: "INR", notes: { itemType: "resource", resourceId: BUNDLE_ID, userId: USER_ID, customerEmail: "authbuyer@example.com" } }]
  ]);
  const gatewayPayments = new Map([
    ["pay_guest_guard", { id: "pay_guest_guard", order_id: "order_guest_guard", amount: 29900, currency: "INR", status: "captured", email: "guest@example.com" }],
    ["pay_auth_guard", { id: "pay_auth_guard", order_id: "order_auth_guard", amount: 29900, currency: "INR", status: "captured", email: "authbuyer@example.com" }]
  ]);

  setMockSupabaseServerClient(mockDb);
  setMockRazorpayClient({
    orders: { async fetch(id) { return gatewayOrders.get(id) || null; } },
    payments: { async fetch(id) { return gatewayPayments.get(id) || null; } }
  });

  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Missing RESOURCE_TOKEN_HMAC_SECRET => guest order MUST fail 503 BEFORE any fulfill_resource_purchase RPC
    delete process.env.RESOURCE_TOKEN_HMAC_SECRET;
    resetPaymentRateLimits();

    const guestSig = crypto.createHmac("sha256", rzpSecret).update("order_guest_guard|pay_guest_guard").digest("hex");
    const guestRes = await fetch(`http://127.0.0.1:${port}/api/payments/verify-resource-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: "order_guest_guard",
        razorpay_payment_id: "pay_guest_guard",
        razorpay_signature: guestSig,
        resourceId: BUNDLE_ID,
        customerDetails: { name: "Guest", email: "guest@example.com" }
      })
    });
    const guestBody = await guestRes.json();
    assert.strictEqual(guestRes.status, 503);
    assert.strictEqual(guestBody.fulfilled, false);
    assert.strictEqual(guestBody.code, "RESOURCE_TOKEN_SECRET_MISSING");
    assert.strictEqual(rpcCalls, 0, "Irreversible fulfillment RPC MUST NOT execute when guest secret is missing");

    // Authenticated purchase does not require guest RESOURCE_TOKEN_HMAC_SECRET and fulfills cleanly
    const authSig = crypto.createHmac("sha256", rzpSecret).update("order_auth_guard|pay_auth_guard").digest("hex");
    const authRes = await fetch(`http://127.0.0.1:${port}/api/payments/verify-resource-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer auth-user-token" },
      body: JSON.stringify({
        razorpay_order_id: "order_auth_guard",
        razorpay_payment_id: "pay_auth_guard",
        razorpay_signature: authSig,
        resourceId: BUNDLE_ID
      })
    });
    const authBody = await authRes.json();
    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(authBody.fulfilled, true);
    assert.strictEqual(rpcCalls, 1);

    // Restoring RESOURCE_TOKEN_HMAC_SECRET allows guest verification & token issuance
    process.env.RESOURCE_TOKEN_HMAC_SECRET = "restored_resource_secret_32_bytes_minimum_ok!";
    const guestOkRes = await fetch(`http://127.0.0.1:${port}/api/payments/verify-resource-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: "order_guest_guard",
        razorpay_payment_id: "pay_guest_guard",
        razorpay_signature: guestSig,
        resourceId: BUNDLE_ID,
        customerDetails: { name: "Guest", email: "guest@example.com" }
      })
    });
    const guestOkBody = await guestOkRes.json();
    assert.strictEqual(guestOkRes.status, 200);
    assert.strictEqual(guestOkBody.fulfilled, true);
    assert.ok(guestOkBody.resourceAccessToken);
    assert.strictEqual(rpcCalls, 2);
  } finally {
    setMockSupabaseServerClient(null);
    setMockRazorpayClient(null);
    server.close();
    restoreSecretEnv(snap);
  }
});

// -----------------------------------------------------------------------------
// SECTION 3: COMPILED DIST SERVER HEALTH ENDPOINT & ZERO SECRET EXPOSURE
// -----------------------------------------------------------------------------
console.log("\n[3] Compiled dist/server.cjs /healthz & Package Start Config");

runTest("3.1 package.json start script targets compiled CommonJS dist/server.cjs", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
  assert.strictEqual(pkg.scripts?.start, "node dist/server.cjs");
  assert.ok(pkg.dependencies?.vite, "Runtime vite dependency must remain preserved until dynamic import migration");
  assert.ok(fs.existsSync(path.resolve("dist/server.cjs")), "dist/server.cjs must exist after build");
});

function httpGetLocal(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: reqPath, timeout: 4000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
  });
}

async function withCompiledServer(envOverrides, testPort, fn) {
  const cleanEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME || "/tmp",
    NODE_ENV: "production",
    APP_ENV: "production",
    PORT: String(testPort),
    DOTENV_CONFIG_PATH: "/dev/null",
    ...envOverrides
  };
  let outputLogs = "";
  const child = spawn(process.execPath, ["dist/server.cjs"], {
    cwd: process.cwd(),
    env: cleanEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (d) => (outputLogs += d.toString()));
  child.stderr.on("data", (d) => (outputLogs += d.toString()));

  try {
    let up = false;
    for (let i = 0; i < 40; i++) {
      if (child.exitCode !== null) break;
      try {
        await httpGetLocal(testPort, "/healthz");
        up = true;
        break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.strictEqual(up, true, `dist/server.cjs failed to start on port ${testPort}`);
    await fn({ getLogs: () => outputLogs });
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const t = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, 3000);
        child.once("exit", () => { clearTimeout(t); resolve(); });
      });
    }
  }
}

await runAsyncTest("3.2 /healthz degrades (503) when required HMAC secrets are missing, passes (200) when configured, and never leaks values or lengths", async () => {
  const sentinelAsset = "sentinel_asset_hmac_secret_32_bytes_do_not_expose_!";
  const sentinelResource = "sentinel_resource_hmac_secret_32_bytes_do_not_expose!";
  const sentinelInvoice = "sentinel_invoice_hmac_secret_32_bytes_do_not_expose_!";

  // Case A: Partial config (missing RESOURCE_TOKEN_HMAC_SECRET) => HTTP 503 status !== "ok"
  await withCompiledServer(
    {
      ASSET_TOKEN_HMAC_SECRET: sentinelAsset,
      INVOICE_TOKEN_HMAC_SECRET: sentinelInvoice
    },
    4193,
    async ({ getLogs }) => {
      const res = await httpGetLocal(4193, "/healthz");
      assert.strictEqual(res.status, 503);
      const data = JSON.parse(res.body);
      assert.notStrictEqual(data.status, "ok");
      assert.strictEqual(data.status, "degraded");
      assert.strictEqual(data.gateway.assetTokenSecretConfigured, true);
      assert.strictEqual(data.gateway.resourceTokenSecretConfigured, false);
      assert.strictEqual(data.gateway.invoiceTokenSecretConfigured, true);

      // Zero secret values or explicit lengths exposed
      const serialized = res.body + "\n" + getLogs();
      assert.strictEqual(serialized.includes(sentinelAsset), false);
      assert.strictEqual(serialized.includes(sentinelInvoice), false);
      assert.strictEqual(/length/i.test(res.body), false);
    }
  );

  // Case B: All 3 required HMAC secrets configured => HTTP 200 status === "ok"
  await withCompiledServer(
    {
      ASSET_TOKEN_HMAC_SECRET: sentinelAsset,
      RESOURCE_TOKEN_HMAC_SECRET: sentinelResource,
      INVOICE_TOKEN_HMAC_SECRET: sentinelInvoice
    },
    4194,
    async ({ getLogs }) => {
      const res = await httpGetLocal(4194, "/healthz");
      assert.strictEqual(res.status, 200);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.status, "ok");
      assert.strictEqual(data.gateway.assetTokenSecretConfigured, true);
      assert.strictEqual(data.gateway.resourceTokenSecretConfigured, true);
      assert.strictEqual(data.gateway.invoiceTokenSecretConfigured, true);

      const serialized = res.body + "\n" + getLogs();
      assert.strictEqual(serialized.includes(sentinelAsset), false);
      assert.strictEqual(serialized.includes(sentinelResource), false);
      assert.strictEqual(serialized.includes(sentinelInvoice), false);
      assert.strictEqual(/length/i.test(res.body), false);
    }
  );
});

console.log("\n==============================================================================");
console.log(`HMAC CUTOVER REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==============================================================================");

if (failed > 0) {
  process.exit(1);
}
