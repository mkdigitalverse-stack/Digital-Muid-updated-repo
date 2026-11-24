/**
 * DIGITALMUID V4.3 — FINDING 3 REMEDIATION: PAID ASSET TOKEN & RESPONSE HEADER HARDENING TEST SUITE
 *
 * Strictly offline & local (zero external network, zero Supabase/PostgreSQL/Razorpay/Resend calls).
 * Verifies:
 *  1. Newly minted paid asset tokens omit `authId`, `paymentId`, `orderId`, `userId`, `email`, and
 *     all other unnecessary identity metadata (both unit-level and via HTTP issuance for guest and
 *     authenticated buyers), even when a legacy second argument is passed.
 *  2. `verifyAssetAccessToken()` preserves resource binding, filename binding, dedicated
 *     `ASSET_TOKEN_HMAC_SECRET` verification (zero Razorpay fallback), strict canonical Base64URL,
 *     and 900-second max TTL — and NEVER returns `authId` in verified results.
 *  3. Safe transition policy: in-flight pre-cutover v2/v1 tokens carrying a valid `authId` within
 *     <= 900s are still accepted during natural expiry while stripping `authId` from return values;
 *     invalid `authId` values or forbidden identity keys (`paymentId`, `orderId`, `userId`, `email`)
 *     are strictly rejected.
 *  4. Header-only transport for `GET /api/payments/download-paid-asset`:
 *     - `POST /api/payments/get-resource-download-url` returns `downloadUrl: "/api/payments/download-paid-asset"`
 *       (no `?token=` in `downloadUrl` or `fileUrl`) and `assetAccessToken` in JSON body.
 *     - `GET /api/payments/download-paid-asset?token=...`, `?access_token=...`, `?assetAccessToken=...`
 *       are strictly rejected with HTTP 403 `QUERY_TOKEN_FORBIDDEN` even if a valid Authorization header
 *       is also present.
 *     - Missing, Basic, malformed, whitespace-containing, or duplicate `Authorization` headers are
 *       rejected with HTTP 403 `INVALID_DOWNLOAD_TOKEN`.
 *     - Valid `Authorization: Bearer <token>` with no query params streams exact PDF bytes (HTTP 200).
 *  5. Response hardening headers (`Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
 *     `Cache-Control` with `no-store`):
 *     - Present on `GET /api/payments/download-paid-asset` for 200, 403 (`QUERY_TOKEN_FORBIDDEN`,
 *       `INVALID_DOWNLOAD_TOKEN`, `TOKEN_RESOURCE_MISMATCH`, `TOKEN_FILE_MISMATCH`), and 404
 *       (`UNMAPPED_PROTECTED_ASSET`).
 *     - Present on paid `POST /api/payments/get-resource-download-url` (both Storage signed URL and
 *       local-disk compatibility branches) and on `GET /api/payments/bundle-files` &
 *       `POST /api/payments/get-bundle-files`.
 *     - NOT added to free-resource responses from `POST /api/payments/get-resource-download-url`.
 *  6. Frontend header-only delivery (`buildProtectedLocalAssetRequest` & `resourceService.deliverResource`):
 *     - Strips any accidental query-string token into `Authorization: Bearer`.
 *     - End-to-end against real local Express server: downloads exact PDF bytes via `Authorization: Bearer`,
 *       never places a token in the request URL, and recovers once on expired 900s token.
 *  7. Non-target tokens untouched: guest resource token (30-day TTL) and invoice token (24-hour TTL)
 *     behave identically to baseline.
 *
 * Run: npx tsx tests/finding3_asset_token_hardening_test.ts
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
process.env.SUPABASE_URL = "https://finding3-isolated-offline-test.supabase.co";
delete process.env.VITE_SUPABASE_URL;
delete process.env.VITE_SUPABASE_ANON_KEY;
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_finding3_offline_only";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_finding3_offline_secret_32_bytes!!";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_finding3_offline_secret_32_byte!";
process.env.ASSET_TOKEN_HMAC_SECRET = "finding3_asset_hmac_secret_min_32_chars_ok!";
process.env.INVOICE_TOKEN_HMAC_SECRET = "finding3_invoice_hmac_secret_min_32_chars_!";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "finding3_resource_hmac_secret_min_32_chars!";
process.env.TRUST_PROXY_HOPS = "0";

const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  ASSET_TOKEN_TTL_MS,
  ASSET_TOKEN_MAX_TTL_MS,
  extractBearerAssetToken,
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

const {
  resourceService,
  buildProtectedLocalAssetRequest
} = await import("../src/services/resourceService.ts");

const SYNTH_PAID_STORAGE_ID = "93000000-0000-4000-8000-000000000001";
const SYNTH_FREE_PUBLIC_ID = "93000000-0000-4000-8000-000000000002";
const SYNTH_UNMAPPED_ID = "93000000-0000-4000-8000-000000000009";
const SYNTH_AUTH_BUYER_ID = "93000000-0000-4000-8000-000000000010";

let passed = 0;
let failed = 0;
let assertionCount = 0;

function eq<T>(actual: T, expected: T, message?: string) {
  assertionCount += 1;
  assert.strictEqual(actual, expected, message);
}

function deepEq<T>(actual: T, expected: T, message?: string) {
  assertionCount += 1;
  assert.deepStrictEqual(actual, expected, message);
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

function signRawAssetPayload(payloadObj: Record<string, unknown>, secret: string): string {
  const data = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data, "ascii").digest("base64url");
  return `${data}.${sig}`;
}

function decodeRawAssetPayload(token: string): Record<string, unknown> {
  const [data] = token.split(".");
  return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
}

async function withPinnedClock<T>(
  initialMs: number,
  fn: (clock: { get: () => number; set: (ms: number) => void; advance: (deltaMs: number) => void }) => Promise<T>
): Promise<T> {
  const realDateNow = Date.now;
  let currentMs = initialMs;
  Date.now = () => currentMs;
  try {
    return await fn({
      get: () => currentMs,
      set: (ms: number) => {
        currentMs = ms;
      },
      advance: (deltaMs: number) => {
        currentMs += deltaMs;
      }
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

function createFinding3MockSupabase() {
  const users: Record<string, any> = {
    "tok-f3-buyer": {
      id: SYNTH_AUTH_BUYER_ID,
      email: "f3buyer@example.test",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {}
    }
  };

  const tables: Record<string, any[]> = {
    resources: [
      {
        id: SYNTH_PAID_STORAGE_ID,
        slug: "f3-paid-storage-resource",
        title: "Finding 3 Paid Storage Resource",
        status: "published",
        access_type: "paid",
        price: 299,
        currency: "INR",
        file_url: "supabase://paid-resources/synthetic/f3-paid-storage.pdf",
        external_url: null
      },
      {
        id: SYNTH_FREE_PUBLIC_ID,
        slug: "f3-free-public-guide",
        title: "Finding 3 Free Public Guide",
        status: "published",
        access_type: "free",
        price: 0,
        currency: "INR",
        file_url: "/downloads/f3-free-public-guide.pdf",
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

  let signCounter = 0;

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
            signCounter += 1;
            return {
              data: {
                signedUrl: `https://signed.offline.test/storage/v1/object/sign/${bucket}/${objectPath}?token=f3_sig_${expiresIn}_${signCounter}`
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
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          filters.push({ op: "eq", col, val });
          return builder;
        },
        in(col: string, val: any) {
          filters.push({ op: "in", col, val });
          return builder;
        },
        ilike(col: string, val: any) {
          filters.push({ op: "ilike", col, val });
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          return exec("maybeSingle");
        },
        single() {
          return exec("single");
        },
        then(resolve: any, reject: any) {
          return exec(null).then(resolve, reject);
        }
      };
      return builder;
    }
  };

  return { client, tables };
}

function assertPaidHardeningHeaders(headers: Headers, label: string) {
  eq(
    headers.get("referrer-policy"),
    "no-referrer",
    `${label}: expected Referrer-Policy: no-referrer`
  );
  eq(
    headers.get("x-content-type-options"),
    "nosniff",
    `${label}: expected X-Content-Type-Options: nosniff`
  );
  const cc = String(headers.get("cache-control") || "").toLowerCase();
  ok(cc.includes("no-store"), `${label}: expected Cache-Control to include no-store, got "${cc}"`);
}

async function main() {
  console.log("====================================================================");
  console.log("DIGITALMUID V4.3 — FINDING 3: ASSET TOKEN & HEADER HARDENING TESTS");
  console.log("====================================================================");

  const mock = createFinding3MockSupabase();
  setMockSupabaseServerClient(mock.client);
  const { server, baseUrl } = await startPaymentServer();

  const expectedWorkbookPdf = fs.readFileSync(
    path.resolve("server/protected_downloads/meta-ads-campaign-planner-workbook.pdf")
  );
  const T0 = 1_790_000_000_000;

  try {
    // 1. Minimal token payload (unit-level)
    await runTest("3.1 Newly minted asset tokens contain ONLY minimal resource/filename/expiry fields (zero identity metadata)", async () => {
      await withPinnedClock(T0, async () => {
        // Even if a legacy caller passes a second argument, it MUST NOT be embedded in the payload.
        const tokWithLegacyArg = (generateAssetAccessToken as any)(
          BUNDLE_ITEMS[0].id,
          "pay_SENSITIVE_SHOULD_NOT_APPEAR"
        );
        ok(tokWithLegacyArg, "Expected token to be minted");

        const rawPayload = decodeRawAssetPayload(tokWithLegacyArg);
        deepEq(
          Object.keys(rawPayload).sort(),
          ["expiresAt", "filename", "resourceId", "v"],
          "Allowlisted resource token payload must contain only v, resourceId, filename, expiresAt"
        );
        eq(rawPayload.v, 2);
        eq(rawPayload.resourceId, BUNDLE_ITEMS[0].id);
        eq(rawPayload.filename, "meta-ads-campaign-planner-workbook.pdf");
        eq(rawPayload.expiresAt, T0 + ASSET_TOKEN_TTL_MS);
        eq(rawPayload.authId, undefined);
        eq(rawPayload.paymentId, undefined);
        eq(rawPayload.orderId, undefined);
        eq(rawPayload.userId, undefined);
        eq(rawPayload.email, undefined);
        ok(!JSON.stringify(rawPayload).includes("pay_SENSITIVE"), "Raw payload must not contain legacy arg");

        const verified = verifyAssetAccessToken(tokWithLegacyArg);
        ok(verified, "Expected freshly minted token to verify");
        deepEq(
          Object.keys(verified!).sort(),
          ["expiresAt", "filename", "resourceId", "v"],
          "Verified result must not expose authId or identity fields"
        );
        eq((verified as any).authId, undefined);

        // Unmapped ID omits filename as well
        const unmappedTok = generateAssetAccessToken(SYNTH_UNMAPPED_ID);
        ok(unmappedTok, "Expected unmapped token to be minted");
        const unmappedPayload = decodeRawAssetPayload(unmappedTok!);
        deepEq(Object.keys(unmappedPayload).sort(), ["expiresAt", "resourceId", "v"]);
        eq(unmappedPayload.authId, undefined);
      });
    });

    // 2. Safe transition policy for pre-cutover tokens & strict rejection of malformed/forbidden fields
    await runTest("3.2 Safe transition accepts in-flight pre-cutover authId tokens (<=900s) while omitting authId, and rejects forbidden identity fields or invalid authId", async () => {
      const secret = process.env.ASSET_TOKEN_HMAC_SECRET!;
      const rzpSecret = process.env.RAZORPAY_KEY_SECRET!;

      await withPinnedClock(T0, async () => {
        // Pre-cutover v2 token with valid authId within 900s -> accepted, authId stripped
        const preCutoverV2 = signRawAssetPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_inflight_pre_cutover_001",
            filename: "meta-ads-campaign-planner-workbook.pdf",
            expiresAt: T0 + 300_000
          },
          secret
        );
        const decodedV2 = verifyAssetAccessToken(preCutoverV2);
        ok(decodedV2, "In-flight pre-cutover v2 token within 900s must still verify");
        eq(decodedV2!.v, 2);
        eq(decodedV2!.resourceId, BUNDLE_ITEMS[0].id);
        eq(decodedV2!.filename, "meta-ads-campaign-planner-workbook.pdf");
        eq((decodedV2 as any).authId, undefined, "authId MUST be stripped from verifyAssetAccessToken result");

        // Pre-cutover legacy v1 token with valid authId within 900s -> accepted, authId stripped
        const preCutoverV1 = signRawAssetPayload(
          {
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_inflight_v1_001",
            expiresAt: T0 + 300_000
          },
          secret
        );
        const decodedV1 = verifyAssetAccessToken(preCutoverV1);
        ok(decodedV1, "In-flight pre-cutover v1 token within 900s must still verify");
        eq(decodedV1!.v, 1);
        eq((decodedV1 as any).legacy, true);
        eq((decodedV1 as any).authId, undefined, "authId MUST be stripped from legacy v1 result too");

        // Invalid authId forms -> strictly rejected
        const invalidAuthIdPayloads = [
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "", filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "   ", filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: 12345, filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a".repeat(129), filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 }
        ];
        for (const p of invalidAuthIdPayloads) {
          eq(verifyAssetAccessToken(signRawAssetPayload(p, secret)), null, `Invalid authId must be rejected: ${JSON.stringify(p.authId)}`);
        }

        // Forbidden identity fields -> strictly rejected
        const forbiddenKeyPayloads = [
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, paymentId: "pay_123", filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, orderId: "order_123", filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, userId: SYNTH_AUTH_BUYER_ID, filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, email: "buyer@example.test", filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 }
        ];
        for (const p of forbiddenKeyPayloads) {
          eq(verifyAssetAccessToken(signRawAssetPayload(p, secret)), null, `Forbidden identity key must be rejected: ${Object.keys(p).join(",")}`);
        }

        // Wrong secret (Razorpay secret), over-900s TTL, expired, padded base64url, and tampered sig -> rejected
        const rzpSigned = signRawAssetPayload(
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + 60_000 },
          rzpSecret
        );
        eq(verifyAssetAccessToken(rzpSigned), null, "Razorpay-signed token must be rejected");

        const overTtl = signRawAssetPayload(
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 + ASSET_TOKEN_MAX_TTL_MS + 1 },
          secret
        );
        eq(verifyAssetAccessToken(overTtl), null, "Token >900s must be rejected");

        const expired = signRawAssetPayload(
          { v: 2, resourceId: BUNDLE_ITEMS[0].id, filename: "meta-ads-campaign-planner-workbook.pdf", expiresAt: T0 - 1 },
          secret
        );
        eq(verifyAssetAccessToken(expired), null, "Expired token must be rejected");

        const validTok = generateAssetAccessToken(BUNDLE_ITEMS[0].id)!;
        const [d, s] = validTok.split(".");
        eq(verifyAssetAccessToken(`${d}.${s}=`), null, "Padded base64url signature must be rejected");
        const flippedSig = `${s.slice(0, -1)}${s.endsWith("A") ? "B" : "A"}`;
        eq(verifyAssetAccessToken(`${d}.${flippedSig}`), null, "Tampered signature must be rejected");
      });
    });

    // 3. extractBearerAssetToken strict parser unit tests
    await runTest("3.3 extractBearerAssetToken strictly accepts single Bearer token and rejects malformed Authorization headers", () => {
      eq(extractBearerAssetToken({ headers: { authorization: "Bearer abc.def" } } as any), "abc.def");
      eq(extractBearerAssetToken({ headers: { authorization: "bearer abc.def" } } as any), "abc.def");
      eq(extractBearerAssetToken({ headers: { authorization: "  Bearer   abc.def  " } } as any), "abc.def");
      eq(extractBearerAssetToken({ headers: {} } as any), null);
      eq(extractBearerAssetToken({ headers: { authorization: "" } } as any), null);
      eq(extractBearerAssetToken({ headers: { authorization: "Basic dXNlcjpwYXNz" } } as any), null);
      eq(extractBearerAssetToken({ headers: { authorization: "Bearer" } } as any), null);
      eq(extractBearerAssetToken({ headers: { authorization: "Bearer tok1 tok2" } } as any), null);
      eq(extractBearerAssetToken({ headers: { authorization: "Bearer tok1, Bearer tok2" } } as any), null);
    });

    // 4. HTTP issuance for both guest and authenticated buyers omits identity data and never embeds ?token= in downloadUrl
    await runTest("3.4 POST /api/payments/get-resource-download-url (guest & authenticated) emits clean header-only downloadUrl, minimal assetAccessToken, and paid hardening headers", async () => {
      resetPaymentRateLimits();

      const guestOrderId = "order_f3_guest_001";
      const guestPaymentId = "pay_f3_guest_001";
      mock.tables.payments.push({
        id: "db-pay-f3-guest-1",
        razorpay_order_id: guestOrderId,
        razorpay_payment_id: guestPaymentId,
        user_id: null,
        customer_email: "guest-f3@example.test",
        item_type: "resource",
        item_id: BUNDLE_RESOURCE_ID,
        amount: 49,
        currency: "INR",
        status: "captured"
      });

      const guestEntitlementTok = generateGuestResourceToken({
        resourceId: BUNDLE_RESOURCE_ID,
        orderId: guestOrderId,
        paymentId: guestPaymentId,
        email: "guest-f3@example.test"
      });
      ok(guestEntitlementTok, "Expected valid guest resource entitlement token");

      // Guest issuance
      const guestResp = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-resource-access-token": guestEntitlementTok!
        },
        body: JSON.stringify({
          resourceId: BUNDLE_ITEMS[0].id,
          orderId: guestOrderId,
          paymentId: guestPaymentId
        })
      });
      eq(guestResp.status, 200);
      assertPaidHardeningHeaders(guestResp.headers, "guest paid local download-url");
      const guestBody: any = await guestResp.json();
      eq(guestBody.success, true);
      eq(guestBody.downloadUrl, "/api/payments/download-paid-asset");
      eq(guestBody.fileUrl, "/api/payments/download-paid-asset");
      ok(!String(guestBody.downloadUrl).includes("?"), "downloadUrl must never include query string");
      ok(typeof guestBody.assetAccessToken === "string" && guestBody.assetAccessToken.includes("."), "Expected assetAccessToken in JSON body");

      const guestRawPayload = decodeRawAssetPayload(guestBody.assetAccessToken);
      deepEq(Object.keys(guestRawPayload).sort(), ["expiresAt", "filename", "resourceId", "v"]);
      ok(!JSON.stringify(guestRawPayload).includes(guestPaymentId), "Guest token must not embed paymentId");
      ok(!JSON.stringify(guestRawPayload).includes("guest-f3@example.test"), "Guest token must not embed email");

      // Authenticated buyer issuance
      mock.tables.resource_purchases.push({
        id: "rp-f3-auth-1",
        user_id: SYNTH_AUTH_BUYER_ID,
        resource_id: BUNDLE_RESOURCE_ID,
        amount: 49,
        currency: "INR",
        status: "active"
      });
      const authResp = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok-f3-buyer"
        },
        body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
      });
      eq(authResp.status, 200);
      assertPaidHardeningHeaders(authResp.headers, "authenticated paid local download-url");
      const authBody: any = await authResp.json();
      eq(authBody.downloadUrl, "/api/payments/download-paid-asset");
      ok(typeof authBody.assetAccessToken === "string" && authBody.assetAccessToken.includes("."));

      const authRawPayload = decodeRawAssetPayload(authBody.assetAccessToken);
      deepEq(Object.keys(authRawPayload).sort(), ["expiresAt", "filename", "resourceId", "v"]);
      ok(!JSON.stringify(authRawPayload).includes(SYNTH_AUTH_BUYER_ID), "Auth token must not embed userId");
      ok(!JSON.stringify(authRawPayload).includes("f3buyer@example.test"), "Auth token must not embed email");
    });

    // 5. Header-only transport enforcement & response headers on GET /api/payments/download-paid-asset
    await runTest("3.5 GET /api/payments/download-paid-asset strictly requires Authorization: Bearer, rejects query-string tokens (403 QUERY_TOKEN_FORBIDDEN), and emits hardening headers on 200/403/404", async () => {
      resetPaymentRateLimits();

      const validToken = generateAssetAccessToken(BUNDLE_ITEMS[0].id)!;
      ok(validToken, "Expected valid token");

      // 5a. Query-string ?token= alone -> 403 QUERY_TOKEN_FORBIDDEN + hardening headers
      const qTokenResp = await fetch(
        `${baseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(validToken)}`
      );
      eq(qTokenResp.status, 403);
      assertPaidHardeningHeaders(qTokenResp.headers, "403 ?token=");
      const qTokenBody: any = await qTokenResp.json();
      eq(qTokenBody.code, "QUERY_TOKEN_FORBIDDEN");

      // 5b. Query-string ?token= EVEN WITH valid Authorization: Bearer header -> STILL 403 QUERY_TOKEN_FORBIDDEN
      const bothResp = await fetch(
        `${baseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(validToken)}`,
        { headers: { Authorization: `Bearer ${validToken}` } }
      );
      eq(bothResp.status, 403);
      assertPaidHardeningHeaders(bothResp.headers, "403 ?token= + Authorization");
      const bothBody: any = await bothResp.json();
      eq(bothBody.code, "QUERY_TOKEN_FORBIDDEN");

      // 5c. Alternate query-string token aliases (?access_token=, ?assetAccessToken=) -> 403 QUERY_TOKEN_FORBIDDEN
      for (const paramName of ["access_token", "assetAccessToken"]) {
        const aliasResp = await fetch(
          `${baseUrl}/api/payments/download-paid-asset?${paramName}=${encodeURIComponent(validToken)}`
        );
        eq(aliasResp.status, 403, `Expected 403 for ?${paramName}=`);
        assertPaidHardeningHeaders(aliasResp.headers, `403 ?${paramName}=`);
        const aliasBody: any = await aliasResp.json();
        eq(aliasBody.code, "QUERY_TOKEN_FORBIDDEN");
      }

      // 5d. Missing / malformed Authorization header -> 403 INVALID_DOWNLOAD_TOKEN + hardening headers
      for (const badHeaders of [
        {},
        { Authorization: `Basic ${validToken}` },
        { Authorization: `Bearer ${validToken} extra` }
      ]) {
        const badResp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: badHeaders as Record<string, string>
        });
        eq(badResp.status, 403);
        assertPaidHardeningHeaders(badResp.headers, "403 invalid/missing Authorization");
        const badBody: any = await badResp.json();
        eq(badBody.code, "INVALID_DOWNLOAD_TOKEN");
      }

      // 5e. Cross-resource mismatch with valid Bearer token -> 403 TOKEN_RESOURCE_MISMATCH + hardening headers
      const mismatchResp = await fetch(
        `${baseUrl}/api/payments/download-paid-asset?resourceId=${encodeURIComponent(BUNDLE_ITEMS[1].id)}`,
        { headers: { Authorization: `Bearer ${validToken}` } }
      );
      eq(mismatchResp.status, 403);
      assertPaidHardeningHeaders(mismatchResp.headers, "403 TOKEN_RESOURCE_MISMATCH");
      const mismatchBody: any = await mismatchResp.json();
      eq(mismatchBody.code, "TOKEN_RESOURCE_MISMATCH");

      // 5f. Unmapped resource token -> 404 UNMAPPED_PROTECTED_ASSET + hardening headers
      const unmappedToken = generateAssetAccessToken(SYNTH_UNMAPPED_ID)!;
      const unmappedResp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
        headers: { Authorization: `Bearer ${unmappedToken}` }
      });
      eq(unmappedResp.status, 404);
      assertPaidHardeningHeaders(unmappedResp.headers, "404 UNMAPPED_PROTECTED_ASSET");
      const unmappedBody: any = await unmappedResp.json();
      eq(unmappedBody.code, "UNMAPPED_PROTECTED_ASSET");

      // 5g. Valid Authorization: Bearer <token> with zero query string -> HTTP 200 + exact PDF bytes + hardening headers
      const okResp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
        headers: { Authorization: `Bearer ${validToken}` }
      });
      eq(okResp.status, 200);
      assertPaidHardeningHeaders(okResp.headers, "200 download-paid-asset stream");
      const downloadedBuf = Buffer.from(await okResp.arrayBuffer());
      eq(downloadedBuf.length, expectedWorkbookPdf.length);
      ok(downloadedBuf.equals(expectedWorkbookPdf), "Downloaded PDF bytes must match allowlisted file");
    });

    // 6. Paid Storage signed URL, bundle endpoints, and untouched free-resource response headers
    await runTest("3.6 Paid Storage signed URL and bundle endpoints emit Referrer-Policy/X-Content-Type-Options/Cache-Control while free-resource responses remain unchanged", async () => {
      resetPaymentRateLimits();

      // Paid Storage resource response
      mock.tables.resource_purchases.push({
        id: "rp-f3-storage-1",
        user_id: SYNTH_AUTH_BUYER_ID,
        resource_id: SYNTH_PAID_STORAGE_ID,
        amount: 299,
        currency: "INR",
        status: "active"
      });
      const paidStorageResp = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok-f3-buyer"
        },
        body: JSON.stringify({ resourceId: SYNTH_PAID_STORAGE_ID })
      });
      eq(paidStorageResp.status, 200);
      assertPaidHardeningHeaders(paidStorageResp.headers, "paid Storage download-url");
      const paidStorageBody: any = await paidStorageResp.json();
      eq(paidStorageBody.success, true);
      eq(paidStorageBody.assetAccessToken, undefined, "Storage signed URL branch should not invent an assetAccessToken");

      // GET /api/payments/bundle-files and POST /api/payments/get-bundle-files require Storage-backed bundle items
      const bundleItem0Row = mock.tables.resources.find((r) => r.id === BUNDLE_ITEMS[0].id);
      const prevItem0FileUrl = bundleItem0Row.file_url;
      bundleItem0Row.file_url = `supabase://paid-resources/${BUNDLE_ITEMS[0].storagePath}`;
      try {
        const bundleGetResp = await fetch(
          `${baseUrl}/api/payments/bundle-files?bundleId=${encodeURIComponent(BUNDLE_RESOURCE_ID)}`,
          { headers: { Authorization: "Bearer tok-f3-buyer" } }
        );
        eq(bundleGetResp.status, 200);
        assertPaidHardeningHeaders(bundleGetResp.headers, "GET /api/payments/bundle-files");
        const bundleGetBody: any = await bundleGetResp.json();
        eq(bundleGetBody.authorized, true);
        eq(bundleGetBody.files.length, 4);

        const bundlePostResp = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer tok-f3-buyer"
          },
          body: JSON.stringify({ bundleId: BUNDLE_RESOURCE_ID })
        });
        eq(bundlePostResp.status, 200);
        assertPaidHardeningHeaders(bundlePostResp.headers, "POST /api/payments/get-bundle-files");
      } finally {
        bundleItem0Row.file_url = prevItem0FileUrl;
      }

      // Free resource response MUST NOT receive the paid-only hardening headers
      const freeResp = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: SYNTH_FREE_PUBLIC_ID })
      });
      eq(freeResp.status, 200);
      eq(freeResp.headers.get("referrer-policy"), null, "Free resource response should remain unchanged (no Referrer-Policy added)");
      eq(freeResp.headers.get("x-content-type-options"), null, "Free resource response should remain unchanged (no X-Content-Type-Options added)");
      const freeBody: any = await freeResp.json();
      eq(freeBody.accessType, "free");
      eq(freeBody.downloadUrl, "/downloads/f3-free-public-guide.pdf");
    });

    // 7. Frontend buildProtectedLocalAssetRequest & end-to-end resourceService.deliverResource over header-only transport
    await runTest("3.7 buildProtectedLocalAssetRequest strips query-string tokens and resourceService.deliverResource downloads & recovers via Authorization: Bearer", async () => {
      resetPaymentRateLimits();

      // Unit checks on buildProtectedLocalAssetRequest
      const cleanReq = buildProtectedLocalAssetRequest("/api/payments/download-paid-asset", "tok.clean");
      eq(cleanReq.url, "/api/payments/download-paid-asset");
      deepEq(cleanReq.headers, { Authorization: "Bearer tok.clean" });

      const strippedReq = buildProtectedLocalAssetRequest(
        "/api/payments/download-paid-asset?token=tok.legacy&foo=bar",
        null
      );
      eq(strippedReq.url, "/api/payments/download-paid-asset?foo=bar");
      deepEq(strippedReq.headers, { Authorization: "Bearer tok.legacy" });

      const preferredReq = buildProtectedLocalAssetRequest(
        "/api/payments/download-paid-asset?token=tok.old&access_token=tok.old2",
        "tok.preferred"
      );
      eq(preferredReq.url, "/api/payments/download-paid-asset");
      deepEq(preferredReq.headers, { Authorization: "Bearer tok.preferred" });

      // End-to-end against real local Express server with single-retry expiry recovery
      const originalFetch = globalThis.fetch;
      const originalWindow = (globalThis as any).window;
      const originalDocument = (globalThis as any).document;
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      const observedDownloadCalls: Array<{ url: string; authHeader: string | null }> = [];
      let downloadedBlob: Blob | null = null;
      let downloadCallIndex = 0;

      const guestOrderId = "order_f3_e2e_001";
      const guestPaymentId = "pay_f3_e2e_001";
      mock.tables.payments.push({
        id: "db-pay-f3-e2e-1",
        razorpay_order_id: guestOrderId,
        razorpay_payment_id: guestPaymentId,
        user_id: null,
        customer_email: "e2e-f3@example.test",
        item_type: "resource",
        item_id: BUNDLE_RESOURCE_ID,
        amount: 49,
        currency: "INR",
        status: "captured"
      });
      const guestTok = generateGuestResourceToken({
        resourceId: BUNDLE_RESOURCE_ID,
        orderId: guestOrderId,
        paymentId: guestPaymentId,
        email: "e2e-f3@example.test"
      })!;

      await withPinnedClock(T0, async (clock) => {
        try {
          (globalThis as any).window = {
            localStorage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
          };
          (globalThis as any).document = {
            createElement: () => ({ href: "", download: "", style: {}, click() {} }),
            body: { appendChild() {}, removeChild() {} }
          };
          (URL as any).createObjectURL = (blob: Blob) => {
            downloadedBlob = blob;
            return "blob:finding3-e2e";
          };
          (URL as any).revokeObjectURL = () => {};

          globalThis.fetch = (async (input: any, init?: any) => {
            const rawUrl = typeof input === "string" ? input : input?.url || String(input);
            const targetUrl = rawUrl.startsWith("/") ? `${baseUrl}${rawUrl}` : rawUrl;
            if (rawUrl.includes("/api/payments/download-paid-asset")) {
              downloadCallIndex += 1;
              const headersObj = new Headers(init?.headers || {});
              observedDownloadCalls.push({
                url: rawUrl,
                authHeader: headersObj.get("authorization")
              });
              // Simulate the first freshly-issued 900s token expiring before the download lands
              if (downloadCallIndex === 1) {
                clock.advance(ASSET_TOKEN_TTL_MS + 1000);
              }
            }
            return originalFetch(targetUrl, init);
          }) as any;

          const result = await resourceService.deliverResource(
            {
              id: BUNDLE_ITEMS[0].id,
              title: BUNDLE_ITEMS[0].title,
              slug: BUNDLE_ITEMS[0].slug,
              accessType: "paid",
              price: 49,
              currency: "INR",
              status: "published"
            } as any,
            {
              orderId: guestOrderId,
              paymentId: guestPaymentId,
              resourceAccessToken: guestTok
            }
          );

          eq(result.success, true, `Expected e2e deliverResource recovery to succeed, got: ${result.error}`);
          eq(observedDownloadCalls.length, 2, "Expected initial expired call + exactly 1 fresh header-only retry");
          for (const call of observedDownloadCalls) {
            eq(call.url, "/api/payments/download-paid-asset", "Frontend must never put token in download-paid-asset URL");
            ok(
              typeof call.authHeader === "string" && call.authHeader.startsWith("Bearer "),
              "Frontend must transmit asset token exclusively via Authorization: Bearer header"
            );
          }
          ok(
            observedDownloadCalls[0].authHeader !== observedDownloadCalls[1].authHeader,
            "Retry must use a newly minted asset token"
          );
          ok(downloadedBlob, "Expected downloaded Blob");
          const actualBuf = Buffer.from(await downloadedBlob!.arrayBuffer());
          ok(actualBuf.equals(expectedWorkbookPdf), "End-to-end downloaded PDF must match exact bytes");
        } finally {
          globalThis.fetch = originalFetch;
          (globalThis as any).window = originalWindow;
          (globalThis as any).document = originalDocument;
          (URL as any).createObjectURL = originalCreateObjectURL;
          (URL as any).revokeObjectURL = originalRevokeObjectURL;
        }
      });
    });

    // 8. Non-target tokens untouched (guest resource 30d & invoice 24h)
    await runTest("3.8 Guest resource token (30-day TTL) and invoice token (24-hour TTL) remain completely unchanged", async () => {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

      const guestTok = generateGuestResourceToken({
        resourceId: BUNDLE_RESOURCE_ID,
        orderId: "order_f3_untouched_1",
        paymentId: "pay_f3_untouched_1",
        email: "untouched@example.test",
        nowMs: T0
      });
      ok(guestTok);
      const guestVerified = verifyGuestResourceToken(guestTok, {
        resourceId: BUNDLE_RESOURCE_ID,
        orderId: "order_f3_untouched_1",
        paymentId: "pay_f3_untouched_1",
        nowMs: T0
      });
      eq(guestVerified.valid, true);
      eq(guestVerified.payload.exp - guestVerified.payload.iat, THIRTY_DAYS_MS, "Guest resource token TTL must stay 30 days");

      await withPinnedClock(T0, async (clock) => {
        const invTok = generateSignedInvoiceToken("pay_f3_untouched_1");
        ok(invTok);
        const expMs = Number(invTok.split(".")[0]);
        eq(expMs, T0 + TWENTY_FOUR_HOURS_MS, "Invoice token TTL must stay 24 hours");
        eq(verifySignedInvoiceToken("pay_f3_untouched_1", invTok), true);

        clock.set(T0 + TWENTY_FOUR_HOURS_MS + 1);
        eq(verifySignedInvoiceToken("pay_f3_untouched_1", invTok), false);
      });
    });
  } finally {
    await stopServer(server);
  }

  console.log("====================================================================");
  console.log(`FINDING 3 SUMMARY: ${passed} passed, ${failed} failed (${assertionCount} assertions)`);
  console.log("====================================================================");
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[Finding 3 Test Runner Fatal]", err);
  process.exit(1);
});
