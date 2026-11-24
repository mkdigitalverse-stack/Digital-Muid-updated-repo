/**
 * DIGITALMUID V4.3 — STEP 2: CONTROLLED 900-SECOND PAID DOWNLOAD EXPIRY TEST SUITE
 *
 * Strictly offline & local (zero external network, zero Supabase/PostgreSQL/Razorpay/Resend calls).
 * Verifies:
 *  1. Paid asset-token TTL and maximum accepted TTL are both strictly 900 seconds (900,000 ms).
 *  2. Exact expiry and maximum-lifetime boundaries (now === expiresAt, now === expiresAt + 1,
 *     expiresAt === now + 900_000, expiresAt === now + 900_001, and legacy 3,600s rejection).
 *  3. Single-resource paid signed URLs use 900 seconds across explicit Storage URL AND canonical
 *     bundleItem fallback paths.
 *  4. All 4 canonical bundle file signed URLs use 900 seconds on BOTH GET /api/payments/bundle-files
 *     and POST /api/payments/get-bundle-files (default bucket and explicit child Storage URL).
 *  5. Free-resource download & signing behavior remains unchanged (public free delivery + client 3,600s
 *     path strictly guarded by !isPaid).
 *  6. 30-day guest resource entitlement token and 24-hour invoice token lifetimes remain unchanged.
 *  7. Purchase entitlement remains independent of download-link expiry: both guest and authenticated
 *     buyers can obtain fresh 900-second links and complete downloads after earlier links expire.
 *  8. End-to-end Step 1 + Step 2 compatibility: resourceService.deliverResource recovers from a real
 *     expired local 900s asset token (HTTP 403 INVALID_DOWNLOAD_TOKEN) with a single server refresh.
 *
 * Run: npx tsx tests/step2_900s_paid_download_expiry_test.ts
 */

import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";

// Configure isolated offline environment BEFORE importing server or frontend modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://step2-isolated-offline-test.supabase.co";
delete process.env.VITE_SUPABASE_URL;
delete process.env.VITE_SUPABASE_ANON_KEY;
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_step2_offline_only";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_step2_offline_secret_32_bytes_min!";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_step2_offline_secret_32_bytes!!";
process.env.ASSET_TOKEN_HMAC_SECRET = "step2_asset_hmac_secret_min_32_chars_ok_9!";
process.env.INVOICE_TOKEN_HMAC_SECRET = "step2_invoice_hmac_secret_min_32_chars_ok!";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "step2_resource_hmac_secret_min_32_chars_o!";
process.env.TRUST_PROXY_HOPS = "0";

const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
  ASSET_TOKEN_TTL_MS,
  ASSET_TOKEN_MAX_TTL_MS,
  generateAssetAccessToken,
  verifyAssetAccessToken,
  generateGuestResourceToken,
  verifyGuestResourceToken,
  generateSignedInvoiceToken,
  verifySignedInvoiceToken,
  BUNDLE_RESOURCE_ID,
  BUNDLE_SLUG,
  BUNDLE_ITEMS
} = await import("../server/paymentRoutes.js");

const { resourceService } = await import("../src/services/resourceService.ts");

// Synthetic fixture UUIDs for non-canonical test rows
const SYNTH_PAID_STORAGE_ID = "92000000-0000-4000-8000-000000000001";
const SYNTH_FREE_PUBLIC_ID = "92000000-0000-4000-8000-000000000002";
const SYNTH_AUTH_BUYER_ID = "92000000-0000-4000-8000-000000000010";

let passed = 0;
let failed = 0;
let assertionCount = 0;

function eq<T>(actual: T, expected: T, message?: string) {
  assertionCount += 1;
  assert.strictEqual(actual, expected, message);
}

function ok(value: unknown, message?: string) {
  assertionCount += 1;
  assert.ok(value, message);
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  const before = assertionCount;
  try {
    await fn();
    const delta = assertionCount - before;
    if (delta === 0) throw new Error("Test executed 0 assertions");
    passed += 1;
    console.log(`  [PASS] ${name} (${delta} assertions)`);
  } catch (err: any) {
    failed += 1;
    console.error(`  [FAIL] ${name}: ${err?.message || err}`);
  }
}

function signAssetPayload(payloadObj: Record<string, unknown>, secret: string): string {
  const data = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data, "ascii").digest("base64url");
  return `${data}.${sig}`;
}

async function withPinnedClock<T>(initialMs: number, fn: (clock: { get: () => number; set: (ms: number) => void; advance: (deltaMs: number) => void }) => Promise<T>): Promise<T> {
  const realDateNow = Date.now;
  let currentMs = initialMs;
  Date.now = () => currentMs;
  try {
    return await fn({
      get: () => currentMs,
      set: (ms: number) => { currentMs = ms; },
      advance: (deltaMs: number) => { currentMs += deltaMs; }
    });
  } finally {
    Date.now = realDateNow;
  }
}

async function startPaymentServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Failed to bind local test server");
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

async function stopServer(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function createStep2MockSupabase() {
  const signCalls: Array<{ bucket: string; path: string; expiresIn: number }> = [];

  const users: Record<string, any> = {
    "tok-step2-buyer": {
      id: SYNTH_AUTH_BUYER_ID,
      email: "step2buyer@example.test",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {}
    }
  };

  const tables: Record<string, any[]> = {
    resources: [
      {
        id: SYNTH_PAID_STORAGE_ID,
        slug: "step2-paid-storage-resource",
        title: "Step 2 Paid Storage Resource",
        status: "published",
        access_type: "paid",
        price: 299,
        currency: "INR",
        file_url: "supabase://paid-resources/synthetic/step2-paid-storage.pdf",
        external_url: null
      },
      {
        id: SYNTH_FREE_PUBLIC_ID,
        slug: "step2-free-public-guide",
        title: "Step 2 Free Public Guide",
        status: "published",
        access_type: "free",
        price: 0,
        currency: "INR",
        file_url: "/downloads/step2-free-public-guide.pdf",
        external_url: null
      },
      {
        id: BUNDLE_RESOURCE_ID,
        slug: BUNDLE_SLUG,
        title: "Meta Ads Campaign Planner Bundle",
        description: "Complete 4-file Meta Ads campaign planning system.",
        status: "published",
        access_type: "paid",
        price: 49,
        currency: "INR",
        file_url: "supabase://paid-resources/bundle",
        external_url: null
      },
      // Canonical bundle item 0 configured for legacy local protected-asset token path
      {
        id: BUNDLE_ITEMS[0].id,
        slug: BUNDLE_ITEMS[0].slug,
        title: BUNDLE_ITEMS[0].title,
        status: "published",
        access_type: "paid",
        price: 49,
        currency: "INR",
        file_url: "/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
        external_url: null
      },
      // Canonical bundle item 1 configured with file_url: null to exercise the canonical bundleItem fallback signing branch
      {
        id: BUNDLE_ITEMS[1].id,
        slug: BUNDLE_ITEMS[1].slug,
        title: BUNDLE_ITEMS[1].title,
        status: "published",
        access_type: "paid",
        price: 49,
        currency: "INR",
        file_url: null,
        external_url: null
      }
    ],
    payments: [],
    resource_purchases: []
  };

  const client = {
    auth: {
      async getUser(token: string) {
        const u = users[token];
        if (!u) return { data: { user: null }, error: new Error("Invalid token") };
        return { data: { user: u }, error: null };
      }
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(objectPath: string, expiresIn: number) {
            signCalls.push({ bucket, path: objectPath, expiresIn });
            return {
              data: {
                signedUrl: `https://signed.offline.test/storage/v1/object/sign/${bucket}/${objectPath}?token=step2_sig_${expiresIn}_${signCalls.length}`
              },
              error: null
            };
          }
        };
      }
    },
    from(table: string) {
      const filters: Array<{ op: string; col: string; val: any }> = [];
      const exec = async (singleMode: "maybeSingle" | "single" | null) => {
        const rows = (tables[table] || []).filter((row) =>
          filters.every((f) => {
            if (f.op === "eq") return row[f.col] === f.val;
            if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
            if (f.op === "ilike") {
              return String(row[f.col] || "").toLowerCase() === String(f.val || "").toLowerCase();
            }
            return true;
          })
        );
        if (singleMode === "maybeSingle") return { data: rows[0] || null, error: null };
        if (singleMode === "single") return { data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } };
        return { data: rows, error: null };
      };
      const builder: any = {
        select() { return builder; },
        eq(col: string, val: any) { filters.push({ op: "eq", col, val }); return builder; },
        in(col: string, val: any) { filters.push({ op: "in", col, val }); return builder; },
        ilike(col: string, val: any) { filters.push({ op: "ilike", col, val }); return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() { return exec("maybeSingle"); },
        single() { return exec("single"); },
        then(resolve: any, reject: any) { return exec(null).then(resolve, reject); }
      };
      return builder;
    }
  };

  return { client, tables, signCalls };
}

async function main() {
  console.log("==================================================================");
  console.log("DIGITALMUID V4.3 — STEP 2: 900-SECOND PAID DOWNLOAD EXPIRY TESTS");
  console.log("==================================================================");

  const mock = createStep2MockSupabase();
  setMockSupabaseServerClient(mock.client);
  const { server, baseUrl } = await startPaymentServer();

  const expectedWorkbookPdf = fs.readFileSync(
    path.resolve("server/protected_downloads/meta-ads-campaign-planner-workbook.pdf")
  );
  const T0 = 1_780_000_000_000;

  try {
    // 1. Constants & Exact 900s Token Issuance
    await runTest("2.1 Paid asset-token TTL, max accepted TTL, and signed URL TTL constants are strictly 900 seconds", async () => {
      eq(PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS, 900);
      eq(ASSET_TOKEN_TTL_MS, 900_000);
      eq(ASSET_TOKEN_MAX_TTL_MS, 900_000);

      await withPinnedClock(T0, async () => {
        const tok = generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_step2_ttl_check");
        ok(tok, "Expected valid v2 asset token");
        const decoded = verifyAssetAccessToken(tok!);
        ok(decoded, "Expected freshly generated token to verify");
        eq(decoded!.v, 2);
        eq(decoded!.expiresAt, T0 + 900_000);
        eq(decoded!.expiresAt - T0, 900_000);
      });
    });

    // 2. Exact Expiry & Max-Lifetime Boundaries (Unit + HTTP)
    await runTest("2.2 Exact 900s expiry and max-TTL boundaries (now === expiresAt accepted, +1ms rejected, 900_001ms future rejected, former 3,600s rejected)", async () => {
      const secret = process.env.ASSET_TOKEN_HMAC_SECRET!;

      await withPinnedClock(T0, async (clock) => {
        const tokAtBoundaryNow = signAssetPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_boundary_exact",
            filename: "meta-ads-campaign-planner-workbook.pdf",
            expiresAt: T0
          },
          secret
        );
        const tokExpiredBy1Ms = signAssetPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_boundary_exp1",
            filename: "meta-ads-campaign-planner-workbook.pdf",
            expiresAt: T0 - 1
          },
          secret
        );
        const tokAtExact900s = signAssetPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_boundary_900s",
            filename: "meta-ads-campaign-planner-workbook.pdf",
            expiresAt: T0 + 900_000
          },
          secret
        );
        const tokOver900sBy1Ms = signAssetPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_boundary_900s_plus_1",
            filename: "meta-ads-campaign-planner-workbook.pdf",
            expiresAt: T0 + 900_001
          },
          secret
        );
        const tokFormer3600sV2 = signAssetPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_former_3600_v2",
            filename: "meta-ads-campaign-planner-workbook.pdf",
            expiresAt: T0 + 3_600_000
          },
          secret
        );
        const tokFormer3600sV1 = signAssetPayload(
          {
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_former_3600_v1",
            expiresAt: T0 + 3_600_000
          },
          secret
        );

        // Unit verification
        ok(verifyAssetAccessToken(tokAtBoundaryNow), "now === expiresAt must be accepted");
        eq(verifyAssetAccessToken(tokExpiredBy1Ms), null, "now === expiresAt + 1 must be rejected");
        ok(verifyAssetAccessToken(tokAtExact900s), "expiresAt === now + 900_000 must be accepted");
        eq(verifyAssetAccessToken(tokOver900sBy1Ms), null, "expiresAt === now + 900_001 must be rejected");
        eq(verifyAssetAccessToken(tokFormer3600sV2), null, "3,600s v2 token must be rejected");
        eq(verifyAssetAccessToken(tokFormer3600sV1), null, "3,600s legacy v1 token must be rejected");

        // HTTP verification against real route (header-only Authorization: Bearer transport — Finding 3)
        resetPaymentRateLimits();
        const resExactNow = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${tokAtBoundaryNow}` }
        });
        eq(resExactNow.status, 200);
        ok(Buffer.from(await resExactNow.arrayBuffer()).equals(expectedWorkbookPdf));

        resetPaymentRateLimits();
        const resExact900 = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${tokAtExact900s}` }
        });
        eq(resExact900.status, 200);
        ok(Buffer.from(await resExact900.arrayBuffer()).equals(expectedWorkbookPdf));

        for (const [label, tok] of [
          ["expired by 1ms", tokExpiredBy1Ms],
          ["over 900s by 1ms", tokOver900sBy1Ms],
          ["former 3,600s v2", tokFormer3600sV2],
          ["former 3,600s v1", tokFormer3600sV1]
        ]) {
          resetPaymentRateLimits();
          const res = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
            headers: { Authorization: `Bearer ${tok}` }
          });
          eq(res.status, 403, `Expected 403 for ${label}`);
          ok(String(res.headers.get("cache-control") || "").includes("no-store"));
          const body = await res.json();
          eq(body.success, false);
          eq(body.code, "INVALID_DOWNLOAD_TOKEN");
        }

        // Advance clock by 1ms: previously valid exact-now token now expires cleanly
        clock.advance(1);
        eq(verifyAssetAccessToken(tokAtBoundaryNow), null, "Token must fail 1ms after exact expiry");
      });
    });

    // 3. Single-Resource Paid Signed URLs (Explicit Storage URL + Canonical bundleItem Fallback)
    await runTest("2.3 Single-resource paid signed URLs use 900s for both explicit Storage URL and canonical bundleItem fallback paths", async () => {
      mock.signCalls.length = 0;
      mock.tables.payments.push(
        {
          id: "pay-row-step2-auth-storage",
          user_id: SYNTH_AUTH_BUYER_ID,
          item_type: "resource",
          item_id: SYNTH_PAID_STORAGE_ID,
          status: "captured",
          amount: 299,
          currency: "INR",
          razorpay_payment_id: "pay_step2_auth_storage",
          razorpay_order_id: "order_step2_auth_storage",
          customer_email: "step2buyer@example.test"
        },
        {
          id: "pay-row-step2-auth-fallback",
          user_id: SYNTH_AUTH_BUYER_ID,
          item_type: "resource",
          item_id: BUNDLE_ITEMS[1].id,
          status: "captured",
          amount: 49,
          currency: "INR",
          razorpay_payment_id: "pay_step2_auth_fallback",
          razorpay_order_id: "order_step2_auth_fallback",
          customer_email: "step2buyer@example.test"
        },
        {
          id: "pay-row-step2-guest-storage",
          user_id: null,
          item_type: "resource",
          item_id: SYNTH_PAID_STORAGE_ID,
          status: "captured",
          amount: 299,
          currency: "INR",
          razorpay_payment_id: "pay_step2_guest_storage",
          razorpay_order_id: "order_step2_guest_storage",
          customer_email: "guest.step2@example.test"
        }
      );

      // Branch A1: Authenticated buyer, explicit supabase://paid-resources/...
      resetPaymentRateLimits();
      const rAuthExplicit = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok-step2-buyer"
        },
        body: JSON.stringify({ resourceId: SYNTH_PAID_STORAGE_ID })
      });
      eq(rAuthExplicit.status, 200);
      const bAuthExplicit = await rAuthExplicit.json();
      eq(bAuthExplicit.success, true);
      ok(String(bAuthExplicit.downloadUrl).includes("/storage/v1/object/sign/paid-resources/synthetic/step2-paid-storage.pdf"));
      eq(mock.signCalls.length, 1);
      eq(mock.signCalls[0].bucket, "paid-resources");
      eq(mock.signCalls[0].path, "synthetic/step2-paid-storage.pdf");
      eq(mock.signCalls[0].expiresIn, 900);

      // Branch A2: Guest buyer with 30-day guest resourceAccessToken, explicit Storage URL
      const guestStorageTok = generateGuestResourceToken({
        paymentId: "pay_step2_guest_storage",
        orderId: "order_step2_guest_storage",
        resourceId: SYNTH_PAID_STORAGE_ID,
        email: "guest.step2@example.test"
      });
      resetPaymentRateLimits();
      const rGuestExplicit = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Resource-Access-Token": guestStorageTok
        },
        body: JSON.stringify({
          resourceId: SYNTH_PAID_STORAGE_ID,
          paymentId: "pay_step2_guest_storage",
          orderId: "order_step2_guest_storage"
        })
      });
      eq(rGuestExplicit.status, 200);
      const bGuestExplicit = await rGuestExplicit.json();
      eq(bGuestExplicit.success, true);
      eq(mock.signCalls.length, 2);
      eq(mock.signCalls[1].expiresIn, 900);

      // Branch B: Canonical bundleItem fallback (file_url === null)
      resetPaymentRateLimits();
      const rFallback = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok-step2-buyer"
        },
        body: JSON.stringify({ resourceId: BUNDLE_ITEMS[1].id })
      });
      eq(rFallback.status, 200);
      const bFallback = await rFallback.json();
      eq(bFallback.success, true);
      eq(mock.signCalls.length, 3);
      eq(mock.signCalls[2].bucket, "paid-resources");
      eq(mock.signCalls[2].path, BUNDLE_ITEMS[1].storagePath);
      eq(mock.signCalls[2].expiresIn, 900);
    });

    // 4. All 4 Canonical Bundle Deliverables Signed at 900s on BOTH GET & POST Endpoints
    await runTest("2.4 All 4 canonical bundle file signed URLs use 900s on GET /bundle-files and POST /get-bundle-files (auth & guest)", async () => {
      // Configure bundle child rows cleanly for Storage signing (no local disk path on child row 0 during bundle-files check)
      const origItem0Url = mock.tables.resources.find((r) => r.id === BUNDLE_ITEMS[0].id)!.file_url;
      mock.tables.resources.find((r) => r.id === BUNDLE_ITEMS[0].id)!.file_url =
        `supabase://paid-resources/${BUNDLE_ITEMS[0].storagePath}`;

      mock.tables.payments.push(
        {
          id: "pay-row-step2-auth-bundle",
          user_id: SYNTH_AUTH_BUYER_ID,
          item_type: "resource",
          item_id: BUNDLE_RESOURCE_ID,
          status: "captured",
          amount: 49,
          currency: "INR",
          razorpay_payment_id: "pay_step2_auth_bundle",
          razorpay_order_id: "order_step2_auth_bundle",
          customer_email: "step2buyer@example.test"
        },
        {
          id: "pay-row-step2-guest-bundle",
          user_id: null,
          item_type: "resource",
          item_id: BUNDLE_RESOURCE_ID,
          status: "captured",
          amount: 49,
          currency: "INR",
          razorpay_payment_id: "pay_step2_guest_bundle",
          razorpay_order_id: "order_step2_guest_bundle",
          customer_email: "guest.bundle@example.test"
        }
      );

      const guestBundleTok = generateGuestResourceToken({
        paymentId: "pay_step2_guest_bundle",
        orderId: "order_step2_guest_bundle",
        resourceId: BUNDLE_RESOURCE_ID,
        email: "guest.bundle@example.test"
      });

      try {
        // 4A. GET /api/payments/bundle-files (authenticated)
        mock.signCalls.length = 0;
        resetPaymentRateLimits();
        const rGetAuth = await fetch(`${baseUrl}/api/payments/bundle-files`, {
          headers: { Authorization: "Bearer tok-step2-buyer" }
        });
        eq(rGetAuth.status, 200);
        const bGetAuth = await rGetAuth.json();
        eq(bGetAuth.success, true);
        eq(bGetAuth.authorized, true);
        eq(bGetAuth.files.length, 4);
        eq(mock.signCalls.length, 4);
        for (const call of mock.signCalls) {
          eq(call.bucket, "paid-resources");
          eq(call.expiresIn, 900);
        }

        // 4B. POST /api/payments/get-bundle-files (guest with 30-day token)
        mock.signCalls.length = 0;
        resetPaymentRateLimits();
        const rPostGuest = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Resource-Access-Token": guestBundleTok
          },
          body: JSON.stringify({
            paymentId: "pay_step2_guest_bundle",
            orderId: "order_step2_guest_bundle"
          })
        });
        eq(rPostGuest.status, 200);
        const bPostGuest = await rPostGuest.json();
        eq(bPostGuest.success, true);
        eq(bPostGuest.authorized, true);
        eq(bPostGuest.files.length, 4);
        eq(mock.signCalls.length, 4);
        for (const call of mock.signCalls) {
          eq(call.bucket, "paid-resources");
          eq(call.expiresIn, 900);
        }
      } finally {
        mock.tables.resources.find((r) => r.id === BUNDLE_ITEMS[0].id)!.file_url = origItem0Url;
      }
    });

    // 5. Free-Resource Signing Behavior Remains Unchanged
    await runTest("2.5 Free-resource delivery & signing remain unchanged (public free delivery untouched, client free signing stays 3,600s under !isPaid guard)", async () => {
      mock.signCalls.length = 0;
      resetPaymentRateLimits();
      const rFree = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: SYNTH_FREE_PUBLIC_ID })
      });
      eq(rFree.status, 200);
      const bFree = await rFree.json();
      eq(bFree.success, true);
      eq(bFree.accessType, "free");
      eq(bFree.downloadUrl, "/downloads/step2-free-public-guide.pdf");
      eq(mock.signCalls.length, 0, "Free public resource must not invoke paid Storage signing");

      // Verify client-side free-resource signing branch in src/services/resourceService.ts stays 3,600s and guarded by !isPaid
      const resourceServiceSource = fs.readFileSync(path.resolve("src/services/resourceService.ts"), "utf8");
      const freeSignBlockMatch = resourceServiceSource.match(
        /if\s*\(\s*!isPaid\s*&&[\s\S]{0,750}\.from\('resources'\)\s*\.createSignedUrl\(storageObjectPath,\s*3600\)/
      );
      ok(freeSignBlockMatch, "Expected free-resource client signing to remain at 3600s under !isPaid guard");

      // Verify server/paymentRoutes.js has ZERO remaining hardcoded 3600 paid signing calls
      const paymentRoutesSource = fs.readFileSync(path.resolve("server/paymentRoutes.js"), "utf8");
      eq(/\.createSignedUrl\([^)]*3600\)/.test(paymentRoutesSource), false, "No paid createSignedUrl call in server/paymentRoutes.js may use 3600");
    });

    // 6. Guest 30-Day Resource Token & 24-Hour Invoice Token Lifetimes Unchanged
    await runTest("2.6 30-day guest resource entitlement token and 24-hour invoice token lifetimes remain unchanged", async () => {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

      // 6A. Guest 30-day resource access token
      const guestTok = generateGuestResourceToken({
        paymentId: "pay_step2_guest_30d",
        orderId: "order_step2_guest_30d",
        resourceId: BUNDLE_RESOURCE_ID,
        email: "guest30d@example.test",
        nowMs: T0
      });
      const verifiedAtIssue = verifyGuestResourceToken(guestTok, {
        paymentId: "pay_step2_guest_30d",
        orderId: "order_step2_guest_30d",
        resourceId: BUNDLE_RESOURCE_ID,
        nowMs: T0
      });
      eq(verifiedAtIssue.valid, true);
      eq(verifiedAtIssue.payload.exp - verifiedAtIssue.payload.iat, THIRTY_DAYS_MS);

      const verifiedDay29 = verifyGuestResourceToken(guestTok, {
        paymentId: "pay_step2_guest_30d",
        orderId: "order_step2_guest_30d",
        resourceId: BUNDLE_RESOURCE_ID,
        nowMs: T0 + 29 * 24 * 60 * 60 * 1000
      });
      eq(verifiedDay29.valid, true, "Guest token must still be valid on day 29");

      const verifiedAfter30d = verifyGuestResourceToken(guestTok, {
        paymentId: "pay_step2_guest_30d",
        orderId: "order_step2_guest_30d",
        resourceId: BUNDLE_RESOURCE_ID,
        nowMs: T0 + THIRTY_DAYS_MS + 1
      });
      eq(verifiedAfter30d.valid, false);
      eq(verifiedAfter30d.code, "EXPIRED_GUEST_TOKEN");

      // 6B. 24-hour signed invoice token
      await withPinnedClock(T0, async (clock) => {
        const invTok = generateSignedInvoiceToken("pay_step2_inv_24h");
        const expMs = Number(invTok.split(".")[0]);
        eq(expMs, T0 + TWENTY_FOUR_HOURS_MS);
        eq(verifySignedInvoiceToken("pay_step2_inv_24h", invTok), true);

        clock.set(T0 + 23 * 60 * 60 * 1000);
        eq(verifySignedInvoiceToken("pay_step2_inv_24h", invTok), true, "Invoice token must still be valid at 23h");

        clock.set(T0 + TWENTY_FOUR_HOURS_MS + 1);
        eq(verifySignedInvoiceToken("pay_step2_inv_24h", invTok), false, "Invoice token must expire after 24h");
      });
    });

    // 7. Purchase Entitlement Independence — Guest Buyer Fresh Download After 900s Expiry
    await runTest("2.7 Guest buyer retains purchase entitlement after 900s link expiry and obtains fresh 900s download link", async () => {
      mock.tables.payments.push({
        id: "pay-row-step2-guest-local",
        user_id: null,
        item_type: "resource",
        item_id: BUNDLE_ITEMS[0].id,
        status: "captured",
        amount: 49,
        currency: "INR",
        razorpay_payment_id: "pay_step2_guest_local",
        razorpay_order_id: "order_step2_guest_local",
        customer_email: "guest.local@example.test"
      });

      await withPinnedClock(T0, async (clock) => {
        const guestTok = generateGuestResourceToken({
          paymentId: "pay_step2_guest_local",
          orderId: "order_step2_guest_local",
          resourceId: BUNDLE_ITEMS[0].id,
          email: "guest.local@example.test",
          nowMs: T0
        });

        // Initial issuance at T0
        resetPaymentRateLimits();
        const r1 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Resource-Access-Token": guestTok
          },
          body: JSON.stringify({
            resourceId: BUNDLE_ITEMS[0].id,
            paymentId: "pay_step2_guest_local",
            orderId: "order_step2_guest_local"
          })
        });
        eq(r1.status, 200);
        const b1 = await r1.json();
        eq(String(b1.downloadUrl), "/api/payments/download-paid-asset");
        const tok1 = String(b1.assetAccessToken || "");
        ok(tok1.length > 0, "Expected assetAccessToken in JSON authorization response");
        eq(verifyAssetAccessToken(tok1)!.expiresAt, T0 + 900_000);

        // Advance clock past 900s (15m 1s later)
        clock.advance(901_000);

        // Old download link fails with 403 INVALID_DOWNLOAD_TOKEN
        resetPaymentRateLimits();
        const rExpired = await fetch(`${baseUrl}${b1.downloadUrl}`, {
          headers: { Authorization: `Bearer ${tok1}` }
        });
        eq(rExpired.status, 403);
        const bExpired = await rExpired.json();
        eq(bExpired.code, "INVALID_DOWNLOAD_TOKEN");

        // Same guest re-requests fresh link with original 30-day guest resourceAccessToken
        resetPaymentRateLimits();
        const r2 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Resource-Access-Token": guestTok
          },
          body: JSON.stringify({
            resourceId: BUNDLE_ITEMS[0].id,
            paymentId: "pay_step2_guest_local",
            orderId: "order_step2_guest_local"
          })
        });
        eq(r2.status, 200);
        const b2 = await r2.json();
        eq(String(b2.downloadUrl), "/api/payments/download-paid-asset");
        const tok2 = String(b2.assetAccessToken || "");
        ok(tok2 !== tok1, "Fresh token must differ from expired token");
        eq(verifyAssetAccessToken(tok2)!.expiresAt, T0 + 901_000 + 900_000);

        // Fresh 900s token streams full PDF successfully
        resetPaymentRateLimits();
        const rFresh = await fetch(`${baseUrl}${b2.downloadUrl}`, {
          headers: { Authorization: `Bearer ${tok2}` }
        });
        eq(rFresh.status, 200);
        ok(Buffer.from(await rFresh.arrayBuffer()).equals(expectedWorkbookPdf));
      });
    });

    // 8. Purchase Entitlement Independence — Authenticated Buyer Fresh Download After 900s Expiry
    await runTest("2.8 Authenticated buyer retains purchase entitlement after 900s link expiry and obtains fresh 900s download link", async () => {
      mock.tables.payments.push({
        id: "pay-row-step2-auth-local",
        user_id: SYNTH_AUTH_BUYER_ID,
        item_type: "resource",
        item_id: BUNDLE_ITEMS[0].id,
        status: "captured",
        amount: 49,
        currency: "INR",
        razorpay_payment_id: "pay_step2_auth_local",
        razorpay_order_id: "order_step2_auth_local",
        customer_email: "step2buyer@example.test"
      });

      await withPinnedClock(T0, async (clock) => {
        // Initial issuance at T0
        resetPaymentRateLimits();
        const r1 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer tok-step2-buyer"
          },
          body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
        });
        eq(r1.status, 200);
        const b1 = await r1.json();
        eq(String(b1.downloadUrl), "/api/payments/download-paid-asset");
        const tok1 = String(b1.assetAccessToken || "");
        eq(verifyAssetAccessToken(tok1)!.expiresAt, T0 + 900_000);

        // Advance clock past 900s (20 minutes later)
        clock.advance(20 * 60 * 1000);

        // Old download link fails with 403 INVALID_DOWNLOAD_TOKEN
        resetPaymentRateLimits();
        const rExpired = await fetch(`${baseUrl}${b1.downloadUrl}`, {
          headers: { Authorization: `Bearer ${tok1}` }
        });
        eq(rExpired.status, 403);
        const bExpired = await rExpired.json();
        eq(bExpired.code, "INVALID_DOWNLOAD_TOKEN");

        // Same authenticated buyer re-requests fresh link
        resetPaymentRateLimits();
        const r2 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer tok-step2-buyer"
          },
          body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
        });
        eq(r2.status, 200);
        const b2 = await r2.json();
        eq(String(b2.downloadUrl), "/api/payments/download-paid-asset");
        const tok2 = String(b2.assetAccessToken || "");
        ok(tok2 !== tok1);
        eq(verifyAssetAccessToken(tok2)!.expiresAt, T0 + 20 * 60 * 1000 + 900_000);

        // Fresh 900s token streams full PDF successfully
        resetPaymentRateLimits();
        const rFresh = await fetch(`${baseUrl}${b2.downloadUrl}`, {
          headers: { Authorization: `Bearer ${tok2}` }
        });
        eq(rFresh.status, 200);
        ok(Buffer.from(await rFresh.arrayBuffer()).equals(expectedWorkbookPdf));
      });
    });

    // 9. End-to-End Step 1 + Step 2 Interop (Real Expired Local 900s Token -> Single Automatic Refresh -> Clean Download)
    await runTest("2.9 End-to-end Step 1 + Step 2: deliverResource recovers from real HTTP 403 INVALID_DOWNLOAD_TOKEN with exactly one 900s refresh", async () => {
      const origDocument = (globalThis as any).document;
      const origWindow = (globalThis as any).window;
      const origFetch = globalThis.fetch;
      const origCreateObjectURL = URL.createObjectURL;
      const origRevokeObjectURL = URL.revokeObjectURL;

      const recordedAnchors: Array<{ href: string; download: string; clicked: boolean }> = [];
      let getUrlCalls = 0;
      let downloadAssetCalls = 0;

      try {
        (globalThis as any).document = {
          body: {
            appendChild() {},
            removeChild() {}
          },
          createElement(tag: string) {
            if (tag !== "a") return {};
            const anchor = {
              href: "",
              download: "",
              target: "",
              rel: "",
              clicked: false,
              setAttribute() {},
              click() {
                anchor.clicked = true;
              }
            };
            recordedAnchors.push(anchor);
            return anchor;
          }
        };
        (globalThis as any).window = {
          location: { origin: baseUrl }
        };
        (URL as any).createObjectURL = () => "blob:step2-e2e-workbook";
        (URL as any).revokeObjectURL = () => {};

        await withPinnedClock(T0, async (clock) => {
          const guestTok = generateGuestResourceToken({
            paymentId: "pay_step2_guest_local",
            orderId: "order_step2_guest_local",
            resourceId: BUNDLE_ITEMS[0].id,
            email: "guest.local@example.test",
            nowMs: T0
          });

          // Route relative `/api/...` calls to our live local Express server.
          // Advance the pinned clock by 901s right before the FIRST `/download-paid-asset` fetch
          // so the real server rejects the first 900s token with HTTP 403 INVALID_DOWNLOAD_TOKEN.
          globalThis.fetch = ((input: any, init?: any) => {
            const urlStr = typeof input === "string" ? input : String(input?.url || input);
            const resolved = urlStr.startsWith("/") ? `${baseUrl}${urlStr}` : urlStr;
            if (urlStr.includes("/api/payments/get-resource-download-url")) {
              getUrlCalls += 1;
            } else if (urlStr.includes("/api/payments/download-paid-asset")) {
              downloadAssetCalls += 1;
              if (downloadAssetCalls === 1) {
                clock.advance(901_000);
              }
            }
            return origFetch(resolved, init);
          }) as typeof fetch;

          resetPaymentRateLimits();
          const result = await resourceService.deliverResource(
            {
              id: BUNDLE_ITEMS[0].id,
              slug: BUNDLE_ITEMS[0].slug,
              title: BUNDLE_ITEMS[0].title,
              description: BUNDLE_ITEMS[0].description,
              resourceType: "pdf",
              status: "published",
              category: "Meta Ads",
              format: "PDF",
              accessType: "paid",
              price: 49,
              fileUrl: undefined
            },
            {
              paymentId: "pay_step2_guest_local",
              orderId: "order_step2_guest_local",
              resourceAccessToken: guestTok
            }
          );

          eq(result.success, true, `Expected deliverResource success, got: ${JSON.stringify(result)}`);
          eq(getUrlCalls, 2, "Expected initial URL fetch + exactly 1 refresh call after 900s expiry");
          eq(downloadAssetCalls, 2, "Expected first expired 403 attempt + 1 successful retry");
          eq(recordedAnchors.length, 1);
          eq(recordedAnchors[0].clicked, true);
          eq(recordedAnchors[0].download, "meta-ads-campaign-planner-workbook.pdf");
          eq(recordedAnchors[0].download.includes("token="), false);
        });
      } finally {
        (globalThis as any).document = origDocument;
        (globalThis as any).window = origWindow;
        globalThis.fetch = origFetch;
        (URL as any).createObjectURL = origCreateObjectURL;
        (URL as any).revokeObjectURL = origRevokeObjectURL;
      }
    });
  } finally {
    await stopServer(server);
    setMockSupabaseServerClient(null);
  }

  console.log("\n==================================================================");
  console.log(`STEP 2 TEST SUMMARY: ${passed} passed, ${failed} failed (${assertionCount} assertions)`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error in Step 2 test suite:", err);
  process.exit(1);
});
