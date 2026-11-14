/**
 * DIGITALMUID V4.3 — CRITICAL PAYMENT SECURITY & INVOICE REMEDIATION REGRESSION SUITE
 *
 * Strictly isolated local HTTP & unit test suite (zero external network/production calls).
 * Verifies all 5 security defects (Fixes 1-5) end-to-end against live Express routes.
 */

import assert from "node:assert";
import crypto from "node:crypto";
import express from "express";

// Configure isolated test environment BEFORE importing safety-gated modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.VITE_SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_remediation_12345";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_at_least_32_bytes_long_12345";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_remediation_secret_987654321";
process.env.INVOICE_TOKEN_HMAC_SECRET = "inv_hmac_test_secret_entropy_32_bytes_minimum_ok!";

const { default: paymentRoutes, resetPaymentRateLimits, verifySignedInvoiceToken } = await import("../server/paymentRoutes.js");
const { handleRazorpayWebhook } = await import("../server/paymentWebhook.js");
const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const { setMockRazorpayClient } = await import("../server/razorpay.js");
const {
  buildConsultationConfirmationEmailHtml,
  buildResourceDeliveryEmailHtml
} = await import("../server/mailerService.js");

function signRazorpayCheckout(orderId, paymentId) {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function signRazorpayWebhook(rawBodyBuffer) {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBodyBuffer)
    .digest("hex");
}

function createStatefulMockDb() {
  const state = {
    payments: [],
    bookings: [],
    resource_purchases: [],
    credit_notes: [],
    course_enrollments: [],
    profiles: [
      { id: "10000000-0000-4000-8000-000000000001", full_name: "Arjun Mehta", phone: "+919876543210", student_id: "DM-STU-000101", state: "Delhi", billing_address: "Delhi" },
      { id: "10000000-0000-4000-8000-000000000002", full_name: "Neha Kapoor", phone: "+919876500000", student_id: "DM-STU-000102", state: "Maharashtra", billing_address: "Mumbai" }
    ],
    courses: [
      { id: "11111111-1111-4111-8111-111111111111", slug: "meta-ads-mastery", title: "Meta Ads Mastery", price: 4999, currency: "INR", status: "published" }
    ],
    resources: [
      { id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17", slug: "meta-ads-bundle", title: "Meta Ads Campaign Bundle", access_type: "paid", price: 299, currency: "INR" }
    ],
    consultation_products: [
      { id: "31bbb9bf-ce10-4da4-a517-dfc673f9b875", name: "Business Growth Consultation", base_price: 499, gst_rate: 0.18, currency: "INR", active: true }
    ],
    crm_leads: [],
    email_logs: [],
    rpcCalls: [],
    cnSeq: 10,
    invSeq: 500
  };

  const tokens = {
    "token-owner-1": { id: "10000000-0000-4000-8000-000000000001", email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "Arjun Mehta" }, app_metadata: {} },
    "token-other-2": { id: "10000000-0000-4000-8000-000000000002", email: "other@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "Neha Kapoor" }, app_metadata: {} },
    "token-admin": { id: "10000000-0000-4000-8000-000000000009", email: "admin@digitalmuid.com", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: {}, app_metadata: { role: "admin" } }
  };

  function makeQueryBuilder(table) {
    let filters = [];
    let orClause = null;
    let op = "select";
    let payload = null;
    let upsertConflict = null;

    const matchRow = (row) => {
      for (const f of filters) {
        if (f.type === "eq" && row[f.col] !== f.val) return false;
        if (f.type === "ilike" && !String(row[f.col] || "").toLowerCase().includes(String(f.val).replace(/%/g, "").toLowerCase())) return false;
      }
      if (orClause) {
        const clauses = orClause.split(",").map(s => s.trim());
        const anyMatch = clauses.some(c => {
          const m = c.match(/^([^.]+)\.eq\.(.+)$/);
          return m ? String(row[m[1]] ?? "") === String(m[2]) : false;
        });
        if (!anyMatch) return false;
      }
      return true;
    };

    const execute = async (singleMode = null) => {
      const rows = state[table] || [];
      if (op === "select") {
        const matched = rows.filter(matchRow);
        if (singleMode === "maybeSingle") return { data: matched[0] || null, error: null };
        if (singleMode === "single") return { data: matched[0] || null, error: matched[0] ? null : { message: "Not found" } };
        return { data: matched, error: null };
      }
      if (op === "insert") {
        const items = Array.isArray(payload) ? payload : [payload];
        const inserted = items.map(item => {
          const rec = { id: item.id || crypto.randomUUID(), ...item };
          rows.push(rec);
          return rec;
        });
        if (singleMode) return { data: inserted[0] || null, error: null };
        return { data: inserted, error: null };
      }
      if (op === "upsert") {
        const rec = { id: payload.id || crypto.randomUUID(), ...payload };
        if (upsertConflict) {
          const idx = rows.findIndex(r => r[upsertConflict] === rec[upsertConflict]);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...rec };
            return { data: singleMode ? rows[idx] : [rows[idx]], error: null };
          }
        }
        rows.push(rec);
        return { data: singleMode ? rec : [rec], error: null };
      }
      if (op === "update") {
        const updated = [];
        for (let i = 0; i < rows.length; i++) {
          if (matchRow(rows[i])) {
            rows[i] = { ...rows[i], ...payload };
            updated.push(rows[i]);
          }
        }
        return { data: singleMode ? (updated[0] || null) : updated, error: null };
      }
      return { data: null, error: null };
    };

    const builder = {
      select() { return builder; },
      insert(data) { op = "insert"; payload = data; return builder; },
      upsert(data, opts) { op = "upsert"; payload = data; upsertConflict = opts?.onConflict; return builder; },
      update(data) { op = "update"; payload = data; return builder; },
      eq(col, val) { filters.push({ type: "eq", col, val }); return builder; },
      ilike(col, val) { filters.push({ type: "ilike", col, val }); return builder; },
      or(clause) { orClause = clause; return builder; },
      limit() { return builder; },
      maybeSingle() { return execute("maybeSingle"); },
      single() { return execute("single"); },
      then(resolve, reject) { return execute(null).then(resolve, reject); }
    };
    return builder;
  }

  const client = {
    auth: {
      async getUser(token) {
        const u = tokens[token];
        if (!u) return { data: { user: null }, error: new Error("Invalid token") };
        return { data: { user: u }, error: null };
      },
      admin: {
        async listUsers() {
          return { data: { users: Object.values(tokens) }, error: null };
        },
        async getUserById(id) {
          const u = Object.values(tokens).find(t => t.id === id) || null;
          return { data: { user: u }, error: null };
        },
        async createUser({ email, user_metadata }) {
          const u = { id: crypto.randomUUID(), email, email_confirmed_at: new Date().toISOString(), user_metadata };
          return { data: { user: u }, error: null };
        }
      }
    },
    from(table) {
      return makeQueryBuilder(table);
    },
    async rpc(fnName, params) {
      state.rpcCalls.push({ fnName, params });
      if (fnName === "get_next_invoice_number") {
        state.invSeq += 1;
        return { data: `DM/26-27/${String(state.invSeq).padStart(4, "0")}`, error: null };
      }
      if (fnName === "record_credit_note_with_limit") {
        const payment = state.payments.find(p => p.razorpay_payment_id === params.p_payment_id);
        const existing = state.credit_notes.find(cn => cn.refund_id === params.p_refund_id);
        if (existing) return { data: [existing], error: null };
        const priorTotal = state.credit_notes
          .filter(cn => cn.payment_id === params.p_payment_id)
          .reduce((s, c) => s + Number(c.amount), 0);
        const origAmount = Number(payment?.amount || 0);
        if (params.p_refund_amount <= 0 || params.p_refund_amount > origAmount - priorTotal) {
          return { data: null, error: { message: `Refund amount ${params.p_refund_amount} exceeds remaining eligible balance` } };
        }
        state.cnSeq += 1;
        const cn = {
          id: crypto.randomUUID(),
          payment_id: params.p_payment_id,
          refund_id: params.p_refund_id,
          amount: params.p_refund_amount,
          reason: params.p_reason,
          credit_note_number: `CN/26-27/${String(state.cnSeq).padStart(4, "0")}`,
          created_at: new Date().toISOString()
        };
        state.credit_notes.push(cn);
        return { data: [cn], error: null };
      }
      if (fnName === "fulfill_course_enrollment") {
        const existing = state.payments.find(p => p.razorpay_payment_id === params.p_payment_id);
        if (existing) {
          return {
            data: {
              success: true,
              already_fulfilled: true,
              payment_id: existing.id,
              enrollment_id: "DM-ENR-EXISTING",
              course_title: "Meta Ads Mastery",
              course_slug: "meta-ads-mastery",
              amount: existing.amount,
              currency: existing.currency
            },
            error: null
          };
        }
        const payRow = {
          id: crypto.randomUUID(),
          user_id: params.p_user_id,
          item_type: "course",
          item_id: params.p_course_id,
          item_title: "Meta Ads Mastery",
          amount: params.p_amount,
          currency: params.p_currency,
          razorpay_order_id: params.p_order_id,
          razorpay_payment_id: params.p_payment_id,
          status: "captured",
          created_at: new Date().toISOString()
        };
        state.payments.push(payRow);
        state.course_enrollments.push({
          id: crypto.randomUUID(),
          user_id: params.p_user_id,
          course_id: params.p_course_id,
          status: "active"
        });
        return {
          data: {
            success: true,
            already_fulfilled: false,
            payment_id: payRow.id,
            enrollment_id: "DM-ENR-NEW",
            course_title: "Meta Ads Mastery",
            course_slug: "meta-ads-mastery",
            amount: params.p_amount,
            currency: params.p_currency
          },
          error: null
        };
      }
      return { data: null, error: new Error(`Unknown RPC: ${fnName}`) };
    }
  };

  return { client, state };
}

function createMockRazorpay() {
  const gatewayPayments = new Map();
  const gatewayOrders = new Map();
  let fetchCalls = 0;

  return {
    gatewayPayments,
    gatewayOrders,
    getFetchCalls: () => fetchCalls,
    resetFetchCalls: () => { fetchCalls = 0; },
    client: {
      payments: {
        async fetch(id) {
          fetchCalls += 1;
          const p = gatewayPayments.get(id);
          if (!p) throw { error: { description: "Payment not found" } };
          return p;
        }
      },
      orders: {
        async fetch(id) {
          fetchCalls += 1;
          const o = gatewayOrders.get(id);
          if (!o) throw { error: { description: "Order not found" } };
          return o;
        }
      }
    }
  };
}

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  resetPaymentRateLimits();
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function main() {
  console.log("==============================================================================");
  console.log("DIGITALMUID V4.3 — CRITICAL REMEDIATION REGRESSION TEST SUITE (HTTP & UNIT)");
  console.log("==============================================================================\n");

  const mockRzp = createMockRazorpay();
  setMockRazorpayClient(mockRzp.client);

  const app = express();
  app.post("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res) => {
    return handleRazorpayWebhook(req, res);
  });
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // =========================================================================
    // FIX 1: UNAUTHORIZED CREDIT NOTE ISSUANCE
    // =========================================================================
    console.log("[Fix 1] Unauthorized Credit Note Issuance");

    await runTest("1.1 Ordinary user with captured payment requesting ?type=credit-note is rejected (403) and RPC not called", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_fix1_cap",
        user_id: "10000000-0000-4000-8000-000000000001",
        item_type: "course",
        item_id: "11111111-1111-4111-8111-111111111111",
        item_title: "Meta Ads Mastery",
        amount: 4999,
        currency: "INR",
        razorpay_order_id: "order_fix1_cap",
        razorpay_payment_id: "pay_fix1_cap",
        status: "captured",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayOrders.set("order_fix1_cap", { id: "order_fix1_cap", amount: 499900, currency: "INR" });
      mockRzp.gatewayPayments.set("pay_fix1_cap", { id: "pay_fix1_cap", order_id: "order_fix1_cap", amount: 499900, currency: "INR", status: "captured", amount_refunded: 0 });

      const res = await fetch(`${baseUrl}/api/payments/invoice/pay_fix1_cap?type=credit-note&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const body = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.code, "CREDIT_NOTE_NOT_AUTHORIZED");
      assert.strictEqual(state.credit_notes.length, 0);
      assert.strictEqual(state.rpcCalls.filter(c => c.fnName === "record_credit_note_with_limit").length, 0);
    });

    await runTest("1.2 Ordinary user calling /api/payments/credit-note/:id on non-refunded payment is rejected (403)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_fix1_route",
        user_id: "10000000-0000-4000-8000-000000000001",
        item_type: "resource",
        item_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
        amount: 299,
        currency: "INR",
        razorpay_order_id: "order_fix1_route",
        razorpay_payment_id: "pay_fix1_route",
        status: "captured",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set("pay_fix1_route", { id: "pay_fix1_route", order_id: "order_fix1_route", amount: 29900, currency: "INR", status: "captured", amount_refunded: 0 });

      const res = await fetch(`${baseUrl}/api/payments/credit-note/pay_fix1_route?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(state.credit_notes.length, 0);
    });

    await runTest("1.3 Confirmed booking with null payment_status requesting ?type=credit-note is rejected (400)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.bookings.push({
        id: "bkg_fix1_null",
        user_id: "10000000-0000-4000-8000-000000000001",
        status: "confirmed",
        payment_status: null,
        total_amount: 589,
        currency: "INR",
        razorpay_order_id: "order_bkg_null",
        payment_id: "pay_bkg_null",
        customer_name: "Arjun Mehta",
        customer_email: "owner@example.com"
      });
      mockRzp.gatewayPayments.delete("pay_bkg_null");

      const res = await fetch(`${baseUrl}/api/payments/invoice/pay_bkg_null?type=credit-note&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(state.credit_notes.length, 0);
    });

    await runTest("1.4 Verified refunded payment allows legitimate credit note generation & retrieval (200)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_fix1_ref",
        user_id: "10000000-0000-4000-8000-000000000001",
        item_type: "course",
        item_id: "11111111-1111-4111-8111-111111111111",
        item_title: "Meta Ads Mastery",
        amount: 4999,
        currency: "INR",
        razorpay_order_id: "order_fix1_ref",
        razorpay_payment_id: "pay_fix1_ref",
        refund_id: "rfnd_legit_001",
        status: "refunded",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set("pay_fix1_ref", { id: "pay_fix1_ref", order_id: "order_fix1_ref", amount: 499900, amount_refunded: 499900, currency: "INR", status: "refunded" });

      const res = await fetch(`${baseUrl}/api/payments/invoice/pay_fix1_ref?type=credit-note&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.isCreditNote, true);
      assert.ok(body.creditNote.creditNoteNumber.startsWith("CN/"));
      assert.strictEqual(state.credit_notes.length, 1);

      const routeRes = await fetch(`${baseUrl}/api/payments/credit-note/pay_fix1_ref?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const routeBody = await routeRes.json();
      assert.strictEqual(routeRes.status, 200);
      assert.strictEqual(routeBody.isCreditNote, true);
      assert.strictEqual(routeBody.creditNote.creditNoteNumber, body.creditNote.creditNoteNumber);
    });

    await runTest("1.5 Partially refunded payment allows retrieving existing CN but blocks forged new refundId by non-admin (403)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_fix1_part",
        user_id: "10000000-0000-4000-8000-000000000001",
        item_type: "course",
        item_id: "11111111-1111-4111-8111-111111111111",
        amount: 4999,
        currency: "INR",
        razorpay_order_id: "order_fix1_part",
        razorpay_payment_id: "pay_fix1_part",
        status: "captured",
        created_at: new Date().toISOString()
      });
      state.credit_notes.push({
        id: "cn_existing_1",
        payment_id: "pay_fix1_part",
        refund_id: "rfnd_real_partial",
        amount: 1000,
        credit_note_number: "CN/26-27/0009",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set("pay_fix1_part", { id: "pay_fix1_part", order_id: "order_fix1_part", amount: 499900, amount_refunded: 0, currency: "INR", status: "captured" });

      // Retrieving existing credit note works without RPC call
      const okRes = await fetch(`${baseUrl}/api/payments/invoice/pay_fix1_part?type=credit-note&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const okBody = await okRes.json();
      assert.strictEqual(okRes.status, 200);
      assert.strictEqual(okBody.creditNote.creditNoteNumber, "CN/26-27/0009");

      // Trying to mint a forged second refundId is blocked
      const forgedRes = await fetch(`${baseUrl}/api/payments/invoice/pay_fix1_part?type=credit-note&refundId=rfnd_forged&refundAmount=1000&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(forgedRes.status, 403);
      assert.strictEqual(state.credit_notes.length, 1);
    });

    await runTest("1.6 Admin can issue credit note for captured payment and respects cumulative balance limit", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_fix1_adm",
        user_id: "10000000-0000-4000-8000-000000000001",
        item_type: "course",
        item_id: "11111111-1111-4111-8111-111111111111",
        amount: 1000,
        currency: "INR",
        razorpay_order_id: "order_fix1_adm",
        razorpay_payment_id: "pay_fix1_adm",
        status: "captured",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set("pay_fix1_adm", { id: "pay_fix1_adm", order_id: "order_fix1_adm", amount: 100000, currency: "INR", status: "captured" });

      const admOk = await fetch(`${baseUrl}/api/payments/invoice/pay_fix1_adm?type=credit-note&refundId=rfnd_adm_1&refundAmount=400&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(admOk.status, 200);
      assert.strictEqual(state.credit_notes.length, 1);

      const admExcess = await fetch(`${baseUrl}/api/payments/invoice/pay_fix1_adm?type=credit-note&refundId=rfnd_adm_2&refundAmount=700&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(admExcess.status, 400);
      assert.strictEqual(state.credit_notes.length, 1);
    });

    // =========================================================================
    // FIX 2: GUEST INVOICE DOWNLOAD CRASH
    // =========================================================================
    console.log("\n[Fix 2] Guest Invoice Download Crash & Access Boundaries");

    await runTest("2.1 Pure guest (user=null, user_id=null) with valid signed token downloads invoice JSON (200) & PDF (200)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_guest_001",
        user_id: null,
        customer_email: "pureguest@example.com",
        item_type: "resource",
        item_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
        item_title: "Meta Ads Campaign Bundle",
        amount: 299,
        currency: "INR",
        razorpay_order_id: "order_guest_001",
        razorpay_payment_id: "pay_guest_001",
        status: "captured",
        created_at: new Date().toISOString()
      });
      state.resource_purchases.push({
        id: "rp_guest_001",
        user_id: null,
        customer_email: "pureguest@example.com",
        resource_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
        razorpay_order_id: "order_guest_001",
        razorpay_payment_id: "pay_guest_001",
        amount: 299,
        currency: "INR",
        status: "active"
      });
      mockRzp.gatewayPayments.set("pay_guest_001", {
        id: "pay_guest_001",
        order_id: "order_guest_001",
        amount: 29900,
        currency: "INR",
        status: "captured",
        email: "pureguest@example.com"
      });

      const { generateSignedInvoiceToken } = await import("../server/invoiceToken.js");
      const token = generateSignedInvoiceToken("pay_guest_001");

      const jsonRes = await fetch(`${baseUrl}/api/payments/invoice/pay_guest_001?token=${encodeURIComponent(token)}&format=json`);
      const jsonBody = await jsonRes.json();
      assert.strictEqual(jsonRes.status, 200);
      assert.strictEqual(jsonBody.success, true);
      assert.strictEqual(jsonBody.invoice.customer.email, "pureguest@example.com");

      const pdfRes = await fetch(`${baseUrl}/api/payments/invoice/pay_guest_001?token=${encodeURIComponent(token)}`);
      assert.strictEqual(pdfRes.status, 200);
      assert.strictEqual(pdfRes.headers.get("content-type"), "application/pdf");
      const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
      assert.ok(pdfBytes.toString("utf8", 0, 5).startsWith("%PDF-"));
    });

    await runTest("2.2 Guest with invalid or cross-payment token rejected (401); cross-user auth rejected (403); owner allowed (200)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      state.payments.push({
        id: "pm_own_001",
        user_id: "10000000-0000-4000-8000-000000000001",
        customer_email: "owner@example.com",
        item_type: "course",
        item_id: "11111111-1111-4111-8111-111111111111",
        amount: 4999,
        currency: "INR",
        razorpay_order_id: "order_own_001",
        razorpay_payment_id: "pay_own_001",
        status: "captured",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set("pay_own_001", { id: "pay_own_001", order_id: "order_own_001", amount: 499900, currency: "INR", status: "captured" });

      const { generateSignedInvoiceToken } = await import("../server/invoiceToken.js");
      const otherToken = generateSignedInvoiceToken("pay_other_payment");

      const badTokenRes = await fetch(`${baseUrl}/api/payments/invoice/pay_own_001?token=bad.token`);
      assert.strictEqual(badTokenRes.status, 401);

      const wrongPayTokenRes = await fetch(`${baseUrl}/api/payments/invoice/pay_own_001?token=${encodeURIComponent(otherToken)}`);
      assert.strictEqual(wrongPayTokenRes.status, 401);

      const crossUserRes = await fetch(`${baseUrl}/api/payments/invoice/pay_own_001`, {
        headers: { Authorization: "Bearer token-other-2" }
      });
      assert.strictEqual(crossUserRes.status, 403);

      const ownerRes = await fetch(`${baseUrl}/api/payments/invoice/pay_own_001?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(ownerRes.status, 200);
    });

    // =========================================================================
    // FIX 3: order.paid WEBHOOK MUST NOT FULFILL UNCAPTURED PAYMENTS
    // =========================================================================
    console.log("\n[Fix 3] order.paid Webhook Capture Enforcement (Course & Resource)");

    async function sendWebhook(payload) {
      const raw = Buffer.from(JSON.stringify(payload), "utf8");
      const sig = signRazorpayWebhook(raw);
      const res = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": sig
        },
        body: raw
      });
      return { status: res.status, body: await res.json() };
    }

    await runTest("3.1 order.paid webhook for Course with status=authorized is NOT fulfilled (zero DB writes)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);

      const res = await sendWebhook({
        event: "order.paid",
        payload: {
          order: {
            entity: {
              id: "order_wh_crs_auth",
              amount: 499900,
              currency: "INR",
              notes: { courseId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" }
            }
          },
          payment: {
            entity: {
              id: "pay_wh_crs_auth",
              order_id: "order_wh_crs_auth",
              amount: 499900,
              currency: "INR",
              status: "authorized"
            }
          }
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.fulfilled, false);
      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(state.course_enrollments.length, 0);
    });

    await runTest("3.2 order.paid webhook for Resource with status=created or missing payment is NOT fulfilled", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);

      const res1 = await sendWebhook({
        event: "order.paid",
        payload: {
          order: {
            entity: {
              id: "order_wh_res_cr",
              amount: 29900,
              currency: "INR",
              notes: { itemType: "resource", resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17", customerEmail: "buyer@example.com" }
            }
          },
          payment: {
            entity: {
              id: "pay_wh_res_cr",
              order_id: "order_wh_res_cr",
              amount: 29900,
              currency: "INR",
              status: "created"
            }
          }
        }
      });
      assert.strictEqual(res1.body.fulfilled, false);
      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(state.resource_purchases.length, 0);

      const res2 = await sendWebhook({
        event: "order.paid",
        payload: {
          order: {
            entity: {
              id: "order_wh_res_nopay",
              amount: 29900,
              currency: "INR",
              notes: { itemType: "resource", resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17", customerEmail: "buyer@example.com" }
            }
          }
        }
      });
      assert.strictEqual(res2.body.fulfilled, false);
      assert.strictEqual(state.payments.length, 0);
    });

    await runTest("3.3 order.paid webhook rejects mismatched order_id, mismatched amount, and non-INR currency", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);

      const wrongOrder = await sendWebhook({
        event: "order.paid",
        payload: {
          order: { entity: { id: "order_expected_w", amount: 29900, currency: "INR", notes: { itemType: "resource", resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17" } } },
          payment: { entity: { id: "pay_w1", order_id: "order_tampered_w", amount: 29900, currency: "INR", status: "captured" } }
        }
      });
      assert.strictEqual(wrongOrder.body.fulfilled, false);

      const wrongAmt = await sendWebhook({
        event: "order.paid",
        payload: {
          order: { entity: { id: "order_expected_amt", amount: 29900, currency: "INR", notes: { itemType: "resource", resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17" } } },
          payment: { entity: { id: "pay_w2", order_id: "order_expected_amt", amount: 100, currency: "INR", status: "captured" } }
        }
      });
      assert.strictEqual(wrongAmt.body.fulfilled, false);

      const wrongCur = await sendWebhook({
        event: "order.paid",
        payload: {
          order: { entity: { id: "order_expected_cur", amount: 29900, currency: "INR", notes: { courseId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } } },
          payment: { entity: { id: "pay_w3", order_id: "order_expected_cur", amount: 29900, currency: "USD", status: "captured" } }
        }
      });
      assert.strictEqual(wrongCur.body.fulfilled, false);
      assert.strictEqual(state.payments.length, 0);
    });

    await runTest("3.4 Verified captured order.paid fulfills Course and Resource once (idempotent on duplicate replay)", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);

      const resPayload = {
        event: "order.paid",
        payload: {
          order: {
            entity: {
              id: "order_wh_res_ok",
              amount: 29900,
              currency: "INR",
              notes: { itemType: "resource", resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17", customerEmail: "buyer@example.com", customerName: "Buyer One" }
            }
          },
          payment: {
            entity: { id: "pay_wh_res_ok", order_id: "order_wh_res_ok", amount: 29900, currency: "INR", status: "captured" }
          }
        }
      };
      const r1 = await sendWebhook(resPayload);
      assert.strictEqual(r1.body.fulfilled, true);
      assert.strictEqual(state.resource_purchases.length, 1);

      const r2 = await sendWebhook(resPayload);
      assert.strictEqual(r2.body.fulfilled, true);
      assert.strictEqual(r2.body.alreadyFulfilled, true);
      assert.strictEqual(state.resource_purchases.length, 1);

      const crsPayload = {
        event: "payment.captured",
        payload: {
          order: {
            entity: {
              id: "order_wh_crs_ok",
              amount: 499900,
              currency: "INR",
              notes: { courseId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" }
            }
          },
          payment: {
            entity: { id: "pay_wh_crs_ok", order_id: "order_wh_crs_ok", amount: 499900, currency: "INR", status: "captured" }
          }
        }
      };
      const c1 = await sendWebhook(crsPayload);
      assert.strictEqual(c1.body.fulfilled, true);
      assert.strictEqual(state.course_enrollments.length, 1);
    });

    // =========================================================================
    // FIX 4: CONSULTATION CHECKOUT SIGNATURE VALIDATION
    // =========================================================================
    console.log("\n[Fix 4] Consultation Checkout Signature Validation");

    await runTest("4.1 Forged, missing, or malformed consultation signature is rejected (400) before gateway fetch & DB writes", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      mockRzp.resetFetchCalls();

      const forgedRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_con_forged",
          razorpay_payment_id: "pay_con_forged",
          razorpay_signature: "FORGED_INVALID_SIGNATURE",
          bookingDetails: { customerName: "Attacker", customerEmail: "a@example.com", date: "2026-12-01", time: "10:00 AM" }
        })
      });
      const forgedBody = await forgedRes.json();
      assert.strictEqual(forgedRes.status, 400);
      assert.strictEqual(forgedBody.verified, false);
      assert.strictEqual(forgedBody.fulfilled, false);
      assert.strictEqual(forgedBody.invoiceToken, undefined);
      assert.strictEqual(mockRzp.getFetchCalls(), 0, "Gateway must NOT be queried on invalid signature");
      assert.strictEqual(state.bookings.length, 0);
      assert.strictEqual(state.payments.length, 0);

      const malformedRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: { bad: true },
          razorpay_payment_id: "pay_con_forged",
          razorpay_signature: "abc"
        })
      });
      assert.strictEqual(malformedRes.status, 400);
      assert.strictEqual(state.bookings.length, 0);
    });

    await runTest("4.2 Valid consultation signature + captured gateway payment fulfills booking and issues signed invoice token", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      const orderId = "order_con_valid_01";
      const payId = "pay_con_valid_01";
      mockRzp.gatewayOrders.set(orderId, { id: orderId, amount: 58900, currency: "INR", notes: { productId: "31bbb9bf-ce10-4da4-a517-dfc673f9b875" } });
      mockRzp.gatewayPayments.set(payId, { id: payId, order_id: orderId, amount: 58900, currency: "INR", status: "captured", email: "guestcon@example.com" });

      const sig = signRazorpayCheckout(orderId, payId);
      const res = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sig,
          bookingDetails: {
            customerName: "Priya Sharma",
            customerEmail: "guestcon@example.com",
            customerPhone: "+919876543211",
            date: "2026-12-05",
            time: "11:00 AM - 11:30 AM"
          }
        })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.verified, true);
      assert.strictEqual(body.fulfilled, true);
      assert.strictEqual(state.bookings.length, 1);
      assert.strictEqual(state.payments.length, 1);
      assert.ok(body.invoiceToken && verifySignedInvoiceToken(payId, body.invoiceToken));
      assert.ok(body.invoiceDownloadUrl.includes(`/api/payments/invoice/${payId}?token=`));

      // Duplicate replay stays idempotent
      const replayRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sig,
          bookingDetails: { customerName: "Priya Sharma", customerEmail: "guestcon@example.com", date: "2026-12-05", time: "11:00 AM - 11:30 AM" }
        })
      });
      const replayBody = await replayRes.json();
      assert.strictEqual(replayRes.status, 200);
      assert.strictEqual(replayBody.already_fulfilled, true);
      assert.strictEqual(state.bookings.length, 1);
    });

    // =========================================================================
    // FIX 5: SIGNED GUEST INVOICE TOKEN ISSUANCE & EMAIL INTEGRATION
    // =========================================================================
    console.log("\n[Fix 5] Signed Guest Invoice Token Issuance & Email Integration");

    await runTest("5.1 Guest resource verification returns valid signed invoiceToken enabling immediate invoice PDF download", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      const orderId = "order_res_guest_ok";
      const payId = "pay_res_guest_ok";
      const resId = "2d50e5e3-711d-4461-a70d-0ed54dd29f17";
      mockRzp.gatewayOrders.set(orderId, { id: orderId, amount: 29900, currency: "INR", notes: { resourceId: resId } });
      mockRzp.gatewayPayments.set(payId, { id: payId, order_id: orderId, amount: 29900, currency: "INR", status: "captured", email: "resguest@example.com" });

      const sig = signRazorpayCheckout(orderId, payId);
      const verifyRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sig,
          resourceId: resId,
          customerDetails: { name: "Guest Buyer", email: "resguest@example.com", phone: "+919000000001" }
        })
      });
      const verifyBody = await verifyRes.json();
      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyBody.verified, true);
      assert.strictEqual(verifyBody.fulfilled, true);
      assert.ok(verifyBody.invoiceToken);
      assert.strictEqual(verifySignedInvoiceToken(payId, verifyBody.invoiceToken), true);

      // End-to-end guest download using returned invoiceDownloadUrl
      const invRes = await fetch(`${baseUrl}${verifyBody.invoiceDownloadUrl}&format=json`);
      const invBody = await invRes.json();
      assert.strictEqual(invRes.status, 200);
      assert.strictEqual(invBody.success, true);
      assert.strictEqual(invBody.invoice.payment.paymentId, payId);
    });

    await runTest("5.2 Failed resource verification does NOT issue invoiceToken; authenticated course verification does not emit guest token", async () => {
      const { client } = createStatefulMockDb();
      setMockSupabaseServerClient(client);

      const failRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_res_bad",
          razorpay_payment_id: "pay_res_bad",
          razorpay_signature: "bad_sig",
          resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17"
        })
      });
      const failBody = await failRes.json();
      assert.strictEqual(failRes.status, 400);
      assert.strictEqual(failBody.invoiceToken, undefined);

      const crsOrder = "order_crs_auth_01";
      const crsPay = "pay_crs_auth_01";
      const crsSig = signRazorpayCheckout(crsOrder, crsPay);
      const crsRes = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          razorpay_order_id: crsOrder,
          razorpay_payment_id: crsPay,
          razorpay_signature: crsSig,
          courseId: "11111111-1111-4111-8111-111111111111"
        })
      });
      const crsBody = await crsRes.json();
      assert.strictEqual(crsRes.status, 200);
      assert.strictEqual(crsBody.fulfilled, true);
      assert.strictEqual(crsBody.invoiceToken, undefined);
    });

    await runTest("5.3 Confirmation email HTML embeds signed invoice URL when configured and fails closed when secret missing", async () => {
      const resHtml = buildResourceDeliveryEmailHtml({
        customerName: "Guest Buyer",
        resourceTitle: "Meta Ads Campaign Bundle",
        resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
        amount: 299,
        currency: "INR",
        orderId: "order_mail_01",
        paymentId: "pay_mail_res_01"
      });
      assert.ok(resHtml.includes("https://digitalmuid.in/api/payments/invoice/pay_mail_res_01?token="));

      const conHtml = buildConsultationConfirmationEmailHtml({
        customerName: "Client One",
        bookingCode: "DM-2026-9999",
        bookingDate: "2026-12-05",
        bookingTime: "11:00 AM",
        amount: 589,
        currency: "INR",
        paymentId: "pay_mail_con_01"
      });
      assert.ok(conHtml.includes("https://digitalmuid.in/api/payments/invoice/pay_mail_con_01?token="));

      // Verify fail-closed behavior when HMAC secret is absent
      const savedInv = process.env.INVOICE_TOKEN_HMAC_SECRET;
      const savedRzp = process.env.RAZORPAY_KEY_SECRET;
      delete process.env.INVOICE_TOKEN_HMAC_SECRET;
      delete process.env.RAZORPAY_KEY_SECRET;
      try {
        const noSecretHtml = buildResourceDeliveryEmailHtml({
          customerName: "Guest Buyer",
          resourceTitle: "Meta Ads Campaign Bundle",
          resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
          amount: 299,
          currency: "INR",
          orderId: "order_mail_02",
          paymentId: "pay_mail_res_02"
        });
        assert.strictEqual(noSecretHtml.includes("/api/payments/invoice/"), false);
      } finally {
        process.env.INVOICE_TOKEN_HMAC_SECRET = savedInv;
        process.env.RAZORPAY_KEY_SECRET = savedRzp;
      }
    });
  } finally {
    setMockSupabaseServerClient(null);
    setMockRazorpayClient(null);
    server.close();
  }

  console.log("\n==============================================================================");
  console.log(`V4.3 REMEDIATION REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
