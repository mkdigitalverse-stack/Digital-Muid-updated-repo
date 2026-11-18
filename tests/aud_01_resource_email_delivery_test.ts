/**
 * DIGITALMUID V4.3 — AUD-01 RESOURCE EMAIL DELIVERY & TOKEN SECURITY REGRESSION SUITE
 *
 * Strictly offline & isolated (zero real DB, Razorpay, Resend, or network calls).
 * Verifies:
 *  1. Standalone guest email link routing (/resources/thank-you/paid + resourceId + orderId + paymentId + resourceAccessToken).
 *  2. Bundle guest email link routing (/resources/bundle/meta-ads-campaign-planner-bundle + orderId + paymentId + resourceAccessToken).
 *  3. Canonical UUID token binding (bundle slug/UUID normalized to 2d50e5e3-711d-4461-a70d-0ed54dd29f17) & 30-day expiry.
 *  4. Authenticated buyer receives NO guest token in email or API.
 *  5. Pre-GTM index.html script stores token & scrubs URL synchronously before GTM initializes.
 *  6. Fail-closed GTM suppression when history.replaceState fails to scrub URL.
 *  7. analytics.ts sanitization of page_location, page_path, and conversion params.
 *  8. Bundle reload & sessionStorage recovery + bounded current-session fallback when sessionStorage fails.
 *  9. Direct in-page bundle purchase reload recovery (URL retains orderId/paymentId without token).
 * 10. PaidResourceThankYouPage standalone token recovery after scrub & reload.
 * 11. Missing, invalid, expired, and mismatched tokens fail closed (403).
 * 12. Email delivery failure logs status="failed" in email_logs, omits tokens from logs/metadata, and does not deduplicate failed sends.
 * 13. Existing invoice URL preservation & /api/payments/download-paid-asset protection.
 */

import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import express from "express";

// Configure isolated test environment BEFORE importing safety-gated modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.VITE_SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_aud01_12345";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_aud01_secret_at_least_32_bytes_ok!";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_aud01_secret_at_least_32_bytes_ok!";
process.env.INVOICE_TOKEN_HMAC_SECRET = "inv_hmac_aud01_secret_entropy_32_bytes_ok!";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "res_hmac_aud01_secret_entropy_32_bytes_ok!";
process.env.ASSET_TOKEN_HMAC_SECRET = "asset_hmac_aud01_secret_entropy_32_bytes_ok!";
delete process.env.RESEND_API_KEY;

const BUNDLE_UUID = "2d50e5e3-711d-4461-a70d-0ed54dd29f17";
const BUNDLE_SLUG = "meta-ads-campaign-planner-bundle";
const STANDALONE_UUID = "aaaaaaaa-1111-4111-8111-111111111111";
const STANDALONE_SLUG = "ad-budget-break-even-calculator";
const CHILD_BUNDLE_ITEM_UUID = "5b9f3c7d-9a4b-4e8c-9d2b-1e2f3a4b5c02";
const CHILD_BUNDLE_ITEM_SLUG = "the-ad-budget-breat-even-calculate";

const {
  buildResourceDeliveryEmailHtml,
  sendResourceDeliveryEmail,
  hasAlreadySent
} = await import("../server/mailerService.js");
const { fulfillResourcePurchase } = await import("../server/paymentFulfillment.js");
const {
  verifyGuestResourceToken,
  tryGenerateGuestResourceToken
} = await import("../server/resourceToken.js");
const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  generateAssetAccessToken,
  verifyAssetAccessToken
} = await import("../server/paymentRoutes.js");
const { tryGenerateSignedInvoiceToken } = await import("../server/invoiceToken.js");
const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const { setMockRazorpayClient } = await import("../server/razorpay.js");
const { trackEvent, analytics } = await import("../src/utils/analytics.ts");
const {
  saveStoredGuestResourceToken,
  getStoredGuestResourceToken,
  clearMemoryGuestResourceTokens
} = await import("../src/services/paymentService.ts");
const { captureAndScrubBundleAccessUrl } = await import("../src/pages/BundleAccessPage.tsx");
const { captureAndScrubThankYouUrl } = await import("../src/pages/PaidResourceThankYouPage.tsx");

function createMockDb() {
  const state = {
    payments: [] as any[],
    bookings: [] as any[],
    credit_notes: [] as any[],
    resource_purchases: [] as any[],
    email_logs: [] as any[],
    resources: [
      {
        id: BUNDLE_UUID,
        slug: BUNDLE_SLUG,
        title: "Meta Ads Campaign Planner Bundle",
        status: "published",
        access_type: "paid",
        price: 299,
        currency: "INR"
      },
      {
        id: STANDALONE_UUID,
        slug: STANDALONE_SLUG,
        title: "Standalone Growth Kit",
        status: "published",
        access_type: "paid",
        price: 499,
        currency: "INR"
      },
      {
        id: CHILD_BUNDLE_ITEM_UUID,
        slug: CHILD_BUNDLE_ITEM_SLUG,
        title: "Ad Budget & Break-Even Calculator",
        status: "published",
        access_type: "paid",
        price: 499,
        currency: "INR"
      }
    ],
    profiles: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        full_name: "Auth Buyer",
        phone: "+919876543210",
        student_id: "DM-STU-000101",
        state: "Delhi"
      }
    ]
  };

  const authUsers: Record<string, any> = {
    "auth-jwt-1": {
      id: "10000000-0000-4000-8000-000000000001",
      email: "authbuyer@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: { full_name: "Auth Buyer" },
      app_metadata: {}
    }
  };

  function makeQuery(table: string) {
    const filters: Array<{ type: string; col?: string; val?: any; clause?: string }> = [];
    let op = "select";
    let payload: any = null;

    const matchRow = (row: any) => {
      for (const f of filters) {
        if (f.type === "eq" && row[f.col!] !== f.val) return false;
        if (f.type === "in" && (!Array.isArray(f.val) || !f.val.includes(row[f.col!]))) return false;
        if (f.type === "or" && f.clause) {
          const parts = f.clause.split(",").map((s) => s.trim());
          const ok = parts.some((p) => {
            const m = p.match(/^([^.]+)\.eq\.(.+)$/);
            return m ? String(row[m[1]] ?? "") === m[2] : false;
          });
          if (!ok) return false;
        }
      }
      return true;
    };

    const exec = async () => {
      const rows = (state as any)[table] || [];
      if (op === "upsert") {
        const items = Array.isArray(payload) ? payload : [payload];
        for (const item of items) {
          const idx = rows.findIndex(
            (r: any) =>
              r.payment_id === item.payment_id && r.template_type === item.template_type
          );
          if (idx >= 0) rows[idx] = { ...rows[idx], ...item };
          else rows.push({ id: `row_${rows.length + 1}`, ...item });
        }
        return { data: items, error: null };
      }
      const matched = rows.filter(matchRow);
      return { data: matched, error: null };
    };

    const builder: any = {
      select() { return builder; },
      eq(col: string, val: any) { filters.push({ type: "eq", col, val }); return builder; },
      in(col: string, val: any) { filters.push({ type: "in", col, val }); return builder; },
      or(clause: string) { filters.push({ type: "or", clause }); return builder; },
      order() { return builder; },
      limit() { return builder; },
      upsert(p: any) { op = "upsert"; payload = p; return exec(); },
      async maybeSingle() {
        const res = await exec();
        return { data: res.data[0] || null, error: null };
      },
      async single() {
        const res = await exec();
        return { data: res.data[0] || null, error: null };
      },
      then(resolve: any, reject: any) {
        return exec().then(resolve, reject);
      }
    };
    return builder;
  }

  return {
    state,
    client: {
      auth: {
        async getUser(jwt: string) {
          const u = authUsers[jwt];
          return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: "Invalid JWT" } };
        }
      },
      from(table: string) {
        return makeQuery(table);
      },
      storage: {
        from() {
          return {
            async createSignedUrl(storagePath: string) {
              return { data: { signedUrl: `https://signed.example.test/${storagePath}?sig=mock` }, error: null };
            }
          };
        }
      },
      async rpc(fnName: string, args: any) {
        if (fnName === "fulfill_resource_purchase") {
          const purchase = {
            id: `rp_${state.resource_purchases.length + 1}`,
            user_id: args.p_user_id || null,
            resource_id: args.p_resource_id,
            amount: args.p_amount,
            currency: args.p_currency,
            razorpay_order_id: args.p_order_id,
            razorpay_payment_id: args.p_payment_id,
            customer_name: args.p_customer_name,
            customer_email: args.p_customer_email,
            customer_phone: args.p_customer_phone,
            status: "active"
          };
          const payment = {
            id: `payrow_${state.payments.length + 1}`,
            user_id: args.p_user_id || null,
            item_type: "resource",
            item_id: args.p_resource_id,
            item_title: args.p_resource_title,
            amount: args.p_amount,
            currency: args.p_currency,
            razorpay_order_id: args.p_order_id,
            razorpay_payment_id: args.p_payment_id,
            status: "captured"
          };
          state.resource_purchases.push(purchase);
          state.payments.push(payment);
          return { data: { success: true, purchase, payment }, error: null };
        }
        return { data: null, error: { message: `Unknown RPC ${fnName}` } };
      }
    }
  };
}

function createStorageMock(shouldThrow = false) {
  const store = new Map<string, string>();
  return {
    store,
    api: {
      getItem(k: string) {
        if (shouldThrow) throw new Error("SecurityError: sessionStorage disabled");
        return store.has(k) ? store.get(k)! : null;
      },
      setItem(k: string, v: string) {
        if (shouldThrow) throw new Error("QuotaExceededError");
        store.set(k, String(v));
      },
      removeItem(k: string) {
        if (shouldThrow) throw new Error("SecurityError");
        store.delete(k);
      },
      clear() {
        store.clear();
      }
    }
  };
}

function extractPreGtmScriptFromIndexHtml(): string {
  const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
  const match = html.match(
    /<!-- Pre-GTM Guest Token Sanitizer, SPA Redirect Decoder & Google Tag Manager -->\s*<script>([\s\S]*?)<\/script>/
  );
  assert.ok(match && match[1], "Pre-GTM bootstrap script must exist in index.html");
  return match[1];
}

function runIndexHtmlHeadScript({
  initialHref,
  storageMock,
  throwOnReplaceState = false,
  existingScriptSrc = "https://digitalmuid.in/existing.js"
}: {
  initialHref: string;
  storageMock: any;
  throwOnReplaceState?: boolean;
  existingScriptSrc?: string;
}) {
  const scriptSrc = extractPreGtmScriptFromIndexHtml();
  const urlObj = new URL(initialHref);
  const appendedScripts: Array<{ src: string; async?: boolean }> = [];
  const existingScript: any = {
    src: existingScriptSrc,
    parentNode: {
      insertBefore(node: any) {
        appendedScripts.push({ src: node.src, async: node.async });
      }
    }
  };

  const listeners: Record<string, Function[]> = {};
  const locationObj: any = {
    get href() { return urlObj.href; },
    get origin() { return urlObj.origin; },
    get pathname() { return urlObj.pathname; },
    get search() { return urlObj.search; },
    get hash() { return urlObj.hash; }
  };

  const windowObj: any = {
    location: locationObj,
    sessionStorage: storageMock,
    history: {
      state: { idx: 0 },
      replaceState(_state: any, _title: string, nextUrl: string) {
        if (throwOnReplaceState) throw new Error("History API blocked");
        const resolved = new URL(nextUrl, urlObj.origin);
        urlObj.pathname = resolved.pathname;
        urlObj.search = resolved.search;
        urlObj.hash = resolved.hash;
      }
    },
    addEventListener(type: string, cb: Function) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);
    },
    setTimeout(fn: Function, ms: number) {
      return { fn, ms };
    },
    clearTimeout() {}
  };

  const documentObj: any = {
    getElementsByTagName(tag: string) {
      if (tag === "script") return [existingScript];
      return [];
    },
    createElement(tag: string) {
      return { tagName: tag.toUpperCase(), src: "", async: false };
    }
  };

  const context = vm.createContext({
    window: windowObj,
    document: documentObj,
    URLSearchParams
  });
  vm.runInContext(scriptSrc, context);

  return {
    windowObj,
    appendedScripts,
    listeners,
    getCurrentHref: () => urlObj.href,
    getCurrentSearch: () => urlObj.search
  };
}

let passed = 0;
let failed = 0;

async function runAsyncTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}: ${err?.stack || err?.message || err}`);
    failed++;
  }
}

async function main() {
  console.log("==============================================================================");
  console.log("DIGITALMUID V4.3 — AUD-01 RESOURCE EMAIL DELIVERY & TOKEN SECURITY TEST SUITE");
  console.log("==============================================================================\n");

  const db = createMockDb();
  setMockSupabaseServerClient(db.client);
  setMockRazorpayClient(null);

  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;

  const originalWindow = (globalThis as any).window;
  const originalFetch = globalThis.fetch;

  try {
    await runAsyncTest("1. Standalone guest email link uses /resources/thank-you/paid + guest token + invoice URL", async () => {
      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_stand_01",
        orderId: "order_stand_01",
        resourceId: STANDALONE_UUID,
        email: "guest.solo@example.com",
        phone: "+919800001111"
      });
      assert.strictEqual(tokRes.ok, true);
      const html: string = (buildResourceDeliveryEmailHtml as any)({
        customerName: "Solo Guest",
        resourceTitle: "Standalone Growth Kit",
        resourceId: STANDALONE_UUID,
        resourceSlug: STANDALONE_SLUG,
        amount: 499,
        orderId: "order_stand_01",
        paymentId: "pay_stand_01",
        resourceAccessToken: tokRes.token
      });
      const hrefMatch = html.match(/href="(https:\/\/digitalmuid\.in\/resources\/thank-you\/paid\?[^"]+)"/);
      assert.ok(hrefMatch, "Email HTML must link standalone buyer to /resources/thank-you/paid");
      const parsed = new URL(hrefMatch[1].replace(/&amp;/g, "&"));
      assert.strictEqual(parsed.searchParams.get("resourceId"), STANDALONE_UUID);
      assert.strictEqual(parsed.searchParams.get("orderId"), "order_stand_01");
      assert.strictEqual(parsed.searchParams.get("paymentId"), "pay_stand_01");
      assert.strictEqual(parsed.searchParams.get("resourceAccessToken"), tokRes.token);
      assert.strictEqual(html.includes("/resources/thank-you?"), false);
      assert.ok(html.includes("https://digitalmuid.in/api/payments/invoice/pay_stand_01?token="));
    });

    await runAsyncTest("2. Individually bought child item (not bundle) routes to /resources/thank-you/paid", async () => {
      const html: string = (buildResourceDeliveryEmailHtml as any)({
        customerName: "Calc Guest",
        resourceTitle: "Ad Budget & Break-Even Calculator",
        resourceId: CHILD_BUNDLE_ITEM_UUID,
        resourceSlug: CHILD_BUNDLE_ITEM_SLUG,
        amount: 499,
        orderId: "order_child_01",
        paymentId: "pay_child_01",
        resourceAccessToken: "tok_child_demo"
      });
      assert.ok(html.includes("https://digitalmuid.in/resources/thank-you/paid?"));
      assert.strictEqual(html.includes("/resources/bundle/"), false);
    });

    await runAsyncTest("3. Bundle guest email link routes to canonical bundle path & binds UUID token + 30-day TTL", async () => {
      const capturedEmails: any[] = [];
      process.env.RESEND_API_KEY = "re_test_mock_isolated_aud01_key";
      globalThis.fetch = (async (url: any, init: any) => {
        if (String(url).includes("api.resend.com")) {
          capturedEmails.push(JSON.parse(init.body));
          return new Response(JSON.stringify({ id: "msg_mock_bundle_01" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const res = await sendResourceDeliveryEmail({
          to: "bundle.guest@example.com",
          customerName: "Bundle Buyer",
          customerPhone: "+919911223344",
          resourceTitle: "Meta Ads Campaign Planner Bundle",
          resourceId: BUNDLE_SLUG, // Pass slug intentionally to verify canonical UUID normalization
          resourceSlug: BUNDLE_SLUG,
          userId: null,
          isGuest: true,
          amount: 299,
          orderId: "order_bundle_01",
          paymentId: "pay_bundle_01"
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(capturedEmails.length, 1);
        const sentHtml = capturedEmails[0].html;
        const match = sentHtml.match(/href="(https:\/\/digitalmuid\.in\/resources\/bundle\/meta-ads-campaign-planner-bundle\?[^"]+)"/);
        assert.ok(match, "Bundle email must link to /resources/bundle/meta-ads-campaign-planner-bundle");
        const parsed = new URL(match[1].replace(/&amp;/g, "&"));
        assert.strictEqual(parsed.searchParams.get("orderId"), "order_bundle_01");
        assert.strictEqual(parsed.searchParams.get("paymentId"), "pay_bundle_01");
        const token = parsed.searchParams.get("resourceAccessToken");
        assert.ok(token);

        const verified = verifyGuestResourceToken(token, {
          orderId: "order_bundle_01",
          paymentId: "pay_bundle_01",
          allowedResourceIds: [BUNDLE_UUID]
        });
        assert.strictEqual(verified.valid, true, "Token must bind canonical Bundle UUID for /bundle-files");
        assert.strictEqual(verified.payload.rid, BUNDLE_UUID);
        assert.strictEqual(verified.payload.gid, "email:bundle.guest@example.com");
        assert.strictEqual(verified.payload.exp - verified.payload.iat, 30 * 24 * 60 * 60 * 1000);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.RESEND_API_KEY;
      }
    });

    await runAsyncTest("4. Authenticated buyer NEVER receives guest token via sendResourceDeliveryEmail or fulfillment", async () => {
      const capturedEmails: any[] = [];
      process.env.RESEND_API_KEY = "re_test_mock_isolated_aud01_key";
      globalThis.fetch = (async (url: any, init: any) => {
        if (String(url).includes("api.resend.com")) {
          capturedEmails.push(JSON.parse(init.body));
          return new Response(JSON.stringify({ id: "msg_mock_auth_01" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const fulfillRes = await fulfillResourcePurchase({
          userId: "10000000-0000-4000-8000-000000000001",
          resourceId: BUNDLE_UUID,
          amount: 299,
          currency: "INR",
          orderId: "order_auth_01",
          paymentId: "pay_auth_01",
          customerName: "Auth Buyer",
          customerEmail: "authbuyer@example.com",
          customerPhone: "+919876543210"
        });
        assert.strictEqual(fulfillRes.fulfilled, true);
        // Wait briefly for fire-and-forget dispatchResourceDeliveryEmail IIFE
        await new Promise((r) => setTimeout(r, 60));
        assert.strictEqual(capturedEmails.length, 1);
        const sentHtml = capturedEmails[0].html;
        assert.ok(sentHtml.includes("https://digitalmuid.in/resources/bundle/meta-ads-campaign-planner-bundle?"));
        assert.strictEqual(sentHtml.includes("resourceAccessToken"), false, "Authenticated emails must not include guest tokens");

        // Also check route rejects unauthenticated access to user-owned bundle order
        resetPaymentRateLimits();
        const unauthRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_auth_01&paymentId=pay_auth_01`);
        assert.strictEqual(unauthRes.status, 403);
        const authRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_auth_01&paymentId=pay_auth_01`, {
          headers: { Authorization: "Bearer auth-jwt-1" }
        });
        assert.strictEqual(authRes.status, 200);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.RESEND_API_KEY;
      }
    });

    await runAsyncTest("5. Initial page load stores token to sessionStorage & scrubs URL synchronously BEFORE GTM initializes", async () => {
      const storage = createStorageMock(false);
      const token = "header_payload.secret_sig_sample_12345";
      const sim = runIndexHtmlHeadScript({
        initialHref: `https://digitalmuid.in/resources/bundle/meta-ads-campaign-planner-bundle?orderId=order_gtm_1&paymentId=pay_gtm_1&resourceAccessToken=${token}`,
        storageMock: storage.api
      });

      assert.strictEqual(sim.getCurrentSearch(), "?orderId=order_gtm_1&paymentId=pay_gtm_1");
      assert.strictEqual(sim.getCurrentHref().includes(token), false);
      assert.strictEqual(storage.store.get(`dm_guest_res_tok_${BUNDLE_UUID}_order_gtm_1_pay_gtm_1`), token);
      assert.strictEqual(storage.store.get(`dm_guest_res_tok_${BUNDLE_SLUG}_order_gtm_1_pay_gtm_1`), token);
      assert.strictEqual(storage.store.get("dm_guest_res_tx_order_gtm_1_pay_gtm_1"), token);

      assert.strictEqual(sim.appendedScripts.length, 1);
      assert.ok(sim.appendedScripts[0].src.includes("googletagmanager.com/gtm.js?id=GTM-M6GRBJX"));
      const serializedDl = JSON.stringify(sim.windowObj.dataLayer);
      assert.strictEqual(serializedDl.includes(token), false, "dataLayer must never contain guest token");
      assert.strictEqual(sim.windowObj.dataLayer[0].suppress_auto_pageview, true);
      assert.strictEqual(sim.windowObj.dataLayer[0].allow_auto_pageview, false);
      assert.ok(sim.windowObj.dataLayer.some((ev: any) => ev.event === "sanitized_page_view"));
    });

    await runAsyncTest("6. GTM initialization fails closed if URL scrub fails (history.replaceState throws)", async () => {
      const storage = createStorageMock(false);
      const sim = runIndexHtmlHeadScript({
        initialHref: "https://digitalmuid.in/resources/thank-you/paid?resourceId=res_1&orderId=ord_fail&paymentId=pay_fail&resourceAccessToken=tok_must_not_leak",
        storageMock: storage.api,
        throwOnReplaceState: true
      });
      assert.strictEqual(sim.appendedScripts.length, 0, "GTM script must NOT be injected when URL scrub fails");
      assert.strictEqual(sim.windowObj.dataLayer, undefined);
    });

    await runAsyncTest("7. analytics.ts strips tokens from page_location, page_path, and conversion params while keeping conversion metrics", async () => {
      const dataLayer: any[] = [];
      (globalThis as any).window = {
        location: {
          href: "https://digitalmuid.in/resources/thank-you/paid?resourceId=res_1&orderId=ord_c1&paymentId=pay_c1&resourceAccessToken=SECRET_LEAK&resource_access_token=SECRET_2"
        },
        dataLayer
      };

      analytics.trackPaidResourcePurchase({
        resourceId: STANDALONE_UUID,
        resourceTitle: "Standalone Growth Kit",
        orderId: "ord_c1",
        paymentId: "pay_c1",
        amount: 499,
        currency: "INR"
      });
      trackEvent("custom_nav", {
        resourceAccessToken: "SECRET_PARAM",
        destination: "https://digitalmuid.in/resources/bundle/meta-ads-campaign-planner-bundle?orderId=ord_c1&resourceAccessToken=SECRET_PARAM",
        nested: { resource_access_token: "SECRET_NESTED", ok: true }
      });

      const dump = JSON.stringify(dataLayer);
      assert.strictEqual(dump.includes("SECRET_"), false);
      assert.strictEqual(dataLayer[0].event, "paid_resource_purchase_conversion");
      assert.strictEqual(dataLayer[0].order_id, "ord_c1");
      assert.strictEqual(dataLayer[0].payment_id, "pay_c1");
      assert.strictEqual(dataLayer[0].amount, 499);
      assert.strictEqual(dataLayer[0].page_location, "https://digitalmuid.in/resources/thank-you/paid?resourceId=res_1&orderId=ord_c1&paymentId=pay_c1");
      assert.strictEqual(dataLayer[1].nested.ok, true);
      assert.strictEqual(dataLayer[1].nested.resource_access_token, undefined);
    });

    await runAsyncTest("8. Bundle reload recovery via sessionStorage unlocks /api/payments/bundle-files; sessionStorage failure is bounded to active session", async () => {
      const fulfillB1 = await fulfillResourcePurchase({
        userId: null,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_reload_b1",
        paymentId: "pay_reload_b1",
        customerName: "Reload Guest",
        customerEmail: "reload.bundle@example.com",
        customerPhone: "+919111122222"
      });
      assert.strictEqual(fulfillB1.fulfilled, true);
      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222"
      });
      assert.strictEqual(tokRes.ok, true);

      // Step 1-3: Initial entry with emailed token URL
      const storage = createStorageMock(false);
      const entrySim = runIndexHtmlHeadScript({
        initialHref: `https://digitalmuid.in/resources/bundle/${BUNDLE_SLUG}?orderId=order_reload_b1&paymentId=pay_reload_b1&resourceAccessToken=${tokRes.token}`,
        storageMock: storage.api
      });
      assert.strictEqual(entrySim.getCurrentSearch(), "?orderId=order_reload_b1&paymentId=pay_reload_b1");

      // Step 4-7: Simulated browser reload -> new window keeping sessionStorage + sanitized URL
      clearMemoryGuestResourceTokens();
      (globalThis as any).window = {
        location: { href: entrySim.getCurrentHref() },
        sessionStorage: storage.api,
        addEventListener() {}
      };
      const recovered = getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1");
      assert.strictEqual(recovered, tokRes.token);

      resetPaymentRateLimits();
      const bundleResp = await originalFetch(
        `${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`,
        { headers: { "x-resource-access-token": recovered! } }
      );
      assert.strictEqual(bundleResp.status, 200);
      const bundleBody = await bundleResp.json();
      assert.strictEqual(bundleBody.authorized, true);
      assert.strictEqual(bundleBody.files.length, 4);

      // When sessionStorage fails, current page session works via bounded memory fallback, then clears cleanly
      clearMemoryGuestResourceTokens();
      const brokenStorage = createStorageMock(true);
      const memSim = runIndexHtmlHeadScript({
        initialHref: `https://digitalmuid.in/resources/bundle/${BUNDLE_SLUG}?orderId=order_reload_b1&paymentId=pay_reload_b1&resourceAccessToken=${tokRes.token}`,
        storageMock: brokenStorage.api
      });
      (globalThis as any).window = memSim.windowObj;
      assert.strictEqual(saveStoredGuestResourceToken({ resourceId: BUNDLE_UUID, orderId: "order_x", paymentId: "pay_x", token: "mem_only" }), false);
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1"), tokRes.token);
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_x", "pay_x"), "mem_only");
      // Cleanup simulates reload/unload wiping in-memory store
      clearMemoryGuestResourceTokens();
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_x", "pay_x"), null);
    });

    await runAsyncTest("9. Direct in-page bundle purchase persistence + reload recovery works cleanly", async () => {
      const storage = createStorageMock(false);
      clearMemoryGuestResourceTokens();
      (globalThis as any).window = { sessionStorage: storage.api, addEventListener() {} };

      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222"
      });
      const persisted = saveStoredGuestResourceToken({
        resourceId: BUNDLE_UUID,
        orderId: "order_reload_b1",
        paymentId: "pay_reload_b1",
        token: tokRes.token
      });
      assert.strictEqual(persisted, true);

      // Simulate reload using only orderId + paymentId from URL (no token in URL)
      clearMemoryGuestResourceTokens();
      const afterReload = getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1");
      assert.strictEqual(afterReload, tokRes.token);
    });

    await runAsyncTest("10. PaidResourceThankYouPage standalone token recovery after pre-GTM scrub & reload", async () => {
      const fulfillTy = await fulfillResourcePurchase({
        userId: null,
        resourceId: STANDALONE_UUID,
        amount: 499,
        currency: "INR",
        orderId: "order_ty_1",
        paymentId: "pay_ty_1",
        customerName: "TY Guest",
        customerEmail: "ty.guest@example.com",
        customerPhone: "+919222233333"
      });
      assert.strictEqual(fulfillTy.fulfilled, true);
      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_ty_1",
        orderId: "order_ty_1",
        resourceId: STANDALONE_UUID,
        email: "ty.guest@example.com",
        phone: "+919222233333"
      });
      assert.strictEqual(tokRes.ok, true);

      const storage = createStorageMock(false);
      const sim = runIndexHtmlHeadScript({
        initialHref: `https://digitalmuid.in/resources/thank-you/paid?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1&resourceAccessToken=${tokRes.token}`,
        storageMock: storage.api
      });
      assert.strictEqual(sim.getCurrentSearch(), `?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1`);

      clearMemoryGuestResourceTokens();
      (globalThis as any).window = { sessionStorage: storage.api, addEventListener() {} };
      const recovered = getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1");
      assert.strictEqual(recovered, tokRes.token);

      resetPaymentRateLimits();
      const verifyResp = await originalFetch(
        `${baseUrl}/api/payments/verify-purchase-status?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1`,
        { headers: { "x-resource-access-token": recovered! } }
      );
      assert.strictEqual(verifyResp.status, 200);
      const verifyBody = await verifyResp.json();
      assert.strictEqual(verifyBody.verified, true);

      const dlResp = await originalFetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-resource-access-token": recovered!
        },
        body: JSON.stringify({
          resourceId: STANDALONE_UUID,
          orderId: "order_ty_1",
          paymentId: "pay_ty_1"
        })
      });
      assert.strictEqual(dlResp.status, 200);
      const dlBody = await dlResp.json();
      assert.strictEqual(dlBody.success, true);
    });

    await runAsyncTest("11. Missing, tampered, expired, and mismatched tokens fail closed (403)", async () => {
      const valid = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222"
      });
      const expired = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222",
        nowMs: Date.now() - 31 * 24 * 60 * 60 * 1000
      });
      const wrongResource = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: STANDALONE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222"
      });
      const wrongEmail = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "attacker@example.com",
        phone: "+919111122222"
      });

      resetPaymentRateLimits();
      const missingRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`);
      const tamperedRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`, {
        headers: { "x-resource-access-token": `${valid.token}tamper` }
      });
      const expiredRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`, {
        headers: { "x-resource-access-token": expired.token! }
      });
      const wrongRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`, {
        headers: { "x-resource-access-token": wrongResource.token! }
      });
      const wrongEmailRes = await originalFetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`, {
        headers: { "x-resource-access-token": wrongEmail.token! }
      });

      assert.strictEqual(missingRes.status, 403);
      assert.strictEqual(tamperedRes.status, 403);
      assert.strictEqual(expiredRes.status, 403);
      assert.strictEqual(wrongRes.status, 403);
      assert.strictEqual(wrongEmailRes.status, 403);
    });

    await runAsyncTest("12. Email delivery failure logs status='failed', omits tokens from metadata, and does not deduplicate", async () => {
      process.env.RESEND_API_KEY = "re_test_mock_isolated_fail_key";
      globalThis.fetch = (async (url: any) => {
        if (String(url).includes("api.resend.com")) {
          return new Response(JSON.stringify({ name: "validation_error", message: "Simulated Resend 500" }), {
            status: 500,
            headers: { "content-type": "application/json" }
          });
        }
        return originalFetch(url);
      }) as any;

      try {
        const failRes = await sendResourceDeliveryEmail({
          to: "fail.guest@example.com",
          customerName: "Fail Guest",
          resourceTitle: "Meta Ads Campaign Planner Bundle",
          resourceId: BUNDLE_UUID,
          resourceSlug: BUNDLE_SLUG,
          userId: null,
          isGuest: true,
          amount: 299,
          orderId: "order_fail_mail_1",
          paymentId: "pay_fail_mail_1"
        });
        assert.strictEqual(failRes.success, false);
        const logRow = db.state.email_logs.find((r) => r.payment_id === "pay_fail_mail_1");
        assert.ok(logRow);
        assert.strictEqual(logRow.status, "failed");
        assert.strictEqual(JSON.stringify(logRow).includes("resourceAccessToken"), false);
        assert.strictEqual(await hasAlreadySent("pay_fail_mail_1", "resource_delivery"), false);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.RESEND_API_KEY;
      }
    });

    await runAsyncTest("13. Existing signed invoice URLs & protected asset downloads remain intact", async () => {
      const invTok = tryGenerateSignedInvoiceToken("pay_ty_1", 7 * 24 * 60 * 60 * 1000);
      assert.ok(typeof invTok === "string" && invTok.length > 0);
      resetPaymentRateLimits();

      const badInv = await originalFetch(`${baseUrl}/api/payments/invoice/pay_ty_1?format=json&token=${invTok}tamper`);
      assert.ok([401, 403].includes(badInv.status));
      const goodInv = await originalFetch(`${baseUrl}/api/payments/invoice/pay_ty_1?format=json&token=${invTok}`);
      assert.strictEqual(goodInv.status, 200);

      const assetTok = generateAssetAccessToken("27ef2c04-4d4a-4dbe-a702-d4013b2542b9", "pay_ty_1");
      assert.ok(assetTok);
      const verifiedAsset = verifyAssetAccessToken(assetTok);
      assert.strictEqual(verifiedAsset?.resourceId, "27ef2c04-4d4a-4dbe-a702-d4013b2542b9");

      const badDl = await originalFetch(`${baseUrl}/api/payments/download-paid-asset?token=${assetTok}tamper`);
      assert.strictEqual(badDl.status, 403);
      assert.strictEqual(verifyAssetAccessToken(`${assetTok}tamper`), null);
    });

    await runAsyncTest("14. C-1 BundleAccessPage SPA scrub & recovery (sessionStorage success vs failure, reload, missing token)", async () => {
      const makeSpaWindow = (href: string, storageApi: any) => {
        const urlObj = new URL(href);
        const replaceCalls: string[] = [];
        return {
          replaceCalls,
          getHref: () => urlObj.href,
          getSearch: () => urlObj.search,
          win: {
            location: {
              get href() { return urlObj.href; },
              get origin() { return urlObj.origin; },
              get pathname() { return urlObj.pathname; },
              get search() { return urlObj.search; },
              get hash() { return urlObj.hash; }
            },
            sessionStorage: storageApi,
            history: {
              state: { page: "bundle" },
              replaceState(_s: any, _t: string, nextUrl: string) {
                replaceCalls.push(nextUrl);
                const resolved = new URL(nextUrl, urlObj.origin);
                urlObj.pathname = resolved.pathname;
                urlObj.search = resolved.search;
                urlObj.hash = resolved.hash;
              }
            },
            addEventListener() {}
          }
        };
      };

      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222"
      });
      assert.ok(tokRes.ok && tokRes.token);

      // Case 1: sessionStorage succeeds
      clearMemoryGuestResourceTokens();
      const goodStorage = createStorageMock(false);
      const spaGood = makeSpaWindow(
        `https://digitalmuid.in/resources/bundle/${BUNDLE_SLUG}?orderId=order_reload_b1&paymentId=pay_reload_b1&utm_source=email&resourceAccessToken=${tokRes.token}#files`,
        goodStorage.api
      );
      (globalThis as any).window = spaGood.win;
      const refGood = { current: null as string | null };
      const parsedGood = captureAndScrubBundleAccessUrl(refGood);

      assert.strictEqual(parsedGood.orderId, "order_reload_b1");
      assert.strictEqual(parsedGood.paymentId, "pay_reload_b1");
      assert.strictEqual(parsedGood.capturedToken, tokRes.token);
      assert.strictEqual(refGood.current, tokRes.token);
      assert.strictEqual(spaGood.replaceCalls.length, 1);
      assert.strictEqual(spaGood.getHref().includes(tokRes.token), false);
      assert.strictEqual(spaGood.getSearch(), "?orderId=order_reload_b1&paymentId=pay_reload_b1&utm_source=email");
      assert.strictEqual(spaGood.win.location.hash, "#files");

      // Refresh with sessionStorage available recovers token and unlocks API
      clearMemoryGuestResourceTokens();
      const spaReloadGood = makeSpaWindow(spaGood.getHref(), goodStorage.api);
      (globalThis as any).window = spaReloadGood.win;
      const refReloadGood = { current: null as string | null };
      captureAndScrubBundleAccessUrl(refReloadGood);
      const recoveredGood = refReloadGood.current || getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1");
      assert.strictEqual(recoveredGood, tokRes.token);
      resetPaymentRateLimits();
      const goodApi = await originalFetch(
        `${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`,
        { headers: { "x-resource-access-token": recoveredGood! } }
      );
      assert.strictEqual(goodApi.status, 200);

      // Case 2: sessionStorage fails -> token captured in memory, URL STILL scrubbed, current session works
      clearMemoryGuestResourceTokens();
      const brokenStorage = createStorageMock(true);
      const spaBroken = makeSpaWindow(
        `https://digitalmuid.in/resources/bundle/${BUNDLE_SLUG}?orderId=order_reload_b1&paymentId=pay_reload_b1&utm_source=spa&resource_access_token=${tokRes.token}#top`,
        brokenStorage.api
      );
      (globalThis as any).window = spaBroken.win;
      const refBroken = { current: null as string | null };
      const parsedBroken = captureAndScrubBundleAccessUrl(refBroken);

      assert.strictEqual(parsedBroken.orderId, "order_reload_b1");
      assert.strictEqual(parsedBroken.paymentId, "pay_reload_b1");
      assert.strictEqual(parsedBroken.capturedToken, tokRes.token);
      assert.strictEqual(refBroken.current, tokRes.token);
      assert.strictEqual(spaBroken.replaceCalls.length, 1, "URL must still be scrubbed when sessionStorage fails");
      assert.strictEqual(spaBroken.getHref().includes("resource_access_token"), false);
      assert.strictEqual(spaBroken.getHref().includes(tokRes.token), false);
      assert.strictEqual(spaBroken.getSearch(), "?orderId=order_reload_b1&paymentId=pay_reload_b1&utm_source=spa");
      assert.strictEqual(spaBroken.win.location.hash, "#top");

      const currentSessionToken = refBroken.current || getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1");
      assert.strictEqual(currentSessionToken, tokRes.token);
      // Repeated reads in the same session remain intact for verification + downloads
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1"), tokRes.token);
      resetPaymentRateLimits();
      const brokenSessionApi = await originalFetch(
        `${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`,
        { headers: { "x-resource-access-token": currentSessionToken! } }
      );
      assert.strictEqual(brokenSessionApi.status, 200);

      // Refresh when storage is unavailable must NOT falsely recover token and must fail closed
      clearMemoryGuestResourceTokens();
      const spaBrokenReload = makeSpaWindow(spaBroken.getHref(), brokenStorage.api);
      (globalThis as any).window = spaBrokenReload.win;
      const refBrokenReload = { current: null as string | null };
      captureAndScrubBundleAccessUrl(refBrokenReload);
      assert.strictEqual(refBrokenReload.current, null);
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1"), null);
      const missingRes = await originalFetch(
        `${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`
      );
      assert.strictEqual(missingRes.status, 403);
    });

    await runAsyncTest("15. C-1 PaidResourceThankYouPage SPA scrub & recovery (sessionStorage success vs failure, reload, missing token)", async () => {
      const makeSpaWindow = (href: string, storageApi: any) => {
        const urlObj = new URL(href);
        const replaceCalls: string[] = [];
        return {
          replaceCalls,
          getHref: () => urlObj.href,
          getSearch: () => urlObj.search,
          win: {
            location: {
              get href() { return urlObj.href; },
              get origin() { return urlObj.origin; },
              get pathname() { return urlObj.pathname; },
              get search() { return urlObj.search; },
              get hash() { return urlObj.hash; }
            },
            sessionStorage: storageApi,
            history: {
              state: { page: "thank-you" },
              replaceState(_s: any, _t: string, nextUrl: string) {
                replaceCalls.push(nextUrl);
                const resolved = new URL(nextUrl, urlObj.origin);
                urlObj.pathname = resolved.pathname;
                urlObj.search = resolved.search;
                urlObj.hash = resolved.hash;
              }
            },
            addEventListener() {}
          }
        };
      };

      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_ty_1",
        orderId: "order_ty_1",
        resourceId: STANDALONE_UUID,
        email: "ty.guest@example.com",
        phone: "+919222233333"
      });
      assert.ok(tokRes.ok && tokRes.token);

      // Case 1: sessionStorage succeeds
      clearMemoryGuestResourceTokens();
      const goodStorage = createStorageMock(false);
      const spaGood = makeSpaWindow(
        `https://digitalmuid.in/resources/thank-you/paid?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1&utm_campaign=receipt&resourceAccessToken=${tokRes.token}#receipt`,
        goodStorage.api
      );
      (globalThis as any).window = spaGood.win;
      const refGood = { current: null as string | null };
      const parsedGood = captureAndScrubThankYouUrl(refGood);

      assert.strictEqual(parsedGood.resourceId, STANDALONE_UUID);
      assert.strictEqual(parsedGood.orderId, "order_ty_1");
      assert.strictEqual(parsedGood.paymentId, "pay_ty_1");
      assert.strictEqual(parsedGood.capturedToken, tokRes.token);
      assert.strictEqual(refGood.current, tokRes.token);
      assert.strictEqual(spaGood.replaceCalls.length, 1);
      assert.strictEqual(spaGood.getHref().includes(tokRes.token), false);
      assert.strictEqual(
        spaGood.getSearch(),
        `?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1&utm_campaign=receipt`
      );
      assert.strictEqual(spaGood.win.location.hash, "#receipt");

      // Refresh with sessionStorage available recovers token and passes status + download URL checks
      clearMemoryGuestResourceTokens();
      const spaReloadGood = makeSpaWindow(spaGood.getHref(), goodStorage.api);
      (globalThis as any).window = spaReloadGood.win;
      const refReloadGood = { current: null as string | null };
      captureAndScrubThankYouUrl(refReloadGood);
      const recoveredGood = refReloadGood.current || getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1");
      assert.strictEqual(recoveredGood, tokRes.token);
      resetPaymentRateLimits();
      const verifyOk = await originalFetch(
        `${baseUrl}/api/payments/verify-purchase-status?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1`,
        { headers: { "x-resource-access-token": recoveredGood! } }
      );
      assert.strictEqual(verifyOk.status, 200);

      // Case 2: sessionStorage fails -> token captured in memory, URL STILL scrubbed, verification + download work in same session
      clearMemoryGuestResourceTokens();
      const brokenStorage = createStorageMock(true);
      const spaBroken = makeSpaWindow(
        `https://digitalmuid.in/resources/thank-you/paid?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1&safeParam=keep&resource_access_token=${tokRes.token}`,
        brokenStorage.api
      );
      (globalThis as any).window = spaBroken.win;
      const refBroken = { current: null as string | null };
      const parsedBroken = captureAndScrubThankYouUrl(refBroken);

      assert.strictEqual(parsedBroken.resourceId, STANDALONE_UUID);
      assert.strictEqual(parsedBroken.orderId, "order_ty_1");
      assert.strictEqual(parsedBroken.paymentId, "pay_ty_1");
      assert.strictEqual(parsedBroken.capturedToken, tokRes.token);
      assert.strictEqual(refBroken.current, tokRes.token);
      assert.strictEqual(spaBroken.replaceCalls.length, 1, "URL must still be scrubbed when sessionStorage fails");
      assert.strictEqual(spaBroken.getHref().includes("resource_access_token"), false);
      assert.strictEqual(spaBroken.getHref().includes(tokRes.token), false);
      assert.strictEqual(
        spaBroken.getSearch(),
        `?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1&safeParam=keep`
      );

      // Verification call followed by download call both retain access in current session
      const sessionTokenForVerify =
        refBroken.current || getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1");
      assert.strictEqual(sessionTokenForVerify, tokRes.token);
      resetPaymentRateLimits();
      const verifyBrokenSession = await originalFetch(
        `${baseUrl}/api/payments/verify-purchase-status?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1`,
        { headers: { "x-resource-access-token": sessionTokenForVerify! } }
      );
      assert.strictEqual(verifyBrokenSession.status, 200);

      const sessionTokenForDownload =
        refBroken.current || getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1");
      assert.strictEqual(sessionTokenForDownload, tokRes.token);
      const dlBrokenSession = await originalFetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-resource-access-token": sessionTokenForDownload!
        },
        body: JSON.stringify({
          resourceId: STANDALONE_UUID,
          orderId: "order_ty_1",
          paymentId: "pay_ty_1"
        })
      });
      assert.strictEqual(dlBrokenSession.status, 200);

      // Refresh when storage is unavailable must NOT falsely recover token and must fail closed
      clearMemoryGuestResourceTokens();
      const spaBrokenReload = makeSpaWindow(spaBroken.getHref(), brokenStorage.api);
      (globalThis as any).window = spaBrokenReload.win;
      const refBrokenReload = { current: null as string | null };
      captureAndScrubThankYouUrl(refBrokenReload);
      assert.strictEqual(refBrokenReload.current, null);
      assert.strictEqual(getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1"), null);
      const missingVerify = await originalFetch(
        `${baseUrl}/api/payments/verify-purchase-status?resourceId=${STANDALONE_UUID}&orderId=order_ty_1&paymentId=pay_ty_1`
      );
      assert.strictEqual(missingVerify.status, 403);
    });

    await runAsyncTest("16. Analytics sanitization: case-variant keys, nested objects/arrays, URLs, hash queries, and encoded param names in dataLayer", async () => {
      const dataLayer: any[] = [];
      (globalThis as any).window = {
        location: {
          href: "https://digitalmuid.in/resources/bundle/meta-ads-campaign-planner-bundle?orderId=ord_loc_1&TOKEN=SECRET_LOC_1&resource%5Faccess%5Ftoken=SECRET_LOC_2&utm_content=100%#/receipt?ResourceAccessToken=SECRET_LOC_3&tab=2"
        },
        dataLayer
      };

      trackEvent("hardened_analytics_test", {
        TOKEN: "SECRET_KEY_1",
        ResourceAccessToken: "SECRET_KEY_2",
        RESOURCE_ACCESS_TOKEN: "SECRET_KEY_3",
        accessToken: "SECRET_KEY_4",
        guest_token: "SECRET_KEY_5",
        resource_title: "Ad Budget & Break-Even Calculator",
        cta_name: "Master the mechanics / Explore the academy",
        order_id: "ord_loc_1",
        amount: 299,
        nested: {
          Access_Token: "SECRET_NESTED_1",
          invoiceToken: "SECRET_NESTED_2",
          safeNested: "keep_me",
          deepUrl: "/resources/thank-you/paid?resourceId=res_1&orderId=ord_1&TOKEN=SECRET_REL_1&resource_access_token=SECRET_REL_2#files"
        },
        items: [
          {
            id: "item_1",
            Token: "SECRET_ARR_OBJ_1",
            assetToken: "SECRET_ARR_OBJ_2",
            href: "https://digitalmuid.in/resources/thank-you/paid?orderId=ord_2&%74%6f%6b%65%6e=SECRET_ENC_1&resource%255Faccess%255Ftoken=SECRET_ENC_2&ok=true#/view?token=SECRET_HASH_1&panel=1"
          },
          "/go?next=%2Fpaid%3ForderId%3Do3%26token%3DSECRET_INNER_ENC&keep=yes",
          ["array_str_ok", { resourceAccessToken: "SECRET_2D_ARR", safeFlag: true }]
        ],
        meta: {
          links: [
            "https://digitalmuid.in/x#?resourceAccessToken=SECRET_HASH_ONLY",
            "#token=SECRET_FRAG_1&step=3",
            "https://digitalmuid.in/y?safe=1"
          ],
          tags: ["bundle", "planner"]
        }
      });

      assert.strictEqual(dataLayer.length, 1);
      const ev = dataLayer[0];
      const serialized = JSON.stringify(ev);
      assert.strictEqual(serialized.includes("SECRET_"), false, "No secret token value may ever reach dataLayer");

      // Location sanitization (case-insensitive + encoded + hash query + preserves non-sensitive 100%)
      assert.strictEqual(
        ev.page_location,
        "https://digitalmuid.in/resources/bundle/meta-ads-campaign-planner-bundle?orderId=ord_loc_1&utm_content=100%#/receipt?tab=2"
      );
      assert.strictEqual(
        ev.page_path,
        "/resources/bundle/meta-ads-campaign-planner-bundle?orderId=ord_loc_1&utm_content=100%#/receipt?tab=2"
      );

      // Safe analytics fields preserved verbatim
      assert.strictEqual(ev.event, "hardened_analytics_test");
      assert.strictEqual(ev.resource_title, "Ad Budget & Break-Even Calculator");
      assert.strictEqual(ev.cta_name, "Master the mechanics / Explore the academy");
      assert.strictEqual(ev.order_id, "ord_loc_1");
      assert.strictEqual(ev.amount, 299);

      // Nested object & relative URL scrubbed
      assert.strictEqual(ev.nested.Access_Token, undefined);
      assert.strictEqual(ev.nested.invoiceToken, undefined);
      assert.strictEqual(ev.nested.safeNested, "keep_me");
      assert.strictEqual(ev.nested.deepUrl, "/resources/thank-you/paid?resourceId=res_1&orderId=ord_1#files");

      // Array of objects & nested URLs/hashes/encoded params scrubbed
      assert.strictEqual(ev.items[0].id, "item_1");
      assert.strictEqual(ev.items[0].Token, undefined);
      assert.strictEqual(ev.items[0].assetToken, undefined);
      assert.strictEqual(
        ev.items[0].href,
        "https://digitalmuid.in/resources/thank-you/paid?orderId=ord_2&ok=true#/view?panel=1"
      );
      assert.strictEqual(ev.items[1], "/go?next=%2Fpaid%3ForderId%3Do3&keep=yes");
      assert.strictEqual(ev.items[2][0], "array_str_ok");
      assert.strictEqual(ev.items[2][1].resourceAccessToken, undefined);
      assert.strictEqual(ev.items[2][1].safeFlag, true);

      // Arrays inside objects scrubbed
      assert.strictEqual(ev.meta.links[0], "https://digitalmuid.in/x");
      assert.strictEqual(ev.meta.links[1], "#step=3");
      assert.strictEqual(ev.meta.links[2], "https://digitalmuid.in/y?safe=1");
      assert.deepStrictEqual(ev.meta.tags, ["bundle", "planner"]);
    });

    await runAsyncTest("17. Analytics sanitization: handles circular references and deep nesting safely without crashing dataLayer", async () => {
      const dataLayer: any[] = [];
      (globalThis as any).window = {
        location: { href: "https://digitalmuid.in/resources/thank-you/paid?orderId=ord_circ" },
        dataLayer
      };

      const circularObj: any = {
        keep: "yes",
        token: "SECRET_CIRC_OBJ"
      };
      circularObj.self = circularObj;

      const circularArr: any[] = ["safe_item", { TOKEN: "SECRET_CIRC_ARR", ok: 1 }];
      circularArr.push(circularArr);

      // Deep chain beyond MAX_SANITIZATION_DEPTH (12)
      let deepObj: any = { token: "SECRET_TOO_DEEP", leaf: "deep_leaf" };
      for (let i = 0; i < 16; i++) {
        deepObj = { layer: deepObj };
      }

      trackEvent("circular_safe_event", {
        circularObj,
        circularArr,
        deepObj,
        safeMetric: 42
      });

      assert.strictEqual(dataLayer.length, 1);
      const serialized = JSON.stringify(dataLayer[0]);
      assert.strictEqual(serialized.includes("SECRET_"), false);
      assert.strictEqual(dataLayer[0].safeMetric, 42);
      assert.strictEqual(dataLayer[0].circularObj.keep, "yes");
      assert.strictEqual(dataLayer[0].circularObj.self, undefined);
      assert.strictEqual(dataLayer[0].circularArr[0], "safe_item");
      assert.strictEqual(dataLayer[0].circularArr[1].ok, 1);
      assert.strictEqual(dataLayer[0].circularArr.length, 2);
    });

    await runAsyncTest("18. Analytics sanitization: fails closed on unsafe/unparseable values without pushing raw data", async () => {
      const dataLayer: any[] = [];
      (globalThis as any).window = {
        location: {
          href: "https://digitalmuid.in/paid?%E0%A4%A=badkey&token=SECRET_RAW_LOC"
        },
        dataLayer
      };

      // Property-level malformed URL & throwing getter fail closed while preserving unrelated safe properties
      const unsafePropPayload: Record<string, any> = {
        safe_field: "preserved",
        malformedTokenUrl: "https://digitalmuid.in/paid?%E0%A4%A=1&token=SECRET_UNSAFE_URL",
        embeddedUnsafe: "See https://digitalmuid.in/paid?%E0%A4%A=1&resourceAccessToken=SECRET_EMBED"
      };
      Object.defineProperty(unsafePropPayload, "throwingGetter", {
        enumerable: true,
        get() {
          throw new Error("boom SECRET_GETTER");
        }
      });

      trackEvent("partial_fail_closed_event", unsafePropPayload);
      assert.strictEqual(dataLayer.length, 1);
      const firstDump = JSON.stringify(dataLayer[0]);
      assert.strictEqual(firstDump.includes("SECRET_"), false);
      assert.strictEqual(dataLayer[0].event, "partial_fail_closed_event");
      assert.strictEqual(dataLayer[0].safe_field, "preserved");
      assert.strictEqual("malformedTokenUrl" in dataLayer[0], false);
      assert.strictEqual("embeddedUnsafe" in dataLayer[0], false);
      assert.strictEqual("throwingGetter" in dataLayer[0], false);
      assert.strictEqual("page_location" in dataLayer[0], false);

      // Top-level unreadable Proxy params must fail closed completely (never push raw dataLayer entry)
      const countBeforeProxy = dataLayer.length;
      const throwingProxy = new Proxy(
        { token: "SECRET_RAW_PROXY", amount: 999 },
        {
          ownKeys() {
            throw new Error("Proxy enumeration blocked");
          }
        }
      );
      trackEvent("proxy_fail_closed_event", throwingProxy as any);
      assert.strictEqual(dataLayer.length, countBeforeProxy, "Throwing top-level params must not push raw data to dataLayer");

      // Unrelated safe event still dispatches normally even if window.location.href throws
      (globalThis as any).window = {
        location: {
          get href() {
            throw new Error("Location blocked");
          }
        },
        dataLayer
      };
      trackEvent("unrelated_safe_event", { cta_name: "Book Consultation", destination: "/business-growth-consultation" });
      assert.strictEqual(dataLayer.length, countBeforeProxy + 1);
      assert.strictEqual(dataLayer[countBeforeProxy].event, "unrelated_safe_event");
      assert.strictEqual(dataLayer[countBeforeProxy].cta_name, "Book Consultation");
      assert.strictEqual("page_location" in dataLayer[countBeforeProxy], false);
    });

    await runAsyncTest("19. Pre-GTM index.html handles alternate-case, separator-variant, URL-encoded keys, and fails closed", async () => {
      // Case A: Alternate case + separator + URL-encoded token params scrubbed before GTM, token captured, safe params/hash preserved
      const variants = [
        { key: "ResourceAccessToken", token: "tok_case_variant_01" },
        { key: "resource-access-token", token: "tok_dash_variant_02" },
        { key: "resource%5Faccess%5Ftoken", token: "tok_enc_variant_03" },
        { key: "resource%255Faccess%255Ftoken", token: "tok_dblenc_variant_04" },
        { key: "Guest_Resource_Token", token: "tok_guest_variant_05" }
      ];

      for (const v of variants) {
        const storage = createStorageMock(false);
        const sim = runIndexHtmlHeadScript({
          initialHref: `https://digitalmuid.in/resources/bundle/${BUNDLE_SLUG}?orderId=ord_v1&paymentId=pay_v1&resourceId=${BUNDLE_UUID}&invoiceId=inv_safe_1&utm_source=email&${v.key}=${v.token}#receipt`,
          storageMock: storage.api
        });

        assert.strictEqual(
          sim.getCurrentSearch(),
          `?orderId=ord_v1&paymentId=pay_v1&resourceId=${BUNDLE_UUID}&invoiceId=inv_safe_1&utm_source=email`,
          `Safe params must remain intact for variant ${v.key}`
        );
        assert.strictEqual(sim.getCurrentHref().includes(v.token), false, `Token must be scrubbed for ${v.key}`);
        assert.strictEqual(sim.windowObj.location.hash, "#receipt");
        assert.strictEqual(storage.store.get("dm_guest_res_tx_ord_v1_pay_v1"), v.token);
        assert.strictEqual(storage.store.get(`dm_guest_res_tok_${BUNDLE_UUID}_ord_v1_pay_v1`), v.token);

        assert.strictEqual(sim.appendedScripts.length, 1);
        const dlDump = JSON.stringify(sim.windowObj.dataLayer);
        assert.strictEqual(dlDump.includes(v.token), false, `dataLayer must never expose token for ${v.key}`);
        assert.strictEqual(sim.windowObj.dataLayer[0].suppress_auto_pageview, true);
        assert.strictEqual(sim.windowObj.dataLayer[0].allow_auto_pageview, false);
        assert.ok(sim.windowObj.dataLayer.some((ev: any) => ev.event === "sanitized_page_view"));
      }

      // Case B: Unrelated params without guest resource token allow normal auto pageview
      const cleanStorage = createStorageMock(false);
      const cleanSim = runIndexHtmlHeadScript({
        initialHref: "https://digitalmuid.in/resources?invoiceId=inv_99&utm_source=blog",
        storageMock: cleanStorage.api
      });
      assert.strictEqual(cleanSim.getCurrentSearch(), "?invoiceId=inv_99&utm_source=blog");
      assert.strictEqual(cleanSim.appendedScripts.length, 1);
      assert.strictEqual(cleanSim.windowObj.dataLayer[0].suppress_auto_pageview, false);
      assert.strictEqual(cleanSim.windowObj.dataLayer[0].allow_auto_pageview, true);

      // Case C: Fail closed when replaceState throws on separator/encoded variant
      for (const failParam of ["resource-access-token=tok_leak_1", "resource%5Faccess%5Ftoken=tok_leak_2"]) {
        const failStorage = createStorageMock(false);
        const failSim = runIndexHtmlHeadScript({
          initialHref: `https://digitalmuid.in/resources/thank-you/paid?orderId=ord_f1&paymentId=pay_f1&${failParam}`,
          storageMock: failStorage.api,
          throwOnReplaceState: true
        });
        assert.strictEqual(failSim.appendedScripts.length, 0, `GTM must NOT load if scrub fails for ${failParam}`);
        assert.strictEqual(failSim.windowObj.dataLayer, undefined);
      }

      // Case D: Fail closed on malformed %-encoded resource token parameter
      const badEncSim = runIndexHtmlHeadScript({
        initialHref: "https://digitalmuid.in/resources/thank-you/paid?orderId=ord_f2&paymentId=pay_f2&resource%E0%A4%A_token=tok_leak_3",
        storageMock: createStorageMock(false).api
      });
      assert.strictEqual(badEncSim.appendedScripts.length, 0, "GTM must NOT load on malformed %-encoded resource parameter");
      assert.strictEqual(badEncSim.windowObj.dataLayer, undefined);
    });

    await runAsyncTest("20. paymentService.ts throwing sessionStorage getter & writes fall back cleanly to bounded memory store with TTL and pagehide cleanup", async () => {
      const tokRes = tryGenerateGuestResourceToken({
        paymentId: "pay_reload_b1",
        orderId: "order_reload_b1",
        resourceId: BUNDLE_UUID,
        email: "reload.bundle@example.com",
        phone: "+919111122222"
      });
      assert.ok(tokRes.ok && tokRes.token);

      const createEventWindow = (sessionStorageDescriptor: PropertyDescriptor) => {
        const listeners: Record<string, Function[]> = {};
        let localStorageAccessed = false;
        const win: any = {
          addEventListener(type: string, cb: Function) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(cb);
          },
          dispatch(type: string) {
            for (const cb of listeners[type] || []) cb();
          }
        };
        Object.defineProperty(win, "sessionStorage", sessionStorageDescriptor);
        Object.defineProperty(win, "localStorage", {
          get() {
            localStorageAccessed = true;
            throw new Error("localStorage must never be accessed");
          }
        });
        return { win, listeners, wasLocalStorageAccessed: () => localStorageAccessed };
      };

      // Case 1: window.sessionStorage getter itself throws (e.g. Safari strict/sandbox SecurityError)
      clearMemoryGuestResourceTokens();
      const getterThrowEnv = createEventWindow({
        configurable: true,
        get() {
          throw new Error("SecurityError: sessionStorage getter denied");
        }
      });
      (globalThis as any).window = getterThrowEnv.win;

      const persistedOnGetterThrow = saveStoredGuestResourceToken({
        resourceId: BUNDLE_UUID,
        orderId: "order_reload_b1",
        paymentId: "pay_reload_b1",
        token: tokRes.token
      });
      assert.strictEqual(persistedOnGetterThrow, false);
      assert.strictEqual(getterThrowEnv.wasLocalStorageAccessed(), false);

      // Verify transaction, bundle canonical UUID, and slug alias bindings all resolve
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1"), tokRes.token);
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_SLUG, "order_reload_b1", "pay_reload_b1"), tokRes.token);
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "wrong_order", "pay_reload_b1"), null);
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "wrong_pay"), null);

      // Confirm recovered in-memory token actually authorizes protected bundle API
      resetPaymentRateLimits();
      const bundleOk = await originalFetch(
        `${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`,
        {
          headers: {
            "x-resource-access-token": getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1")!
          }
        }
      );
      assert.strictEqual(bundleOk.status, 200);

      // Cleanup on pagehide wipes in-memory token cleanly
      assert.ok((getterThrowEnv.listeners["pagehide"] || []).length >= 1);
      getterThrowEnv.win.dispatch("pagehide");
      assert.strictEqual(getStoredGuestResourceToken(BUNDLE_UUID, "order_reload_b1", "pay_reload_b1"), null);

      // Case 2: sessionStorage writes throw (QuotaExceededError) + beforeunload cleanup + 30-min TTL expiration
      clearMemoryGuestResourceTokens();
      const brokenStorage = createStorageMock(true);
      const writeThrowEnv = createEventWindow({
        configurable: true,
        value: brokenStorage.api
      });
      (globalThis as any).window = writeThrowEnv.win;

      const persistedOnWriteThrow = saveStoredGuestResourceToken({
        resourceId: STANDALONE_UUID,
        orderId: "order_ty_1",
        paymentId: "pay_ty_1",
        token: "tok_mem_ttl_test"
      });
      assert.strictEqual(persistedOnWriteThrow, false);
      assert.strictEqual(getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1"), "tok_mem_ttl_test");

      // Verify beforeunload listener wipes memory token
      assert.ok((writeThrowEnv.listeners["beforeunload"] || []).length >= 1);
      writeThrowEnv.win.dispatch("beforeunload");
      assert.strictEqual(getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1"), null);

      // Verify 30-minute TTL expiration prunes expired memory token
      const originalDateNow = Date.now;
      let fakeNow = originalDateNow();
      Date.now = () => fakeNow;
      try {
        saveStoredGuestResourceToken({
          resourceId: STANDALONE_UUID,
          orderId: "order_ty_1",
          paymentId: "pay_ty_1",
          token: "tok_mem_ttl_expire"
        });
        assert.strictEqual(getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1"), "tok_mem_ttl_expire");
        fakeNow += 30 * 60 * 1000 + 1; // Advance past 30-min TTL
        assert.strictEqual(getStoredGuestResourceToken(STANDALONE_UUID, "order_ty_1", "pay_ty_1"), null);
      } finally {
        Date.now = originalDateNow;
      }

      // Missing token fails closed (403)
      resetPaymentRateLimits();
      const failClosedRes = await originalFetch(
        `${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_reload_b1&paymentId=pay_reload_b1`
      );
      assert.strictEqual(failClosedRes.status, 403);
    });
  } finally {
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
    globalThis.fetch = originalFetch;
    setMockSupabaseServerClient(null);
    setMockRazorpayClient(null);
    server.close();
  }

  console.log("\n==============================================================================");
  console.log(`AUD-01 REGRESSION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal AUD-01 test error:", err);
  process.exit(1);
});
